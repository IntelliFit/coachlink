/**
 * 批量为页面组件根节点添加 theme-${effectiveTheme} className
 *
 * 策略：使用 Babel AST 定位修改点，但只修改原始代码字符串的局部片段，
 * 以最大限度保留原有格式。
 */

const fs = require('fs')
const path = require('path')
const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse').default
const t = require('@babel/types')

const SRC_DIR = path.resolve(__dirname, '../src')
const APP_CONFIG_PATH = path.resolve(SRC_DIR, 'app.config.ts')

function getPageFiles() {
  const configCode = fs.readFileSync(APP_CONFIG_PATH, 'utf-8')
  const ast = parse(configCode, {
    sourceType: 'module',
    plugins: ['typescript']
  })

  const pages = []
  const subPackages = []

  function extractStringArray(arrayExpr) {
    const result = []
    if (!t.isArrayExpression(arrayExpr)) return result
    for (const elem of arrayExpr.elements) {
      if (t.isStringLiteral(elem)) result.push(elem.value)
    }
    return result
  }

  traverse(ast, {
    ObjectProperty(path) {
      const key = path.node.key
      const keyName = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : ''
      if (keyName === 'pages') {
        pages.push(...extractStringArray(path.node.value))
      } else if (keyName === 'subPackages') {
        const arrayExpr = path.node.value
        if (t.isArrayExpression(arrayExpr)) {
          for (const pkg of arrayExpr.elements) {
            if (!t.isObjectExpression(pkg)) continue
            let root = ''
            let pkgPages = []
            for (const prop of pkg.properties) {
              if (!t.isObjectProperty(prop)) continue
              const propKey = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : ''
              if (propKey === 'root' && t.isStringLiteral(prop.value)) {
                root = prop.value.value
              } else if (propKey === 'pages') {
                pkgPages = extractStringArray(prop.value)
              }
            }
            for (const p of pkgPages) {
              subPackages.push(`${root}/${p}`)
            }
          }
        }
      }
    }
  })

  const allPagePaths = [...pages, ...subPackages]
  const files = []
  for (const pagePath of allPagePaths) {
    const directFile = path.resolve(SRC_DIR, `${pagePath}.tsx`)
    const indexFile = path.resolve(SRC_DIR, `${pagePath}/index.tsx`)
    // Taro 页面通常是一个目录 + index.tsx，优先使用目录形式
    if (fs.existsSync(indexFile)) {
      files.push(indexFile)
    } else if (fs.existsSync(directFile)) {
      files.push(directFile)
    } else {
      console.warn(`⚠️  页面文件不存在: ${directFile} 或 ${indexFile}`)
    }
  }
  return files
}

function isPageRootElement(element) {
  if (!t.isJSXElement(element)) return false
  const name = element.openingElement.name
  const tagName = t.isJSXIdentifier(name) ? name.name : ''
  return ['View', 'ScrollView', 'Swiper', 'Block'].includes(tagName)
}

function getClassNameAttr(openingElement) {
  return openingElement.attributes.find(
    attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'className'
  )
}

function processFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8')
  let modifiedCode = code
  // 由于会从后往前替换，记录 (offset, replacement) 列表
  const replacements = []

  let ast
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true
    })
  } catch (err) {
    console.error(`❌ 解析失败: ${filePath}`, err.message)
    return false
  }

  let hasUseThemeImport = false
  let lastImportEnd = 0

  traverse(ast, {
    ImportDeclaration(path) {
      lastImportEnd = Math.max(lastImportEnd, path.node.end)
      if (path.node.source.value === '@/hooks/useTheme') {
        hasUseThemeImport = true
      }
    }
  })

  let fnPath = null
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration
      if (t.isFunctionDeclaration(decl)) {
        fnPath = path.get('declaration')
      } else if (t.isArrowFunctionExpression(decl)) {
        fnPath = path.get('declaration')
      } else if (t.isIdentifier(decl)) {
        const name = decl.name
        path.scope.path.traverse({
          FunctionDeclaration(fnPath2) {
            if (fnPath2.node.id && fnPath2.node.id.name === name && !fnPath) {
              fnPath = fnPath2
            }
          }
        })
      }
    }
  })

  if (!fnPath) {
    console.warn(`⚠️  未找到默认导出的函数组件: ${filePath}`)
    return false
  }

  const fnBody = fnPath.node.body
  if (!t.isBlockStatement(fnBody)) {
    console.warn(`⚠️  默认导出不是块级函数体: ${filePath}`)
    return false
  }

  // 检查函数体内是否已有 effectiveTheme 的 useTheme 解构
  const hasHook = fnBody.body.some(
    stmt =>
      t.isVariableDeclaration(stmt) &&
      stmt.declarations.some(
        decl =>
          t.isVariableDeclarator(decl) &&
          t.isObjectPattern(decl.id) &&
          decl.id.properties.some(
            prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'effectiveTheme'
          ) &&
          t.isCallExpression(decl.init) &&
          t.isIdentifier(decl.init.callee) &&
          decl.init.callee.name === 'useTheme'
      )
  )

  // 1. 收集需要替换的 className 字符串字面量
  const classNameTargets = []
  fnPath.traverse({
    ReturnStatement(returnPath) {
      if (returnPath.getFunctionParent() !== fnPath) return
      const arg = returnPath.node.argument
      if (!arg || !isPageRootElement(arg)) return

      const classAttr = getClassNameAttr(arg.openingElement)
      if (!classAttr) return

      if (t.isStringLiteral(classAttr.value)) {
        const val = classAttr.value.value
        // 已包含 theme- 的跳过（粗略判断）
        if (val.includes('theme-')) return
        classNameTargets.push({
          start: classAttr.value.start,
          end: classAttr.value.end,
          quote: code[classAttr.value.start], // ' 或 "
          value: val
        })
      }
    }
  })

  if (classNameTargets.length === 0 && hasHook) {
    return false
  }

  // 2. 处理 import：确保 useTheme 被导入
  if (!hasUseThemeImport) {
    const importLine = `\nimport { useTheme } from '@/hooks/useTheme'`
    replacements.push({
      start: lastImportEnd,
      end: lastImportEnd,
      text: importLine
    })
  }

  // 3. 处理 hook 调用
  if (!hasHook) {
    // 推断函数体内部语句的缩进
    let bodyIndent = '  '
    const bodyInner = code.slice(fnBody.start + 1, fnBody.end - 1)
    const lines = bodyInner.split(/\r?\n/)
    for (const line of lines) {
      if (line.trim()) {
        const match = line.match(/^(\s*)/)
        if (match) {
          bodyIndent = match[1]
          break
        }
      }
    }
    const hookText = `\n${bodyIndent}const { effectiveTheme } = useTheme()`
    replacements.push({
      start: fnBody.start + 1, // '{' 之后
      end: fnBody.start + 1,
      text: hookText
    })
  }

  // 4. 替换 className 字符串为模板字符串
  for (const target of classNameTargets) {
    const { quote, value, start, end } = target
    const newText = `{\`${value} theme-\${effectiveTheme}\`}`
    replacements.push({ start, end, text: newText })
  }

  // 5. 从后往前替换
  replacements.sort((a, b) => b.start - a.start)
  for (const r of replacements) {
    modifiedCode = modifiedCode.slice(0, r.start) + r.text + modifiedCode.slice(r.end)
  }

  if (modifiedCode !== code) {
    fs.writeFileSync(filePath, modifiedCode, 'utf-8')
    console.log(`✅ 已更新: ${filePath}`)
    return true
  }

  return false
}

function main() {
  const files = getPageFiles()
  console.log(`共找到 ${files.length} 个页面文件`)
  let updatedCount = 0
  for (const file of files) {
    if (processFile(file)) updatedCount++
  }
  console.log(`\n完成：更新了 ${updatedCount} 个文件`)
}

main()
