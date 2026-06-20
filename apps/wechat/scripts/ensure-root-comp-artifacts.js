/**
 * Summer 编译器在解析分包页（如 coach/overview）时会按目录深度查找 ../../comp.json，
 * 即要求 dist 根目录存在 comp.*。热更新时 Taro 可能短暂清空或未先生成根 comp，
 * 导致白屏与 "Couldn't found the '../../comp.json' relative to 'coach/overview'"。
 * 在任意 fix 脚本运行前，从已生成的子包（优先 coach）兜底拷贝到 dist 根。
 */
const fs = require('fs')
const path = require('path')

const FILES = ['comp.json', 'comp.wxml', 'comp.wxss', 'comp.js']

function ensureRootCompArtifacts(distDir) {
  if (!fs.existsSync(distDir)) return

  const rootJson = path.join(distDir, 'comp.json')
  if (fs.existsSync(rootJson)) {
    let all = true
    for (const f of FILES) {
      if (!fs.existsSync(path.join(distDir, f))) {
        all = false
        break
      }
    }
    if (all) return
  }

  const donors = ['coach', 'me', 'streetlifting', 'auth']
  let donor = null
  for (const d of donors) {
    const p = path.join(distDir, d, 'comp.json')
    if (fs.existsSync(p)) {
      donor = path.join(distDir, d)
      break
    }
  }

  if (!donor) {
    console.warn('[ensure-root-comp] No donor subpackage comp; skip (run full build first).')
    return
  }

  for (const f of FILES) {
    const src = path.join(donor, f)
    const dest = path.join(distDir, f)
    if (!fs.existsSync(src)) continue
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest)
      console.log('[ensure-root-comp] Restored', f, '<-', path.relative(distDir, src))
    }
  }

  const rootWxss = path.join(distDir, 'comp.wxss')
  if (!fs.existsSync(rootWxss)) {
    fs.writeFileSync(rootWxss, '/* generated fallback */\n')
    console.log('[ensure-root-comp] Wrote fallback comp.wxss')
  }
}

module.exports = { ensureRootCompArtifacts }
