const fs = require('fs')
const path = require('path')

const appRoot = path.join(__dirname, '..')
const repoRoot = path.join(appRoot, '..', '..')

function ensurePackageLink(packageName) {
  const target = path.join(repoRoot, 'node_modules', packageName)
  const link = path.join(appRoot, 'node_modules', packageName)

  if (!fs.existsSync(target) || fs.existsSync(link)) {
    return
  }

  fs.mkdirSync(path.dirname(link), { recursive: true })
  const relativeTarget = path.relative(path.dirname(link), target)
  fs.symlinkSync(relativeTarget, link, 'junction')
}

function ensureRootPackageLink(packageName) {
  const target = path.join(appRoot, 'node_modules', packageName)
  const link = path.join(repoRoot, 'node_modules', packageName)

  if (!fs.existsSync(target) || fs.existsSync(link)) {
    return
  }

  fs.mkdirSync(path.dirname(link), { recursive: true })
  const relativeTarget = path.relative(path.dirname(link), target)
  fs.symlinkSync(relativeTarget, link, 'junction')
}

function ensureWorkspaceDeps() {
  for (const packageName of ['react', 'react-dom']) {
    ensurePackageLink(packageName)
  }

  for (const packageName of ['@tarojs/taro']) {
    ensureRootPackageLink(packageName)
  }
}

module.exports = {
  ensureWorkspaceDeps,
}
