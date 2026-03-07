/**
 * 将 Lunacy .free 文件转换为 SVG
 * 严格遵循 FREE 格式规范: https://lunacy.docs.icons8.com/free-format/
 *
 * 要点:
 * - .free 为 ZIP，含 document.json、pages/<id>.json 等
 * - Page.Layers 顶层可为 FRAME；只导出「第一个 FRAME」的内容，viewBox = Frame.Size
 * - Layer.Transform: 简单时为 [TransX, TransY]，完整时为 [ScaleX, SkewX, TransX, SkewY, ScaleY, TransY]（仿射矩阵前两行）
 * - Vertex: [x, y, flags, radius, fromX, fromY, toX, toY]，路径点归一化 0~1，需乘 Layer.Size
 * - Color: 短 hex，如 "3"→#333333，"45F"→#4455FF
 * - 保持 GROUP/FRAME/SHAPE 的嵌套，每个 <g> 仅用该层自己的 transform，不输出 id
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const PATH_LAYER_TYPES = new Set(['PATH', 'OVAL', 'RECT', 'POLYGON', 'STAR', 'TRIANGLE']);

function convertFreeToSvg(inputPath, outputPath) {
    const buffer = fs.readFileSync(inputPath);
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        console.error('当前仅支持 .free 的 ZIP 格式（Lunacy 9.5+）');
        return;
    }

    const zip = new AdmZip(buffer);
    const docEntry = zip.getEntry('document.json');
    if (!docEntry) {
        console.error('无效的 .free 文件：缺少 document.json');
        return;
    }

    const doc = JSON.parse(docEntry.getData().toString('utf-8'));
    const pageIds = doc.pages || [];
    if (pageIds.length === 0) {
        console.error('文档中无页面');
        return;
    }

    const page = JSON.parse(
        zip.getEntry(`pages/${pageIds[0]}.json`).getData().toString('utf-8')
    );
    const pageLayers = page.layers || [];
    const frame = findFirstFrame(pageLayers);
    if (!frame) {
        console.error('未找到 FRAME');
        return;
    }

    const width = frame.size && frame.size[0] != null ? frame.size[0] : 520;
    const height = frame.size && frame.size[1] != null ? frame.size[1] : 1008;
    // 只导出 FRAME 内部的 layers，坐标系为 Frame 局部，不再套一层 frame 的 transform
    const rootLayers = frame.layers || [];

    /** FREE 短 hex → #RRGGBB（文档: "333333" 存为 "3"，"4455FF" 存为 "45F"） */
    function freeColorToHex(s) {
        if (s == null || typeof s !== 'string') return null;
        const t = String(s).replace(/\s/g, '');
        if (t.length === 1) return '#' + t.repeat(6);
        if (t.length === 2) return '#' + (t[0] + t[1]).repeat(3);
        if (t.length === 3) return '#' + t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
        if (t.length === 6 || t.length === 8) return '#' + t;
        return null;
    }

    function getLayerFill(layer, parentFill) {
        const fills = layer.fills && layer.fills[0];
        if (fills && fills.color != null) return freeColorToHex(fills.color);
        return parentFill;
    }

    /**
     * FREE Matrix: 简单 [TransX, TransY] 或完整 [ScaleX, SkewX, TransX, SkewY, ScaleY, TransY]
     * 文档: "translation matrix [1, 0, tx, 0, 1, ty]"
     * SVG matrix(a b c d e f): x'=ax+cy+e, y'=bx+dy+f → 对应 FREE 的 [a,b,e] 第一行 [c,d,f] 第二行
     * 即 SVG matrix(ScaleX, SkewY, SkewX, ScaleY, TransX, TransY)
     */
    function toSvgTransform(tr) {
        if (!tr || !Array.isArray(tr)) return '';
        if (tr.length >= 6) {
            const [a, b, c, d, e, f] = tr;
            return `matrix(${a} ${d} ${b} ${e} ${c} ${f})`;
        }
        if (tr.length >= 2) return `translate(${tr[0]} ${tr[1]})`;
        return '';
    }

    function findFirstFrame(layerList) {
        if (!layerList) return null;
        for (const l of layerList) {
            if (l._t === 'FRAME') return l;
            const inner = findFirstFrame(l.layers);
            if (inner) return inner;
        }
        return null;
    }

    /**
     * Vertex: [x, y, flags, radius, fromX, fromY, toX, toY]
     * 点坐标为归一化 0~1，乘 layer size 得局部像素坐标；闭合由 Path.Open === false 决定
     */
    function pointsToPathD(points, size, closed) {
        if (!points || points.length === 0) return '';
        const w = size[0] || 1;
        const h = size[1] || 1;
        const round = (v) => Math.round(v * 100) / 100;
        const scale = (x, y) => [round(x * w), round(y * h)];

        const parts = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const x = p[0];
            const y = p[1];
            const [px, py] = scale(x, y);
            if (i === 0) {
                parts.push(`M ${px} ${py}`);
                continue;
            }
            const prev = points[i - 1];
            const hasCurve =
                p.length >= 8 &&
                prev.length >= 8 &&
                (prev[6] != null && prev[7] != null || p[4] != null && p[5] != null);
            if (hasCurve) {
                const [outX, outY] = scale(prev[6], prev[7]);
                const [inX, inY] = scale(p[4], p[5]);
                parts.push(`C ${outX} ${outY} ${inX} ${inY} ${px} ${py}`);
            } else {
                parts.push(`L ${px} ${py}`);
            }
        }
        if (closed && points.length > 1) {
            parts.push('Z');
        }
        return parts.join(' ');
    }

    function processLayer(layer, parentSize, parentFill, indent) {
        if (layer.hidden) return '';

        const size = layer.size && layer.size.length >= 2 ? layer.size : parentSize;
        const fill = getLayerFill(layer, parentFill);
        const trAttr = toSvgTransform(layer.transform);
        const sp = '  '.repeat(indent);
        const openTag = trAttr
            ? `${sp}<g transform="${trAttr}">\n`
            : `${sp}<g>\n`;

        let inner = '';
        const hasPoints = layer.points && Array.isArray(layer.points) && layer.points.length > 0;
        if (PATH_LAYER_TYPES.has(layer._t) && hasPoints) {
            const closed = layer.open !== true;
            const d = pointsToPathD(layer.points, size, closed);
            if (d) {
                const fillAttr = fill ? ` fill="${fill}"` : ' fill="currentColor"';
                const closeCmd = closed ? ' Z' : '';
                inner += `${sp}  <path d="${d}${closeCmd}"${fillAttr} fill-rule="evenodd" />\n`;
            }
        }

        if (layer.layers && layer.layers.length > 0) {
            for (const sub of layer.layers) {
                inner += processLayer(sub, size, fill, indent + 1);
            }
        }

        return openTag + inner + `${sp}</g>\n`;
    }

    let body = '';
    for (const layer of rootLayers) {
        body += processLayer(layer, [width, height], null, 1);
    }

    const svgContent =
        `<?xml version="1.0" encoding="utf-8"?>\n` +
        `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">\n` +
        body +
        `</svg>`;

    fs.writeFileSync(outputPath, svgContent);
    console.log('转换成功！文件已保存至: ' + outputPath);
}

const inputPath = process.argv[2] || path.join(__dirname, '../docs/assets/body-front.free');
const outputPath = process.argv[3] || path.join(__dirname, '../docs/assets/body-front.svg');
convertFreeToSvg(inputPath, outputPath);
