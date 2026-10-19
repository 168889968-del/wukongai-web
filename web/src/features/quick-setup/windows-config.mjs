// Configuration worker used by the downloadable Windows tools. Input is read
// from stdin so credentials never become command-line arguments.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

export function configure(input, root, dependencies) {
  const requireDependency = createRequire(
    path.join(dependencies, 'package.json')
  )
  const TOML = requireDependency('@iarna/toml')
  const YAML = requireDependency('yaml')
  const fileSets = {
    codex: ['config.toml', 'auth.json'],
    claude: ['settings.json'],
    grok: input.desktop
      ? ['config.toml', 'desktop-config.json']
      : ['config.toml'],
    deepseek: input.desktop
      ? ['profiles/desktop/cordis.patch.yml', '.credentials.yaml']
      : ['cordis.patch.yml', '.credentials.yaml'],
  }
  const files = fileSets[input.client]
  if (!files || !['setup', 'restore'].includes(input.mode)) {
    throw new Error('Invalid setup operation')
  }
  const snapshot = path.join(
    root,
    input.desktop ? '.wukongai-desktop-backup' : '.wukongai-setup-backup'
  )
  const manifestPath = path.join(snapshot, 'state.json')
  const read = (file) =>
    fs.existsSync(path.join(root, file))
      ? fs.readFileSync(path.join(root, file), 'utf8')
      : ''
  const write = (file, text) => {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(`${target}.wukongai.tmp`, text, {
      encoding: 'utf8',
      mode: 0o600,
    })
    fs.renameSync(`${target}.wukongai.tmp`, target)
  }
  let state = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null
  if (input.mode === 'restore') {
    if (!state?.active) return 'nothing-to-restore'
    if (state.client !== input.client) throw new Error('Backup client mismatch')
    for (const file of files) {
      if (state.existed[file]) {
        if (!fs.existsSync(path.join(snapshot, file))) {
          throw new Error('Backup is incomplete')
        }
      }
    }
    for (const file of files) {
      if (state.existed[file]) {
        write(file, fs.readFileSync(path.join(snapshot, file)))
      } else if (fs.existsSync(path.join(root, file))) {
        fs.unlinkSync(path.join(root, file))
      }
    }
    state.active = false
    fs.writeFileSync(manifestPath, JSON.stringify(state), { mode: 0o600 })
    return 'restored'
  }
  for (const key of ['base', 'key', 'model']) {
    if (
      typeof input[key] !== 'string' ||
      !input[key] ||
      [...input[key]].some((character) => character.charCodeAt(0) < 32)
    ) {
      throw new Error('Invalid setup input')
    }
  }
  const url = new URL(input.base)
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  ) {
    throw new Error('Use an HTTPS endpoint')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid endpoint')
  }
  const base = input.base.replace(/\/+$/, '')
  const changes = {}
  if (input.client === 'codex') {
    const config = TOML.parse(read('config.toml'))
    config.model_provider = 'wukongai'
    config.model = input.model
    config.model_providers = config.model_providers || {}
    config.model_providers.wukongai = {
      name: 'WukongAi',
      base_url: `${base}/v1`,
      wire_api: 'responses',
      requires_openai_auth: true,
    }
    changes['config.toml'] = TOML.stringify(config)
    changes['auth.json'] =
      `${JSON.stringify({ OPENAI_API_KEY: input.key }, null, 2)}\n`
  } else if (input.client === 'claude') {
    const config = JSON.parse(read('settings.json') || '{}')
    config.env = {
      ...config.env,
      ANTHROPIC_BASE_URL: base,
      ANTHROPIC_AUTH_TOKEN: input.key,
      ANTHROPIC_MODEL: input.model,
    }
    delete config.env.ANTHROPIC_API_KEY
    changes['settings.json'] = `${JSON.stringify(config, null, 2)}\n`
  } else if (input.client === 'grok') {
    const config = TOML.parse(read('config.toml'))
    config.models = { ...config.models, default: 'wukongai' }
    config.model = config.model || {}
    config.model.wukongai = {
      model: input.model,
      base_url: `${base}/v1`,
      name: 'WukongAi',
      api_key: input.key,
      api_backend: 'chat_completions',
    }
    changes['config.toml'] = TOML.stringify(config)
    if (input.desktop) {
      changes['desktop-config.json'] = JSON.stringify(
        {
          'grok.defaultModel': 'wukongai',
          'grok.cliPath': input.desktopCli,
        },
        null,
        2
      )
    }
  } else {
    const patchFile = input.desktop
      ? 'profiles/desktop/cordis.patch.yml'
      : 'cordis.patch.yml'
    const patch = YAML.parse(read(patchFile)) || []
    if (!Array.isArray(patch)) throw new Error('Unsupported DSH patch format')
    const provider = patch.find((entry) => entry.id === 'llm-pi-ai') || {
      id: 'llm-pi-ai',
      name: '@deepseek-ai/dsh-llm-pi-ai',
    }
    provider.config = provider.config || {}
    provider.config.providers = {
      ...provider.config.providers,
      wukongai: {
        displayName: 'WukongAi',
        api: 'openai-completions',
        baseURL: `${base}/v1`,
        apiKeyEnv: 'WUKONGAI_API_KEY',
        models: [{ id: input.model, name: input.model }],
      },
    }
    if (!patch.includes(provider)) patch.push(provider)
    const selection = patch.find(
      (entry) => entry.id === 'agent-default-model'
    ) || {
      id: 'agent-default-model',
      name: '@deepseek-ai/dsh-agent-default-model',
    }
    selection.config = {
      ...selection.config,
      provider: 'wukongai',
      model: input.model,
    }
    if (!patch.includes(selection)) patch.push(selection)
    if (input.desktop) {
      delete provider.name
      delete selection.name
    }
    changes[patchFile] = YAML.stringify(patch)
    const credentials = YAML.parse(read('.credentials.yaml')) || {}
    if (
      input.desktop &&
      credentials.version !== undefined &&
      credentials.version !== 1
    ) {
      throw new Error('Unsupported desktop credential store version')
    }
    const existingRefs =
      credentials.version === 1 ? credentials.refs : credentials
    changes['.credentials.yaml'] = YAML.stringify(
      input.desktop
        ? {
            ...(credentials.version === 1 ? credentials : {}),
            version: 1,
            refs: { ...existingRefs, WUKONGAI_API_KEY: input.key },
          }
        : { ...credentials, WUKONGAI_API_KEY: input.key }
    )
  }
  fs.mkdirSync(snapshot, { recursive: true, mode: 0o700 })
  if (!state?.active) {
    state = { client: input.client, active: true, existed: {} }
    for (const file of files) {
      state.existed[file] = fs.existsSync(path.join(root, file))
      if (state.existed[file]) {
        fs.mkdirSync(path.dirname(path.join(snapshot, file)), {
          recursive: true,
        })
        fs.copyFileSync(path.join(root, file), path.join(snapshot, file))
      }
    }
    fs.writeFileSync(manifestPath, JSON.stringify(state), { mode: 0o600 })
  }
  try {
    for (const [file, content] of Object.entries(changes)) write(file, content)
  } catch (error) {
    configure(
      { client: input.client, mode: 'restore', desktop: input.desktop },
      root,
      dependencies
    )
    throw error
  }
  return 'configured'
}

export default configure

if (process.argv[2] === 'wukongai-config') {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''))
    process.stdout.write(
      `${configure(input, process.argv[3], process.argv[4])}\n`
    )
  } catch {
    process.stderr.write(
      'Configuration failed. Existing configuration or backup was preserved; check file format and permissions.\n'
    )
    process.exitCode = 1
  }
}
