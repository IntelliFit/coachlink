/**
 * WeChat expects page path like "auth/login" to have auth/login.wxml (and .js/.json/.wxss),
 * but Taro outputs auth/login/index.wxml. This script copies index.* to the path
 * WeChat expects (only for weapp build).
 * Same for streetlifting/index/xxx and other subpackage pages that use index subdir.
 */
const fs = require('fs')
const path = require('path')
const { getWeappDistDir, getWeappOutputRoot } = require('./weapp-output-root')

const distDir = getWeappDistDir()
console.log('Using weapp output root:', getWeappOutputRoot())
const extnames = ['.wxml', '.js', '.json', '.wxss']

const subpackagePagesWithIndex = [
  // auth 分包：微信请求 auth/login.*，Taro 输出 auth/login/index.*
  'auth/login',
  'auth/register',
  'auth/onboarding',
  'auth/wechat-auth',
  // streetlifting
  'streetlifting/index/calculator',
  'streetlifting/index/data',
  'streetlifting/index/locations',
  'streetlifting/index/methodology',
  'streetlifting/index/stories',
  'streetlifting/index/submit',
  'streetlifting/index/submit/success',
]

for (const pagePath of subpackagePagesWithIndex) {
  const baseName = path.basename(pagePath)
  const dir = path.dirname(pagePath)
  // pagePath: auth/login -> dir: auth, baseName: login
  // 原始在 pagePath/index.* (auth/login/index.*)，引用 ../../base.wxml
  // 复制到 dir/baseName.* (auth/login.*)，需要 ../base.wxml
  
  for (const ext of extnames) {
    const indexFile = path.join(distDir, pagePath, 'index' + ext)
    const targetFile = path.join(distDir, dir, baseName + ext)
    if (fs.existsSync(indexFile)) {
      let content = fs.readFileSync(indexFile, 'utf8')
      
      // 修复相对路径引用
      if (ext === '.wxml') {
        // auth/login/index.wxml 引用 ../../base.wxml (2层)
        // 复制到 auth/login.wxml 后只需要 ../base.wxml (1层)
        content = content
          .replace(/\.\.\/\.\.\/base\.wxml/g, '../base.wxml')
          .replace(/\.\.\/\.\.\/component\.wxml/g, '../component.wxml')
      }
      if (ext === '.wxss') {
        content = content
          .replace(/\.\.\/\.\.\/base\.wxss/g, '../base.wxss')
          .replace(/\.\.\/\.\.\/common\.wxss/g, '../common.wxss')
      }
      if (ext === '.js') {
        content = content
          .replace(/require\("\.\.\/\.\.\//g, 'require("../')
          .replace(/require\('\.\.\/\.\.\//g, "require('../")
      }
      
      fs.writeFileSync(targetFile, content)
      console.log('Fixed:', pagePath + ext, '->', path.relative(distDir, targetFile))
    }
  }
}

// 修复占位符 wxml：Taro 可能把占位符放在 page.wxml 或 page/index.wxml，真实内容在另一个里。
// 微信加载的是「页面路径」对应的文件，可能是平铺的 page.wxml，也可能是 page/index.wxml，需两种情况都修复。
// 支持任意深度的子目录（如 coach/students/detail）
const subpackageRoots = ['coach', 'discovery', 'training', 'content', 'common']
function isPlaceholderWxml(content) {
  if (!content) return false
  return (
    /<!--[\w/.-]+\.wxml-->/.test(content) ||
    /<text>[\w/.-]+\.wxml<\/text>/.test(content)
  )
}
function hasRealContent(content) {
  return content && (/<import\s+src=/.test(content) && /taro_tmpl/.test(content))
}
// 计算相对路径深度：count "../" 的数量
function countRelDepth(content) {
  const match = content.match(/\.\.(\/|$)/g)
  return match ? match.length : 0
}
// 将 ../base.wxml 按深度调整：depthFrom=2, depthTo=1 -> 去掉一层 ../
function adjustRelPath(content, oldPath, newPath, depthFrom, depthTo) {
  if (depthFrom === depthTo) return content
  const diff = depthFrom - depthTo
  if (diff <= 0) return content
  const prefix = '../'.repeat(depthTo)
  const oldPrefix = '../'.repeat(depthFrom)
  return content.split(oldPrefix + oldPath).join(prefix + newPath)
}

function readAllPagePathsFromAppJson() {
  const appJsonPath = path.join(distDir, 'app.json')
  if (!fs.existsSync(appJsonPath)) return []

  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
    const allPages = []

    if (Array.isArray(appJson.pages)) {
      for (const p of appJson.pages) {
        if (typeof p === 'string' && p) {
          allPages.push(p)
        }
      }
    }

    if (Array.isArray(appJson.subPackages)) {
      for (const sp of appJson.subPackages) {
        if (!sp || typeof sp.root !== 'string' || !Array.isArray(sp.pages)) continue
        for (const p of sp.pages) {
          if (typeof p !== 'string' || !p) continue
          allPages.push((sp.root + '/' + p).replace(/\/+/g, '/'))
        }
      }
    }

    return allPages
  } catch (error) {
    console.log('Warning: failed to parse app.json:', error.message)
    return []
  }
}

function ensureMissingFlatWxmlFromIndex() {
  const allPages = readAllPagePathsFromAppJson()
  let fixed = 0
  for (const pagePath of allPages) {
    const segments = pagePath.split('/').filter(Boolean)
    if (segments.length === 0) continue

    const flatWxml = path.join(distDir, ...segments) + '.wxml'
    const indexWxml = path.join(distDir, ...segments, 'index.wxml')

    if (fs.existsSync(flatWxml) || !fs.existsSync(indexWxml)) continue

    const indexContent = fs.readFileSync(indexWxml, 'utf8')
    if (!hasRealContent(indexContent)) {
      if (isPlaceholderWxml(indexContent)) {
        console.log('Skip missing flat wxml (index placeholder):', pagePath + '.wxml')
      }
      continue
    }

    // index.wxml 比平铺 .wxml 多一层目录深度
    const depthFrom = segments.length
    const depthTo = Math.max(0, depthFrom - 1)

    let content = adjustRelPath(indexContent, 'base.wxml', 'base.wxml', depthFrom, depthTo)
    content = adjustRelPath(content, 'component.wxml', 'component.wxml', depthFrom, depthTo)

    fs.mkdirSync(path.dirname(flatWxml), { recursive: true })
    fs.writeFileSync(flatWxml, content)
    fixed += 1
    console.log('Created missing flat wxml:', pagePath + '.wxml', '<- from index')
  }

  console.log('WeApp missing flat wxml fixed:', fixed, 'files.')
}

function scanDirForPlaceholders(dir, relDir = '') {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) {
      // 递归扫描子目录
      scanDirForPlaceholders(path.join(dir, e.name), relDir + '/' + e.name)
    } else if (e.isFile() && e.name.endsWith('.wxml') && e.name !== 'index.wxml') {
      const pageName = e.name.replace(/\.wxml$/, '')
      const pageWxml = path.join(dir, e.name)
      const indexWxml = path.join(dir, pageName, 'index.wxml')
      if (!fs.existsSync(indexWxml)) continue

      const pageContent = fs.readFileSync(pageWxml, 'utf8')
      const indexContent = fs.readFileSync(indexWxml, 'utf8')
      const isFlatPlaceholder = isPlaceholderWxml(pageContent)
      const isIndexPlaceholder = isPlaceholderWxml(indexContent) ||
        (indexContent.length < 200 && pageContent.length > indexContent.length)

      // 情况 A：平铺文件是占位符，index 是真实 → 用 index 覆盖平铺
      if (isFlatPlaceholder && hasRealContent(indexContent)) {
        const depthFrom = countRelDepth(indexContent) // index.wxml 里的 ../.. 数量
        const depthTo = depthFrom - 1 // 平铺文件少一层 ../
        let content = adjustRelPath(indexContent, 'base.wxml', 'base.wxml', depthFrom, depthTo)
        content = adjustRelPath(content, 'component.wxml', 'component.wxml', depthFrom, depthTo)
        fs.writeFileSync(pageWxml, content)
        console.log('Fixed placeholder (flat):', relDir.slice(1) + '/' + e.name, '<- from index')
      }
      // 情况 B：index 是占位符，平铺是真实 → 用平铺覆盖 index
      else if (isIndexPlaceholder && hasRealContent(pageContent)) {
        const depthFrom = countRelDepth(pageContent) // 平铺文件里的 ../ 数量
        const depthTo = depthFrom + 1 // index.wxml 多一层 ../
        let content = adjustRelPath(pageContent, 'base.wxml', 'base.wxml', depthFrom, depthTo)
        content = adjustRelPath(content, 'component.wxml', 'component.wxml', depthFrom, depthTo)
        fs.writeFileSync(indexWxml, content)
        console.log('Fixed placeholder (index):', relDir.slice(1) + '/' + pageName + '/index.wxml', '<- from', e.name)
      }
    }
  }
}

for (const pkg of subpackageRoots) {
  scanDirForPlaceholders(path.join(distDir, pkg), '/' + pkg)
}

ensureMissingFlatWxmlFromIndex()

console.log('WeApp page paths fixed.')
