#!/usr/bin/env node
/**
 * SVG 压缩加密脚本
 * 将 SVG 文件压缩并加密为二进制文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 简单的 XOR 加密密钥
const ENCRYPTION_KEY = new Uint8Array([
  0x42, 0x6F, 0x64, 0x79, 0x4D, 0x61, 0x70, 0x4B,
  0x65, 0x79, 0x32, 0x30, 0x32, 0x34, 0x21, 0x40
]);

/**
 * XOR 加密/解密
 */
function xorEncrypt(data) {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
  }
  return result;
}

/**
 * 提取所有 data-name 属性值
 */
function extractDataNames(svgContent, parentGroupName) {
  // 找到父组的范围
  const parentRegex = new RegExp(`<g[^>]*data-name="${parentGroupName}"[^>]*>`);
  const parentMatch = svgContent.match(parentRegex);
  
  if (!parentMatch) return [];
  
  const startIndex = parentMatch.index;
  let depth = 1;
  let endIndex = startIndex + parentMatch[0].length;
  
  // 找到对应的结束标签
  while (depth > 0 && endIndex < svgContent.length) {
    const nextOpen = svgContent.indexOf('<g', endIndex);
    const nextClose = svgContent.indexOf('</g>', endIndex);
    
    if (nextClose === -1) break;
    
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      endIndex = nextOpen + 2;
    } else {
      depth--;
      endIndex = nextClose + 4;
    }
  }
  
  // 提取该范围内的所有 data-name
  const groupContent = svgContent.slice(startIndex, endIndex);
  const nameMatches = groupContent.match(/data-name="([^"]+)"/g) || [];
  const names = nameMatches
    .map(m => m.match(/data-name="([^"]+)"/)[1])
    .filter(n => n !== parentGroupName && n !== '肌肉' && n !== '关节' && n !== '全身轮廓');
  
  return [...new Set(names)];
}

/**
 * 将 SVG 中的颜色替换为 CSS 变量
 */
function replaceColorsWithCSSVariables(svgContent) {
  let modifiedSvg = svgContent;
  
  // 1. 替换肌肉颜色 #222222 → var(--bodymap-muscle-color)
  modifiedSvg = modifiedSvg.replace(/fill="#222222"/g, 'fill="var(--bodymap-muscle-color, #222222)"');
  modifiedSvg = modifiedSvg.replace(/stroke="#222222"/g, 'stroke="var(--bodymap-muscle-color, #222222)"');
  
  // 2. 替换关节颜色 #D3D3D3 → var(--bodymap-joint-color)
  modifiedSvg = modifiedSvg.replace(/fill="#D3D3D3"/gi, 'fill="var(--bodymap-joint-color, #D3D3D3)"');
  modifiedSvg = modifiedSvg.replace(/stroke="#D3D3D3"/gi, 'stroke="var(--bodymap-joint-color, #D3D3D3)"');
  
  // 3. 替换身体轮廓颜色 #808080 → var(--bodymap-outline-color)
  modifiedSvg = modifiedSvg.replace(/fill="#808080"/g, 'fill="var(--bodymap-outline-color, #808080)"');
  modifiedSvg = modifiedSvg.replace(/stroke="#808080"/g, 'stroke="var(--bodymap-outline-color, #808080)"');
  
  // 4. 为全身轮廓组内的路径添加 CSS 变量（如果还没有 fill 或 stroke）
  // 查找全身轮廓组，并为其内部没有 fill/stroke 的路径添加样式
  const outlineRegex = /(<g[^>]*data-name="全身轮廓"[^>]*>)([\s\S]*?)(<\/g>)/;
  modifiedSvg = modifiedSvg.replace(outlineRegex, (match, openTag, content, closeTag) => {
    // 为组添加 class，方便 CSS 控制
    const styledOpenTag = openTag.replace(/<g/, '<g class="bodymap-outline"');
    
    // 为内部没有 fill/stroke 的 path 添加样式
    const styledContent = content.replace(
      /<path([^>]*)>/g,
      (pathMatch, attrs) => {
        // 如果已经有 fill 或 stroke，跳过
        if (attrs.includes('fill=') || attrs.includes('stroke=')) {
          return pathMatch;
        }
        // 添加 fill 为 CSS 变量
        return `<path${attrs} fill="var(--bodymap-outline-color, #808080)">`;
      }
    );
    
    return styledOpenTag + styledContent + closeTag;
  });
  
  return modifiedSvg;
}

/**
 * 压缩并加密 SVG 文件
 */
