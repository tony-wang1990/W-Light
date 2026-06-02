const Module = require('module')
const path = require('path')
const { buildSync } = require('esbuild')

const entry = path.join(__dirname, '..', 'test', 'toolbox-core.spec.ts')
const result = buildSync({
  entryPoints: [entry],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  sourcemap: 'inline',
})

const testModule = new Module(entry, module)
testModule.filename = entry
testModule.paths = Module._nodeModulePaths(path.dirname(entry))
testModule._compile(result.outputFiles[0].text, entry)
