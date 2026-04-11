/**
 * 修正 Taro 微信小程序构建产物中，各页面 index.json 里 comp 组件的相对路径。
 * 微信开发者工具的 summer-compiler 不支持多层相对路径 (>=3层)，本脚本修复为正确的路径。
 *
 * 使用方法: node scripts/fix-comp-path.js
 */
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist')

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return
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

function fixCompPath() {
  if (!fs.existsSync(distDir)) {
    console.log('[fix-comp-path] dist directory not found')
    return
  }

  let fixed = 0

  walkDir(distDir, (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8')
    const match = content.match(/"comp"\s*:\s*"((?:\.\.\/)+)comp"/)
    if (!match) return

    // 计算从 dist 到当前 json 所在目录的层级
    const rel = path.relative(distDir, path.dirname(filePath))
    const depth = rel.split(path.sep).filter(Boolean).length

    // 正确路径: depth 层 ../ 回到 dist，然后 /comp
    const needUp = depth
    const correctPath = Array(needUp).fill('..').join('/') + '/comp'

    // 如果路径已经正确，就不修改
    const currentPath = match[1] + 'comp'
    if (currentPath === correctPath) return

    const newContent = content.replace(
      /"comp"\s*:\s*"(?:\.\.\/)+comp"/,
      `"comp": "${correctPath}"`
    )
    fs.writeFileSync(filePath, newContent, 'utf8')
    fixed++
    const relPath = filePath.replace(distDir + path.sep, '')
    console.log(`[fix-comp-path] ${relPath} -> ${correctPath}`)
  })

  if (fixed > 0) {
    console.log(`[fix-comp-path] total fixed: ${fixed} file(s)`)
  } else {
    console.log('[fix-comp-path] no files need fixing')
  }
}

fixCompPath()
