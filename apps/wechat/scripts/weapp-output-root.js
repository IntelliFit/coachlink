const path = require('path')

function getWeappOutputRoot() {
  return process.env.WEAPP_OUTPUT_ROOT || 'dist'
}

function getWeappDistDir() {
  return path.resolve(__dirname, '..', getWeappOutputRoot())
}

module.exports = {
  getWeappOutputRoot,
  getWeappDistDir,
}
