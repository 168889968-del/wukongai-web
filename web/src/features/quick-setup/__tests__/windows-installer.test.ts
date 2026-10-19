import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import runner from '../windows-runner.ps1?raw'

const roots: string[] = []
function temporaryHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukongai-install-test-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(fs.realpathSync(root)) !== fs.realpathSync(os.tmpdir()) ||
      !path.basename(root).startsWith('wukongai-install-test-')
    ) {
      throw new Error('Unexpected test root')
    }
    fs.rmSync(root, { recursive: true, force: true })
  }
}, 180000)
function execute(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeout = 20000
) {
  return new Promise<{ code: number | null; output: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, {
        env,
        windowsHide: true,
        windowsVerbatimArguments: command === 'cmd.exe',
      })
      let output = ''
      child.stdout.on('data', (chunk) => {
        output += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        output += chunk.toString()
      })
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        const killer = spawn(
          'taskkill.exe',
          ['/PID', String(child.pid), '/T', '/F'],
          { windowsHide: true }
        )
        killer.on('close', () => reject(new Error(`Timed out: ${output}`)))
        killer.on('error', () => {
          child.kill()
          reject(new Error(`Timed out: ${output}`))
        })
      }, timeout)
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (timedOut) return
        resolve({ code, output })
      })
      child.stdin.end('\r\n')
    }
  )
}

describe.skipIf(process.platform !== 'win32')(
  'native Windows installer execution',
  () => {
    it('kills the entire installer process tree when a test times out', async () => {
      await expect(
        execute(
          'cmd.exe',
          ['/d', '/s', '/c', 'ping -n 20 127.0.0.1 >nul'],
          process.env,
          200
        )
      ).rejects.toThrow('Timed out')
    })

    it.each(['application/octet-stream', 'text/plain'])(
      'executes downloaded UTF-8 bytes served as %s',
      async (contentType) => {
        const root = temporaryHome()
        const proof = path.join(root, '中文 marker.txt')
        const fixture = Buffer.from(
          `param()\n[IO.File]::WriteAllText($env:WUKONGAI_INSTALL_PROOF, '安装成功', [Text.UTF8Encoding]::new($false))\nexit 0\n`,
          'utf8'
        )
        const server = createServer((_request, response) => {
          response.writeHead(200, { 'Content-Type': contentType })
          response.end(fixture)
        })
        await new Promise<void>((resolve) =>
          server.listen(0, '127.0.0.1', resolve)
        )
        try {
          const address = server.address()
          if (!address || typeof address === 'string') {
            throw new Error('No server port')
          }
          const functions = runner.slice(
            0,
            runner.indexOf('function Get-Node {')
          )
          const script = path.join(root, 'installer-regression.ps1')
          fs.writeFileSync(
            script,
            `\ufeff${
              functions
            }\nInvoke-NativeInstaller 'http://127.0.0.1:${address.port}/install.ps1'\n`
          )
          const result = await execute(
            'powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
            { ...process.env, WUKONGAI_INSTALL_PROOF: proof }
          )
          expect(result.code, result.output).toBe(0)
          expect(fs.readFileSync(proof, 'utf8')).toBe('安装成功')
          expect(result.output).not.toContain('Unexpected token')
        } finally {
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
        }
      }
    )

    it('propagates installer failure instead of continuing configuration', async () => {
      const root = temporaryHome()
      const server = createServer((_request, response) => {
        response.writeHead(200, { 'Content-Type': 'application/octet-stream' })
        response.end('exit 23\n')
      })
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      )
      try {
        const address = server.address()
        if (!address || typeof address === 'string') {
          throw new Error('No server port')
        }
        const script = path.join(root, 'failed-install.ps1')
        fs.writeFileSync(
          script,
          `\ufeff${runner.slice(
            0,
            runner.indexOf('function Get-Node {')
          )}\nInvoke-NativeInstaller 'http://127.0.0.1:${address.port}/install.ps1'\n`
        )
        const result = await execute(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
          process.env
        )
        expect(result.code).not.toBe(0)
        expect(result.output).toContain('exit 23')
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
      }
    })
  }
)
