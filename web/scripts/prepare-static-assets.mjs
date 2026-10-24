import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const entry = path.join(dist, 'index.html')
let html = await readFile(entry, 'utf8')
let stylesheets = 0
html = html.replaceAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (tag) => {
  stylesheets++
  // The small inline shell renders while the application CSS loads. Reveal
  // React only after both its route and styles are ready, avoiding a flash.
  return (
    tag.replace(
      'rel="stylesheet"',
      'rel="preload" as="style" data-app-stylesheet onload="this.onload=null;this.rel=\'stylesheet\';document.documentElement.setAttribute(\'data-app-styles-ready\',\'true\')"'
    ) + `<noscript>${tag}</noscript>`
  )
})
if (stylesheets !== 1) throw new Error('Expected one application stylesheet')
await writeFile(entry, html)

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
console.log(`Prepared nonblocking stylesheet and ${files} compressed assets`)
