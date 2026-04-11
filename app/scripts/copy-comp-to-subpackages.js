/**
 * Copy comp.json (and related comp.* files) to each subpackage root so that
 * relative paths like "../../comp" or "../comp" will resolve correctly.
 * This fixes the Summer Compiler's stricter path resolution.
 */
const fs = require('fs')
const path = require('path')
const { getWeappDistDir, getWeappOutputRoot } = require('./weapp-output-root')

const distDir = getWeappDistDir()
console.log('Using weapp output root:', getWeappOutputRoot())

const subpackages = [
  'coach',
  'me',
  'discovery',
  'training',
  'content',
  'auth',
  'common',
  'streetlifting',
]

const compFiles = ['comp.json', 'comp.wxml', 'comp.wxss', 'comp.js']
const supportFiles = ['base.wxml', 'utils.wxs']
const allFilesToCopy = [...compFiles, ...supportFiles]

function copyIfChanged(src, dest) {
  if (!fs.existsSync(src)) return false

  if (fs.existsSync(dest)) {
    const srcBuf = fs.readFileSync(src)
    const dstBuf = fs.readFileSync(dest)
    if (srcBuf.equals(dstBuf)) {
      return false
    }
  }

  fs.copyFileSync(src, dest)
  return true
}

// 部分构建场景不会生成 dist/comp.wxss，这里兜底创建一个空文件，避免后续拷贝/编译告警
const rootCompWxss = path.join(distDir, 'comp.wxss')
if (!fs.existsSync(rootCompWxss)) {
  fs.writeFileSync(rootCompWxss, '/* generated fallback */\n')
  console.log('Generated fallback: comp.wxss')
}

// Check that source comp/support files exist
for (const file of allFilesToCopy) {
  const src = path.join(distDir, file)
  if (!fs.existsSync(src)) {
    console.log('Warning: source file not found:', file)
  }
}

for (const pkg of subpackages) {
  const pkgDir = path.join(distDir, pkg)
  if (!fs.existsSync(pkgDir)) {
    console.log('Warning: subpackage dir not found:', pkg)
    continue
  }

  for (const file of allFilesToCopy) {
    const src = path.join(distDir, file)
    const dest = path.join(pkgDir, file)
    if (copyIfChanged(src, dest)) {
      console.log('Copied:', file, '->', pkg + '/')
    }
  }
}

// Also copy to nested subpackage dirs (e.g. coach/settings)
// Also handle flat pages (pages that exist as files in parent dir, not in subdirs)
function copyCompFiles(targetDir) {
  const fullDir = path.join(distDir, targetDir)
  if (!fs.existsSync(fullDir)) return false

  let copied = false
  for (const file of allFilesToCopy) {
    const src = path.join(distDir, file)
    const dest = path.join(fullDir, file)
    if (copyIfChanged(src, dest)) {
      copied = true
    }
  }
  return copied
}

const nestedDirs = [
  'coach/settings',
  'coach/wallet',
  'coach/pricing',
  'coach/plan-lib',
  'coach/content',
  'coach/action-lib',
  'coach/questionnaire',
  'coach/videos',
  'coach/students',
  'coach/profile',
  'coach/plans',
  'coach/plans/dashboard',
  'coach/overview',
  'coach/application',
  'coach/revenue',
  'coach/my-profile',
  'me/payment',
  'me/membership',
  'me/plan-lib',
  'me/profile',
  'me/plan-history',
  'me/messages',
  'me/user',
  'me/cart',
  'me/friends',
  'me/toolbox',
  'me/purchase-history',
  'me/training-history',
  'me/feedback',
  'me/about',
  'me/contact',
  'me/disclaimer',
  'me/terms',
  'me/privacy',
  'me/docs',
  'me/my-coaches',
  'me/payment-waiting',
  'content/knowledge',
  'content/public',
  'discovery/ranking',
  'discovery/generate-plan',
  'discovery/index',
  'discovery/coach-profile',
  'discovery/market',
  'discovery/share',
  'training/plan',
  'training/impromptu-training',
  'training/plan/current',
  'training/training-execution',
  'training/action-detail',
  'training/action-edit',
  'training/actions',
  'training/copy-from-coach',
  'streetlifting/index',
  'streetlifting/index/submit',
  'auth/login',
  'auth/register',
  'auth/reset-password',
]

for (const dir of nestedDirs) {
  const copied = copyCompFiles(dir)
  if (copied) {
    console.log('Copied comp files to:', dir + '/')
  }
}

// ============================================================
// Fix comp path in page configs based on directory depth.
// ============================================================
function fixCompPaths() {
  let fixed = 0

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        walkDir(full)
      } else if (e.isFile() && e.name.endsWith('.json')) {
        const relative = path.relative(distDir, full)
        // Skip root config files
        if (relative === 'app.json' || relative === 'project.config.json' || relative === 'comp.json') continue

        const dir = path.dirname(relative)
        const depth = dir ? dir.split(path.sep).length : 0
        if (depth === 0) continue // root pages (e.g., pages/index)

        // Build expected path: "../comp", "../../comp", etc.
        const expectedPath = '"' + '../'.repeat(depth) + 'comp"'

        let content = fs.readFileSync(full, 'utf8')
        const match = content.match(/"(\.\.\/)+comp"/)
        if (!match) continue

        // Check if it's already correct
        if (match[0] === expectedPath) continue

        // Replace any "../comp" pattern with the correct depth
        content = content.replace(/"(\.\.\/)+comp"/g, expectedPath)
        fs.writeFileSync(full, content)
        fixed++
        console.log('Fixed comp path:', relative, '->', expectedPath)
      }
    }
  }

  if (fs.existsSync(distDir)) {
    walkDir(distDir)
  }

  console.log('WeApp comp paths fixed:', fixed, 'files.')
}

fixCompPaths()

console.log('Done copying comp files to subpackages.')
