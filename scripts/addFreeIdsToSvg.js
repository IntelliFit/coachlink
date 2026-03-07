/**
 * 为 front/back 两种配置的 SVG 打上 id 与 data-name（来自对应 .free）。
 * - id：FREE 的 ShortGUID
 * - data-name：图层名称（肌肉/关节等）
 *
 * 用法:
 *   node scripts/addFreeIdsToSvg.js                    # front: body-front.free → front.svg
 *   node scripts/addFreeIdsToSvg.js back               # back:  body-back.free  → body-back.svg
 *   node scripts/addFreeIdsToSvg.js <free路径> <svg路径>
 *   node scripts/addFreeIdsToSvg.js --list [front|back]  # 仅解析 .free 并打印图层结构（不打 SVG）
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const assetsDir = path.join(__dirname, '../docs/assets');
const CONFIGS = {
  front: {
    free: path.join(assetsDir, 'body-front.free'),
    svg: path.join(assetsDir, 'body-front.svg')
  },
  back: {
    free: path.join(assetsDir, 'body-back.free'),
    svg: path.join(assetsDir, 'body-back.svg')
  }
};

const arg1 = process.argv[2];
const arg2 = process.argv[3];
let freePath, svgPath, listOnly = false, listProfile = null;
if (arg1 === '--list') {
  listOnly = true;
  listProfile = arg2 || 'front';
  freePath = CONFIGS[listProfile] ? CONFIGS[listProfile].free : null;
} else if (arg1 === 'back' && !arg2) {
  freePath = CONFIGS.back.free;
  svgPath = CONFIGS.back.svg;
} else if (arg1 === 'front' && !arg2) {
  freePath = CONFIGS.front.free;
  svgPath = CONFIGS.front.svg;
} else if (arg1 && arg2) {
  freePath = arg1;
  svgPath = arg2;
} else {
  freePath = CONFIGS.front.free;
  svgPath = CONFIGS.front.svg;
}

// 从 .free 提取图层列表。顶层语义：最外层为 frameme，其下三个平级组为 全身轮廓、肌肉、关节，其余按 DFS。
function getFreeLayerLists(freePath) {
  const buffer = fs.readFileSync(freePath);
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('not a zip');
  const zip = new AdmZip(buffer);
  const doc = JSON.parse(zip.getEntry('document.json').getData().toString('utf-8'));
  const page = JSON.parse(zip.getEntry('pages/' + doc.pages[0] + '.json').getData().toString('utf-8'));

  function findFrame(layers) {
    if (!layers) return null;
    for (const l of layers) {
      if (l._t === 'FRAME') return l;
      const r = findFrame(l.layers); if (r) return r;
    }
    return null;
  }
  const frame = findFrame(page.layers);
  if (!frame || !frame.layers) throw new Error('no frame');

  const GROUP_TYPES = new Set(['GROUP', 'FRAME', 'SHAPE', 'SECTION', 'STATES', 'COMPONENT', 'INSTANCE']);
  const PATH_TYPES = new Set(['PATH', 'OVAL', 'RECT', 'POLYGON', 'STAR', 'TRIANGLE']);

  const dfsGroups = [];
  const pathList = [];

  function dfs(layers, parentId) {
    if (!layers) return;
    for (const l of layers) {
      if (l.hidden) continue;
      const t = l._t;
      const name = (l.name != null && String(l.name).trim() !== '') ? String(l.name).trim() : '';
      if (GROUP_TYPES.has(t)) {
        dfsGroups.push({ id: l.id, name, parentId });
        dfs(l.layers, l.id);
      } else if (PATH_TYPES.has(t)) {
        pathList.push({ id: l.id, name, parentId });
      }
    }
  }
  dfs(frame.layers, frame.id);

  // 正确层次：第 1 个 <g> = frameme（frame 自身），第 2~4 个 = 全身轮廓、肌肉、关节（平级），其余按 DFS
  const topNames = ['全身轮廓', '肌肉', '关节'];
  const byName = {};
  for (const g of dfsGroups) {
    if (topNames.includes(g.name)) byName[g.name] = g;
  }
  const rest = dfsGroups.filter(g => !topNames.includes(g.name));
  const groupList = [
    { id: frame.id, name: 'frameme', parentId: null },
    ...topNames.map(n => byName[n]).filter(Boolean),
    ...rest
  ];
  // 从 DFS 顺序补上 parentId（frameme 无 parent，其余在 dfsGroups 里都有）
  const dfsById = {};
  dfsGroups.forEach(g => { dfsById[g.id] = g; });
  groupList.forEach((g, i) => {
    if (i === 0) return;
    const fromDfs = dfsById[g.id];
    if (fromDfs) g.parentId = fromDfs.parentId;
  });
  // 每个节点归属的顶层桶：全身轮廓 | 肌肉 | 关节（沿 parent 上溯）
  const topIds = { [byName['全身轮廓']?.id]: '全身轮廓', [byName['肌肉']?.id]: '肌肉', [byName['关节']?.id]: '关节' };
  function getBucket(node) {
    let curId = node.parentId;
    if (node.id && topIds[node.id]) return topIds[node.id];
    while (curId) {
      if (topIds[curId]) return topIds[curId];
      const parent = groupList.find(g => g.id === curId);
      curId = parent ? parent.parentId : null;
    }
    return null;
  }
  groupList.forEach(g => { g.bucket = g.name === 'frameme' ? null : getBucket(g); });
  pathList.forEach(p => { p.bucket = getBucket(p); });
  return { groupList, pathList };
}

// SVG id 只保留安全字符
function sanitizeId(id) {
  return String(id).replace(/[^A-Za-z0-9_-]/g, '_');
}

// 属性值转义（用于 data-name）
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 从一段 SVG 内容中按 DFS 顺序提取所有 <g> 和 <path>，每个返回 { type, openTag, innerContent, closeTag }
function extractElementsInDfsOrder(content) {
  const elements = [];
  let i = 0;
  const len = content.length;
  while (i < len) {
    const gStart = content.indexOf('<g', i);
    const pStart = content.indexOf('<path', i);
    let next;
    let type;
    if (pStart >= 0 && (gStart < 0 || pStart < gStart)) {
      next = pStart;
      type = 'path';
    } else if (gStart >= 0) {
      next = gStart;
      type = 'g';
    } else break;
    i = next;
    if (type === 'path') {
      const end = content.indexOf('/>', i);
      const end2 = content.indexOf('</path>', i);
      const endPos = end2 >= 0 && (end < 0 || end2 < end) ? end2 + 7 : end + 2;
      const full = content.slice(i, endPos);
      elements.push({ type: 'path', openTag: full, innerContent: '', closeTag: '' });
      i = endPos;
    } else {
      const openEnd = content.indexOf('>', i);
      const openTag = content.slice(i, openEnd + 1);
      let depth = 1;
      let pos = openEnd + 1;
      while (depth > 0 && pos < len) {
        const nextG = content.indexOf('<g', pos);
        const nextGClose = content.indexOf('</g>', pos);
        if (nextG >= 0 && (nextGClose < 0 || nextG < nextGClose)) {
          const checkSlash = content.indexOf('/>', pos);
          if (checkSlash >= 0 && checkSlash < nextG) { pos = checkSlash + 2; continue; }
          depth++;
          pos = nextG + 2;
        } else if (nextGClose >= 0) {
          depth--;
          if (depth === 0) {
            const innerContent = content.slice(openEnd + 1, nextGClose);
            elements.push({ type: 'g', openTag, innerContent, closeTag: '</g>' });
            const inner = extractElementsInDfsOrder(innerContent);
            elements.push(...inner);
            i = nextGClose + 4;
            break;
          }
          pos = nextGClose + 4;
        } else break;
      }
    }
  }
  return elements;
}

// 对 openTag 字符串设置/覆盖 id 和 data-name（自闭合如 <path /> 插在 / 前，保留 />）
function setOpenTagAttrs(openTag, id, name) {
  let s = openTag.replace(/\s+id="[^"]*"/g, '').replace(/\s+data-name="[^"]*"/g, '');
  const isSelfClosing = /\s*\/\s*>\s*$/.test(s);
  const insertAt = isSelfClosing ? s.lastIndexOf('/') : s.indexOf('>');
  let attr = ` id="${sanitizeId(id)}"`;
  if (name !== '') attr += ` data-name="${escapeAttr(name)}"`;
  return s.slice(0, insertAt) + attr + (isSelfClosing ? ' ' : '') + s.slice(insertAt);
}

// 在 </defs> 之后的 content 中按 FREE 层级重排：frameme 下三个平级组 全身轮廓、肌肉、关节，并打 id/data-name
function addIdsAndNamesToSvg(svgText, groupList, pathList) {
  const afterDefs = svgText.indexOf('</defs>');
  const searchStart = afterDefs >= 0 ? afterDefs + '</defs>'.length : 0;
  let rootContent = svgText.slice(searchStart);
  // 去掉已有 id/data-name 便于一致
  rootContent = rootContent.replace(/\s+id="[^"]*"/g, '').replace(/\s+data-name="[^"]*"/g, '');

  // 根层应只有一个 <g>，即 frameme
  const rootGOpen = rootContent.match(/<g\s/);
  if (!rootGOpen) return svgText;
  const rootOpenEnd = rootContent.indexOf('>', rootGOpen.index);
  const rootOpenTag = rootContent.slice(rootGOpen.index, rootOpenEnd + 1);
  const rootClose = rootContent.lastIndexOf('</g>');
  if (rootClose < 0) return svgText;
  const innerContent = rootContent.slice(rootOpenEnd + 1, rootClose);

  const elements = extractElementsInDfsOrder(innerContent);
  let gIdx = 1, pIdx = 0; // 第 0 个 group 是 frameme（根 g），根不在 elements 里，故从 1 开始
  const withMeta = [];
  for (const el of elements) {
    if (el.type === 'g') {
      if (gIdx < groupList.length) {
        const g = groupList[gIdx];
        withMeta.push({ ...el, id: g.id, name: g.name, bucket: g.bucket });
      }
      gIdx++;
    } else {
      if (pIdx < pathList.length) {
        const p = pathList[pIdx];
        withMeta.push({ ...el, id: p.id, name: p.name, bucket: p.bucket });
      }
      pIdx++;
    }
  }

  const BUCKET_ORDER = ['全身轮廓', '肌肉', '关节'];
  const buckets = { '全身轮廓': [], '肌肉': [], '关节': [] };
  for (const el of withMeta) {
    if (el.bucket && buckets[el.bucket]) buckets[el.bucket].push(el);
  }

  let newInner = '';
  for (const bucketName of BUCKET_ORDER) {
    const list = buckets[bucketName];
    if (list.length === 0) continue;
    const first = list[0];
    const openTag = setOpenTagAttrs(first.openTag, first.id, first.name);
    if (first.type === 'g') {
      newInner += openTag;
      for (let i = 1; i < list.length; i++) {
        const e = list[i];
        const o = setOpenTagAttrs(e.openTag, e.id, e.name);
        newInner += o + e.innerContent + e.closeTag;
      }
      newInner += '</g>';
    } else {
      newInner += setOpenTagAttrs(first.openTag, first.id, first.name);
      for (let i = 1; i < list.length; i++) {
        const e = list[i];
        newInner += setOpenTagAttrs(e.openTag, e.id, e.name);
      }
    }
  }

  const frameme = groupList[0];
  const newRootOpen = setOpenTagAttrs(rootOpenTag, frameme.id, frameme.name);
  const newRootContent = newRootOpen + newInner + '</g>';
  return svgText.slice(0, searchStart) + newRootContent;
}

if (listOnly) {
  if (!freePath || !fs.existsSync(freePath)) {
    console.error('未找到 .free 文件:', freePath || '(未指定)');
    console.error('back 配置请先将 Lunacy 背面导出为 docs/assets/body-back.free');
    process.exit(1);
  }
  const { groupList, pathList } = getFreeLayerLists(freePath);
  console.log('===', listProfile === 'back' ? 'body-back' : 'body-front', '图层结构 (DFS) ===\n');
  console.log('Groups (对应 <g>，共 %d 个):', groupList.length);
  groupList.forEach((x, i) => console.log('  %d. id=%s  name=%s', i + 1, x.id, x.name || '(无)'));
  console.log('\nPaths (对应 <path>，共 %d 个):', pathList.length);
  pathList.forEach((x, i) => console.log('  %d. id=%s  name=%s', i + 1, x.id, x.name || '(无)'));
  process.exit(0);
}

if (!fs.existsSync(freePath)) {
  console.error('未找到 .free 文件:', freePath);
  process.exit(1);
}
if (!fs.existsSync(svgPath)) {
  console.error('未找到 SVG 文件:', svgPath);
  process.exit(1);
}
const { groupList, pathList } = getFreeLayerLists(freePath);
const svgText = fs.readFileSync(svgPath, 'utf-8');
const out = addIdsAndNamesToSvg(svgText, groupList, pathList);
fs.writeFileSync(svgPath, out);
console.log('已为 %s 添加 id 与 data-name（group: %d, path: %d）', path.basename(svgPath), groupList.length, pathList.length);