function compressAndEncrypt(inputPath, outputPath) {
  // 读取 SVG 文件
  let svgContent = fs.readFileSync(inputPath, 'utf-8');
  
  // 提取元数据（肌肉和关节名称）
  const metadata = {
    muscles: extractDataNames(svgContent, '肌肉'),
    joints: extractDataNames(svgContent, '关节'),
    hasOutline: svgContent.includes('data-name="全身轮廓"')
  };
  
  console.log(`  📊 发现 ${metadata.muscles.length} 块肌肉, ${metadata.joints.length} 个关节`);
  console.log(`     肌肉: ${metadata.muscles.join(', ')}`);
  console.log(`     关节: ${metadata.joints.join(', ')}`);
  
  // 替换颜色为 CSS 变量
  console.log(`  🎨 替换颜色为 CSS 变量...`);
  svgContent = replaceColorsWithCSSVariables(svgContent);
  
  // 1. 首先压缩 SVG 内容
  const compressed = gzipSync(Buffer.from(svgContent, 'utf-8'));
  
  // 2. 构建文件头（包含元数据长度和压缩数据长度）
  const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf-8');
  const header = Buffer.alloc(12);
  header.writeUInt32BE(0x424D5301, 0); // 魔数 BMS\x01
  header.writeUInt32BE(metadataBuffer.length, 4); // 元数据长度
  header.writeUInt32BE(compressed.length, 8); // 压缩数据长度
  
  // 3. 合并数据：header + metadata + compressed
  const combined = Buffer.concat([header, metadataBuffer, compressed]);
  
  // 4. XOR 加密
  const encrypted = xorEncrypt(combined);
  
  // 5. 写入文件
  fs.writeFileSync(outputPath, encrypted);
  
  // 计算压缩率
  const originalSize = fs.statSync(inputPath).size;
  const compressedSize = encrypted.length;
  const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
  
  console.log(`  📦 原始大小: ${(originalSize / 1024).toFixed(2)} KB`);
  console.log(`  🗜️  压缩后: ${(compressedSize / 1024).toFixed(2)} KB`);
  console.log(`  ✅ 节省空间: ${ratio}%`);
  
  return metadata;
}

// 主函数
function main() {
  console.log('🚀 开始压缩人体地图 SVG 文件...\n');
  
  const assetsDir = path.join(__dirname, '..', 'docs', 'assets');
  const publicDir = path.join(__dirname, '..', 'public', 'body-map');
  
  // 确保输出目录存在
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // 处理前视图
  console.log('📄 处理前视图 (body-front.svg)...');
  const frontMetadata = compressAndEncrypt(
    path.join(assetsDir, 'body-front.svg'),
    path.join(publicDir, 'front.bin')
  );
  
  console.log('');
  
  // 处理后视图
  console.log('📄 处理后视图 (body-back.svg)...');
  const backMetadata = compressAndEncrypt(
    path.join(assetsDir, 'body-back.svg'),
    path.join(publicDir, 'back.bin')
  );
  
  // 生成类型定义文件
  const allMuscles = [...new Set([...frontMetadata.muscles, ...backMetadata.muscles])];
  const allJoints = [...new Set([...frontMetadata.joints, ...backMetadata.joints])];
  
  const getView = (name) => {
    const inFront = frontMetadata.muscles.includes(name) || frontMetadata.joints.includes(name);
    const inBack = backMetadata.muscles.includes(name) || backMetadata.joints.includes(name);
    if (inFront && inBack) return "'both'";
    if (inFront) return "'front'";
    return "'back'";
  };
  
  const typesContent = `// 由 compress-body-map.mjs 自动生成，请勿手动修改

export type BodyMuscle = 
${allMuscles.map(m => `  | '${m}'`).join('\n')};

export type BodyJoint = 
${allJoints.map(j => `  | '${j}'`).join('\n')};

export type BodyPart = BodyMuscle | BodyJoint;

export const FRONT_MUSCLES = [${frontMetadata.muscles.map(m => `'${m}'`).join(', ')}] as const;
export const FRONT_JOINTS = [${frontMetadata.joints.map(j => `'${j}'`).join(', ')}] as const;
export const BACK_MUSCLES = [${backMetadata.muscles.map(m => `'${m}'`).join(', ')}] as const;
export const BACK_JOINTS = [${backMetadata.joints.map(j => `'${j}'`).join(', ')}] as const;

export interface BodyPartMetadata {
  name: string;
  type: 'muscle' | 'joint';
  view: 'front' | 'back' | 'both';
  description?: string;
}

export const BODY_PART_METADATA: Record<string, BodyPartMetadata> = {
${allMuscles.map(m => `  '${m}': { name: '${m}', type: 'muscle', view: ${getView(m)} }`).join(',\n')},
${allJoints.map(j => `  '${j}': { name: '${j}', type: 'joint', view: ${getView(j)} }`).join(',\n')}
};
`;
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'src', 'components', 'knowledge', 'BodyMap', 'bodyMapTypes.ts'),
    typesContent
  );
  
  console.log('\n✅ 压缩完成！');
  console.log(`📁 输出目录: ${publicDir}`);
  console.log(`📝 生成类型文件: src/components/knowledge/BodyMap/bodyMapTypes.ts`);
  console.log(`\n💡 CSS 变量说明:`);
  console.log(`   --bodymap-muscle-color: 肌肉颜色 (默认: #222222)`);
  console.log(`   --bodymap-joint-color: 关节颜色 (默认: #D3D3D3)`);
  console.log(`   --bodymap-outline-color: 身体轮廓颜色 (默认: #808080)`);
}

main();
