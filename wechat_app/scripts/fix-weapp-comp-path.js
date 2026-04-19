/**
 * Fix comp path in page configs based on directory depth.
 * - dist/<pkg>/<page>.json (depth 1) -> "../comp"
 * - dist/<pkg>/<sub>/<page>.json (depth 2) -> "../../comp"
 * - dist/<pkg>/<sub>/<sub>/<page>.json (depth 3) -> "../../../comp"
 * etc.
 */
const fs = require('fs')
const path = require('path')
const { getWeappDistDir, getWeappOutputRoot } = require('./weapp-output-root')
const { ensureRootCompArtifacts } = require('./ensure-root-comp-artifacts')

const distDir = getWeappDistDir()
console.log('Using weapp output root:', getWeappOutputRoot())
ensureRootCompArtifacts(distDir)
if (!fs.existsSync(distDir)) {
  console.log('No dist folder, skip comp path fix.')
  process.exit(0)
}

function walkDir(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      walkDir(full, callback)
    } else if (e.isFile() && e.name.endsWith('.json')) {
      callback(full)
    }
  }
}

let fixed = 0
walkDir(distDir, (filePath) => {
  const relative = path.relative(distDir, filePath)
  if (relative === 'app.json' || relative === 'project.config.json' || relative === 'comp.json') return
  
  const dir = path.dirname(relative)
  const depth = dir ? dir.split(path.sep).length : 0
  if (depth === 0) return // root pages (e.g., pages/index)
  
  // Build expected path: "../comp", "../../comp", etc.
  const expectedPath = '../'.repeat(depth) + 'comp'
  const currentPath = '"' + '../'.repeat(depth) + 'comp"'
  
  let content = fs.readFileSync(filePath, 'utf8')
  // Match any number of ../ that doesn't match the expected depth
  const match = content.match(/"(\.\.\/)+comp"/)
  if (!match) return
  
  // Check if it's already correct
  if (match[0] === currentPath) return
  
  // Replace any "../comp" pattern with the correct depth
  content = content.replace(/"(\.\.\/)+comp"/g, currentPath)
  fs.writeFileSync(filePath, content)
  fixed++
  console.log('Fixed comp path:', relative, '->', currentPath)
})

console.log('WeApp comp paths fixed:', fixed, 'files.')
