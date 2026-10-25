'use strict'

const fs = require('fs')
const path = require('path')
const cli = path.resolve(__dirname, '../node_modules/aiot-vue-cli')
const changes = []

function replaceRequired(source, before, after) {
  if (source.includes(after)) {
    if (source.split(after).length !== 2) throw new Error('duplicate patch anchor: ' + after)
    return source
  }
  if (source.split(before).length !== 2) throw new Error('unrecognized CLI layout; expected one anchor: ' + before)
  return source.replace(before, after)
}

function patchSdkResolver(source) {
  // Migrate early resolver-only patches without duplicating their Rollup hook.
  source = source.replace("require('../../../../scripts/sdk-exports.cjs').rollup(info.getAppRoot()),\n      nodeResolve(),", 'nodeResolve(),')
  source = replaceRequired(source, 'pluginFalconModule() //', 'nativeModules //')
  source = replaceRequired(source, 'const input = {', 'const nativeModules = pluginFalconModule()\n  const input = {')
  return replaceRequired(source, 'nodeResolve(),', "require('../../../../scripts/sdk-exports.cjs').rollup(info.getAppRoot(), nativeModules),\n      nodeResolve(),")
}

function patch(file, transform) {
  const filename = path.join(cli, file)
  const original = fs.readFileSync(filename, 'utf8')
  let updated
  try { updated = transform(original.replace(/\r\n/g, '\n')) } catch (error) {
    throw new Error(file + ': ' + error.message)
  }
  if (original.includes('\r\n')) updated = updated.replace(/\n/g, '\r\n')
  changes.push({ filename, original, updated })
}

try {
  patch('src/libs/rollup.config.js', source => {
    // Normalize the duplicate TypeScript plugins left by earlier postinstall versions.
    source = source.replace(/(?:require\('@rollup\/plugin-typescript'\)\((?:\{\s*noEmitOnError:\s*true\s*\})?\),)+/g, '')
    source = replaceRequired(source, 'commonjs(),', "commonjs(),require('@rollup/plugin-typescript')({ noEmitOnError: true }),")
    source = patchSdkResolver(source)
    return replaceRequired(source, 'const replaceValues = {}', "const replaceValues = { 'defineComponent': '' }")
  })
  patch('src/libs/rollup.config.service.js', patchSdkResolver)
  patch('web-loaders/falcon-vue-loader/lib/parser.js', source => replaceRequired(source,
    "compiler.parseComponent(content, { pad: 'line' })", "compiler.parse(content, { pad: 'line' }).descriptor"))
  patch('cli-libs/index.js', source => replaceRequired(source,
    "path.resolve(__dirname, './vue/packages/vue-template-compiler/index.js')", "'@vue/compiler-sfc'"))
  patch('src/libs/parser.js', source => replaceRequired(source,
    'compiler.parseComponent(content, { pad: true })', 'compiler.parse(content, { pad: true }).descriptor'))
  patch('web-loaders/falcon-vue-loader/lib/template-compiler/index.js', source => {
    source = source.replace(/compiler\.compile(?:Template)+/g, 'compiler.compile')
    if (!/\bcompiler\.compile\b/.test(source)) throw new Error('Vue 2 render compiler anchor missing')
    // The Web loader consumes render/staticRenderFns, not Vue 3 compileTemplate output.
    return replaceRequired(source, "require('../../../../cli-libs/index.js')['vue-template-compiler']",
      "require('../../../../cli-libs/vue/packages/vue-template-compiler/build.js')")
  })
  patch('src/webpreview/configs/config.js', source => {
    const before = '(weex|falcon)'
    const after = String.raw`(weex|falcon|@dictpen(?:\/|\\)core)`
    if (source.split(after).length === 3 && !source.includes(before)) return source
    if (source.split(before).length !== 3) throw new Error('Web loader/watch exclusion anchors missing')
    return source.split(before).join(after)
  })
  patch('src/webpreview/configs/webpack.common.conf.js', source => {
    const loader = "require.resolve('../../../../../scripts/web-script-loader.cjs')"
    source = replaceRequired(source, 'const devRules = []',
      'const devRules = [{ test: /\\.[jt]s$/, use: [{ loader: ' + loader + ' }], exclude: config.excludeModuleReg }]')
    source = replaceRequired(source, 'jsLoaders: previewOptions.jsLoaders',
      'jsLoaders: [' + loader + '].concat(previewOptions.jsLoaders || [])')
    source = replaceRequired(source, "extensions: ['.js', '.vue', '.json']", "extensions: ['.js', '.ts', '.vue', '.json']")
    source = replaceRequired(source, "path.resolve(__dirname, '../../../node_modules')", "path.resolve(appInfo.getAppRoot(), 'node_modules')")
    return replaceRequired(source, 'resolve: {', "resolve: {\n      plugins: [require('../../../../../scripts/sdk-exports.cjs').webpack(appInfo.getAppRoot())],")
  })
  patch('src/webpreview/configs/webpack.build.web.conf.js', source => {
    // The upstream async IIFE loses rejections and leaves its outer promise pending.
    const fixed = 'module.exports = getBuildWebpackConfig()'
    if (source.includes(fixed)) return source
    const legacy = /module\.exports = new Promise\(\(resolve, reject\) => \{\s*\(async function \(\) \{\s*buildWebpackConfig = await getBuildWebpackConfig\(\)\s*resolve\(buildWebpackConfig\)\s*\}\)\(\)\s*\}\)/
    if (!legacy.test(source)) throw new Error('Web configuration promise anchor missing')
    return source.replace(legacy, fixed)
  })

  // Validate every expected layout before writing, so drift is an installation error.
  for (const { filename, original, updated } of changes) {
    if (updated !== original) fs.writeFileSync(filename, updated)
  }
  console.log('[patch-cli] aiot-vue-cli patches verified')
} catch (error) {
  console.error('[patch-cli] ' + error.message)
  process.exitCode = 1
}
