// Do not rewrite output files whose content did not change.
//
// Taro's watch build re-emits every page config, base.wxml and many chunks on each rebuild,
// even when only one page changed. WeChat DevTools treats every rewritten file as changed:
// it recompiled all ~125 page configs (~0.8 s each) and all templates, the simulator launch
// timed out ("appServiceSDKScriptError timeout") and stayed on "编译 .wxml 文件错误" until
// someone clicked 编译. Leaving identical files untouched keeps their mtime, so DevTools only
// recompiles what really changed.
import fs from 'fs'
import path from 'path'

/** True when the file on disk already holds exactly `next`. */
export function isUnchangedOnDisk(existing: Buffer | null, next: string | Uint8Array): boolean {
  if (!existing) return false
  const nextBuffer = typeof next === 'string' ? Buffer.from(next, 'utf8') : Buffer.from(next)
  return existing.equals(nextBuffer)
}

function readIfExists(file: string): Buffer | null {
  try {
    return fs.readFileSync(file)
  } catch {
    return null
  }
}

interface BundleEntry {
  type: string
  fileName: string
  source?: string | Uint8Array
  code?: string
}

function outputContent(entry: BundleEntry): string | Uint8Array | undefined {
  return entry.type === 'chunk' ? entry.code : entry.source
}

/** Must run after weappCompPathPlugin so it compares the final output. */
export function weappSkipUnchangedPlugin() {
  let outDir = ''
  return {
    name: 'coachlink-weapp-skip-unchanged',
    enforce: 'post' as const,
    apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    generateBundle: {
      order: 'post' as const,
      handler(_options: unknown, bundle: Record<string, BundleEntry>) {
        if (!outDir) {
          console.warn('[skip-unchanged] outDir unknown, writing everything')
          return
        }
        let total = 0
        let kept = 0
        for (const [key, entry] of Object.entries(bundle)) {
          const content = outputContent(entry)
          if (content === undefined) continue
          total += 1
          if (!isUnchangedOnDisk(readIfExists(path.join(outDir, entry.fileName)), content)) continue
          delete bundle[key]
          kept += 1
        }
        if (kept > 0) console.log(`[skip-unchanged] wrote ${total - kept} of ${total} files; ${kept} were unchanged`)
      }
    }
  }
}
