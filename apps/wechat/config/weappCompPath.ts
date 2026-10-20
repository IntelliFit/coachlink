// Write the correct "comp" path into page configs before Taro writes them to dist/.
//
// Taro emits some page configs with a "comp" path computed for the source folder
// (e.g. training/training-execution.json -> "../../comp", one level too deep).
// scripts/fix-weapp-comp-path.js used to correct it a few seconds after the write, and
// WeChat DevTools' compiler regularly compiled inside that gap, failed with
// "Couldn't found the '../../comp.json' file", and stayed on "编译 .wxml 文件错误"
// until someone clicked 编译. Fixing the asset in the bundle means the wrong path never
// reaches disk. The script stays as a safety net for files written outside the bundle.

const ROOT_CONFIGS = new Set(['app.json', 'project.config.json', 'project.private.config.json', 'comp.json'])
const COMP_PATH_PATTERN = /"(?:\.\.\/)+comp"/g

/** "../" once per folder level, so every page resolves the shared dist/comp. Null for root files. */
export function expectedCompPath(fileName: string): string | null {
  const normalized = fileName.replace(/\\/g, '/').replace(/^\/+/, '')
  if (ROOT_CONFIGS.has(normalized)) return null
  const depth = normalized.split('/').length - 1
  if (depth === 0) return null
  return '../'.repeat(depth) + 'comp'
}

/** Returns the corrected JSON text, or null when nothing needs to change. */
export function fixPageConfigCompPath(fileName: string, source: string): string | null {
  if (!fileName.endsWith('.json')) return null
  const expected = expectedCompPath(fileName)
  if (!expected) return null
  const quoted = `"${expected}"`
  const matches = source.match(COMP_PATH_PATTERN)
  if (!matches || matches.every((match) => match === quoted)) return null
  return source.replace(COMP_PATH_PATTERN, quoted)
}

interface BundleAsset {
  type: string
  fileName: string
  source?: string | Uint8Array
}

/** Vite/Rollup plugin: rewrites page config assets in generateBundle, after Taro has added them. */
export function weappCompPathPlugin() {
  return {
    name: 'coachlink-weapp-comp-path',
    enforce: 'post' as const,
    generateBundle: {
      order: 'post' as const,
      handler(_options: unknown, bundle: Record<string, BundleAsset>) {
        let fixed = 0
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.json')) continue
          const source = typeof asset.source === 'string'
            ? asset.source
            : asset.source ? Buffer.from(asset.source).toString('utf8') : ''
          const next = fixPageConfigCompPath(asset.fileName, source)
          if (next === null) continue
          asset.source = next
          fixed += 1
        }
        if (fixed > 0) console.log(`[comp-path] corrected ${fixed} page config(s) before writing dist`)
      }
    }
  }
}
