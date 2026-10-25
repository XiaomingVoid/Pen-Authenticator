'use strict'

const ts = require('typescript')

// Reuse the app's TypeScript compiler for syntax Webpack 3 / Acorn 5 predates.
// This loader is a syntax transform; the application's tsc check owns type checking.
module.exports = function (source) {
  this.cacheable()
  const result = ts.transpileModule(source, {
    fileName: this.resourcePath.replace(/\.vue$/i, '.js'),
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.ESNext,
      allowJs: true,
      isolatedModules: true,
    },
  })
  const errors = (result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) {
    throw new Error(this.resourcePath + ': ' + errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'))
  }
  return result.outputText
}
