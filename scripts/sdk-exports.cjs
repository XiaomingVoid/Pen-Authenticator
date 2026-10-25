'use strict'

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

// Node is the authority for package.exports (including patterns and linked packages).
// Keep one resolver for the legacy Rollup and Webpack pipelines; do not mirror exports.
function coreResolver(appRoot) {
  const fromApp = createRequire(path.resolve(appRoot, 'package.json'))
  return id => {
    if (typeof id !== 'string' || (id !== '@dictpen/core' && !id.startsWith('@dictpen/core/'))) return null
    return fromApp.resolve(id)
  }
}

function nativeAliases(appRoot) {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(appRoot, 'package.json'), 'utf8'))
  if (!Object.prototype.hasOwnProperty.call(pkg, 'nativeModuleAliases')) return {}
  const aliases = pkg.nativeModuleAliases
  const nativeName = /^\$?[a-zA-Z_][a-zA-Z0-9_.]*$/
  if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
    throw new Error('nativeModuleAliases must be an object of native module names')
  }
  for (const [name, target] of Object.entries(aliases)) {
    if (!nativeName.test(name) || typeof target !== 'string' || !nativeName.test(target)) {
      throw new Error('nativeModuleAliases requires bare native module names: ' + name)
    }
  }
  return aliases
}

exports.rollup = function (appRoot, nativeModules) {
  const resolveCore = coreResolver(appRoot)
  const aliases = nativeAliases(appRoot)
  return {
    name: 'dictpen-exports',
    resolveId(id, importer) {
      // Opt-in, native-only compatibility mapping. No module availability is inferred.
      if (Object.prototype.hasOwnProperty.call(aliases, id)) {
        if (!nativeModules || typeof nativeModules.resolveId !== 'function') {
          throw new Error('nativeModuleAliases requires the Falcon native-module resolver')
        }
        // Reuse its registry as well as its resolution, so qjsc receives the same -M modules.
        return nativeModules.resolveId.call(this, aliases[id], importer)
      }
      return resolveCore(id)
    },
  }
}

exports.webpack = function (appRoot) {
  const resolveCore = coreResolver(appRoot)
  return {
    apply(resolver) {
      resolver.plugin('described-resolve', (request, callback) => {
        let target
        try { target = resolveCore(request.request) } catch (error) { return callback(error) }
        if (target === null) return callback()
        return resolver.doResolve('resolve', { ...request, request: target }, 'SDK package.exports', callback)
      })
    },
  }
}
