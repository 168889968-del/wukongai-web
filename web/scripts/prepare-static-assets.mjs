import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))

let files = 0
async function compress(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) await compress(file)
    else if (/\.(js|css|svg)$/.test(item.name)) {
      const data = await readFile(file)
      await writeFile(
        `${file}.br`,
        brotliCompressSync(data, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
        })
      )
      await writeFile(`${file}.gz`, gzipSync(data, { level: 9 }))
      files++
    }
  }
}
await compress(path.join(dist, 'static'))
console.log(`Prepared ${files} compressed assets`)
