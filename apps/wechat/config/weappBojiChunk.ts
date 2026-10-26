// Keep the 薄肌检测器 code in the toolbox subpackage instead of the main package.
//
// Taro's vite runner puts every module with more than one importer into `common.js`, which
// WeChat loads with the main package — even when all importers live in one subpackage. The
// boji page is split into a dozen components that share the core helpers and the cover image,
// so after the 2026-10-26 redesign they pushed the main package past WeChat's 2 MB limit and
// the upload was refused. This routes those scripts into `toolbox/boji-common.js`; only pages
// inside the toolbox subpackage import them, so the subpackage can require that file.
// Stylesheets are left to Taro: a CSS chunk outside `common` would not be imported by any page.

const BOJI_MODULE_PATTERNS: RegExp[] = [
  /[\\/]src[\\/]toolbox[\\/]boji[\\/][^\\/]+\.(ts|tsx)$/,
  /[\\/]packages[\\/]core[\\/]src[\\/]boji[A-Za-z]*\.ts$/,
  /[\\/]src[\\/]services[\\/]bojiDetectorService\.ts$/,
  /[\\/]toolbox-practical[\\/]practical-boji-detector-v\d+\.webp$/,
]

export const BOJI_CHUNK_NAME = 'toolbox/boji-common'

/** True for boji scripts and the boji cover; never for stylesheets or the page entry itself. */
export function isBojiChunkModule(id: string): boolean {
  const file = id.split('?')[0]
  if (/[\\/]src[\\/]toolbox[\\/]boji[\\/]index\.tsx$/.test(file)) return false
  return BOJI_MODULE_PATTERNS.some((pattern) => pattern.test(file))
}

type ManualChunks = (id: string, api: unknown) => string | null | undefined

interface OutputOptions {
  manualChunks?: ManualChunks | Record<string, string[]>
}

export function weappBojiChunkPlugin() {
  return {
    name: 'weapp-boji-subpackage-chunk',
    outputOptions(options: OutputOptions) {
      const original = options.manualChunks
      if (typeof original !== 'function') return null
      return {
        ...options,
        manualChunks: (id: string, api: unknown) => (isBojiChunkModule(id) ? BOJI_CHUNK_NAME : original(id, api)),
      }
    },
  }
}
