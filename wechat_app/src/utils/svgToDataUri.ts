/**
 * 将 SVG 字符串转为微信小程序 Image 组件可用的 data URI
 * - 移除 XML 声明（避免渲染异常）
 * - 使用 URL 编码（比 base64 更可靠，小程序 Image 组件兼容更好）
 */
export function svgToDataUri(svg: string): string {
  // 移除 XML 声明和注释头
  const clean = svg
    .replace(/^\s*<\?xml[^?]*\?>\s*/, '')
    .replace(/^\s*<!--[\s\S]*?-->\s*/, '')
    .trim()

  // URL 编码方式：兼容性优于 base64，且长度更短
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`
}
