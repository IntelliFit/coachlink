import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const sourceDirectory = path.resolve(scriptDirectory, '../src/assets/body-map')
const outputDirectory = path.join(sourceDirectory, 'poster')
const width = 308
const height = 500

const muscleGroups = {
  arms: ['大臂', '小臂'],
  back: ['背部'],
  chest: ['胸部'],
  core: ['腹部'],
  glutes: ['臀部'],
  legs: ['大腿', '小腿'],
  shoulders: ['肩部']
}

async function readSvgModule(fileName) {
  const moduleText = await readFile(path.join(sourceDirectory, fileName), 'utf8')
  const start = moduleText.indexOf('`')
  const end = moduleText.lastIndexOf('`')
  if (start < 0 || end <= start) throw new Error(`Invalid SVG module: ${fileName}`)
  return moduleText.slice(start + 1, end)
}

function baseSvg(svg) {
  return svg
    .replace(/fill:#fff/gi, 'fill:#D5D9D5')
    .replace(/fill="#fff"/gi, 'fill="#D5D9D5"')
}

function overlaySvg(svg, categories) {
  const selectors = categories
    .map((category) => `g[category="${category}"] path, g[category="${category}"] ellipse, g[category="${category}"] circle, g[category="${category}"] polygon`)
    .join(',\n')
  const style = `<style>
path, ellipse, circle, rect, polygon, polyline, line {
  fill-opacity: 0 !important;
  stroke-opacity: 0 !important;
}
${selectors} {
  fill: #CF6D4E !important;
  fill-opacity: 1 !important;
}
</style>`
  return svg.replace(/(<svg\b[^>]*>)/i, `$1${style}`)
}

async function render(svg, outputPath) {
  await sharp(Buffer.from(svg))
    .resize(width, height, { fit: 'contain' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outputPath)
}

await mkdir(outputDirectory, { recursive: true })

for (const side of ['front', 'back']) {
  const source = await readSvgModule(side === 'front' ? 'maleFrontSvg.ts' : 'maleBackSvg.ts')
  await render(baseSvg(source), path.join(outputDirectory, `${side}-base.png`))
  for (const [name, categories] of Object.entries(muscleGroups)) {
    await render(overlaySvg(source, categories), path.join(outputDirectory, `${side}-${name}.png`))
  }
}

await writeFile(
  path.join(outputDirectory, 'README.md'),
  '由 `apps/wechat/scripts/generate-workout-poster-bodymaps.mjs` 生成。训练分享图使用 PNG 底图与透明高亮层，避免微信真机 Canvas 对 SVG 支持不一致。\n',
  'utf8'
)
