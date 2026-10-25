'use strict'

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

function compile(webpack, config, stage) {
  return new Promise((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) return reject(error)
      if (!stats || typeof stats.hasErrors !== 'function') return reject(new Error(stage + ': webpack returned no stats'))
      try {
        const summary = stats.toString({ colors: false, modules: false, errorDetails: true })
        if (stats.hasErrors()) return reject(new Error(stage + ': ' + summary))
        console.log(summary)
        resolve(stats)
      } catch (error) { reject(error) }
    })
  })
}

function localPath(root, from, reference) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) return null
  const name = decodeURIComponent(reference.split(/[?#]/, 1)[0])
  if (!name) return null
  const target = path.resolve(name.startsWith('/') ? root : path.dirname(from), name.replace(/^\/+/, ''))
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('resource escapes Web output: ' + reference)
  }
  return target
}

function requireFile(file) {
  const stat = fs.statSync(file)
  if (!stat.isFile() || stat.size === 0) throw new Error('missing or empty Web resource: ' + file)
}

function validateResources(output, files, runtimeTarget) {
  for (const name of files) {
    if (!/\.(?:html|css)$/i.test(name)) continue
    const file = path.resolve(output, name)
    const text = fs.readFileSync(file, 'utf8')
    const references = []
    if (/\.html$/i.test(name)) {
      for (const match of text.matchAll(/\b(?:src|href)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) {
        references.push(match[1] || match[2] || match[3])
      }
    }
    for (const match of text.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi)) {
      references.push(match[1] || match[2] || match[3])
    }
    for (const reference of references) {
      const target = localPath(output, file, reference)
      // The genuine CLI runtime is published only after every other check succeeds.
      if (target !== null && target !== runtimeTarget) requireFile(target)
    }
  }
}

async function main() {
  const root = process.cwd()
  const output = path.resolve(root, 'dist')
  const fromApp = createRequire(path.resolve(root, 'package.json'))
  const cliPackage = fromApp.resolve('aiot-vue-cli/package.json')
  const fromCli = createRequire(cliPackage)
  const cliRoot = path.dirname(cliPackage)
  const runtimeSource = path.join(cliRoot, 'cli-libs/falcon-jsfm/dist/falcon-js-web.js')
  const runtimeTarget = path.join(output, 'falcon-js-web.js')
  requireFile(runtimeSource)
  const info = fromCli('./src/libs/appinfo.js')
  if (!await info.init(root) || !info.isValidRoot()) throw new Error('invalid application root: ' + root)

  const webpack = fromCli('webpack')
  const configs = fromCli('./src/webpreview/index.js').webpackConf
  const dll = configs.buildDll()(true)
  if (path.resolve(dll.output.path) !== output) throw new Error('unexpected DLL output path')
  await compile(webpack, dll, 'DLL')
  const web = await configs.buildWeb()
  if (path.resolve(web.output.path) !== output) throw new Error('unexpected Web output path')
  const stats = await compile(webpack, web, 'Web')

  const app = JSON.parse(fs.readFileSync(path.resolve(root, 'src/app.json'), 'utf8'))
  const entries = ['_preview.app.html', ...Object.keys(app.pages || {}).map(page => page + '.html')]
  for (const name of entries) {
    const target = localPath(output, path.join(output, '_preview.app.html'), name)
    if (!target) throw new Error('invalid Web entry: ' + name)
    requireFile(target)
  }
  const assets = stats.compilation && stats.compilation.assets
  if (!assets || typeof assets !== 'object') throw new Error('webpack returned no asset inventory')
  for (const name of entries) {
    if (!Object.prototype.hasOwnProperty.call(assets, name)) throw new Error('Web entry not emitted: ' + name)
  }

  // CLI dev-server contentBase supplied these files implicitly; a standalone build must carry them.
  for (const source of [path.join(cliRoot, 'src/webpreview/assets'), path.join(root, 'assets')]) {
    if (fs.existsSync(source)) fs.cpSync(source, path.join(output, 'assets'), { recursive: true })
  }
  const files = Object.keys(assets)
  validateResources(output, files, runtimeTarget)
  fs.copyFileSync(runtimeSource, runtimeTarget)
  console.log('[build:web] success: ' + path.join(output, '_preview.app.html'))
}

main().catch(error => {
  console.error('[build:web] ' + (error.stack || error))
  process.exitCode = 1
})
