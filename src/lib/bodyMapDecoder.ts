/**
 * 人体地图二进制文件解码器
 * 用于解压并解密压缩后的 SVG 文件
 */

// XOR 加密密钥（必须与压缩脚本一致）
const ENCRYPTION_KEY = new Uint8Array([
  0x42, 0x6F, 0x64, 0x79, 0x4D, 0x61, 0x70, 0x4B,
  0x65, 0x79, 0x32, 0x30, 0x32, 0x34, 0x21, 0x40
]);

export interface BodyMapMetadata {
  muscles: string[];
  joints: string[];
  hasOutline: boolean;
}

export interface DecodedBodyMap {
  svg: string;
  metadata: BodyMapMetadata;
}

/**
 * XOR 解密
 */
function xorDecrypt(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
  }
  return result;
}

/**
 * 使用 pako 解压 gzip 数据
 * 注意：需要在项目中安装 pako
 */
async function decompressGzip(data: Uint8Array): Promise<string> {
  // 动态导入 pako 以减少初始加载
  const pako = await import('pako');
  const decompressed = pako.inflate(data);
  return new TextDecoder().decode(decompressed);
}

/**
 * 解码人体地图二进制文件
 */
export async function decodeBodyMap(binaryData: Uint8Array): Promise<DecodedBodyMap> {
  // 1. XOR 解密
  const decrypted = xorDecrypt(binaryData);
  
  // 2. 验证魔数 (BMS\x01)
  const magic = decrypted.slice(0, 4);
  const magicNumber = (magic[0] << 24) | (magic[1] << 16) | (magic[2] << 8) | magic[3];
  if (magicNumber !== 0x424D5301) {
    throw new Error('Invalid body map file format');
  }
  
  // 3. 读取文件头
  const metadataLength = (decrypted[4] << 24) | (decrypted[5] << 16) | (decrypted[6] << 8) | decrypted[7];
  const compressedLength = (decrypted[8] << 24) | (decrypted[9] << 16) | (decrypted[10] << 8) | decrypted[11];
  
  // 4. 提取元数据
  const metadataBuffer = decrypted.slice(12, 12 + metadataLength);
  const metadata: BodyMapMetadata = JSON.parse(new TextDecoder().decode(metadataBuffer));
  
  // 5. 提取并解压 SVG 数据
  const compressedData = decrypted.slice(12 + metadataLength, 12 + metadataLength + compressedLength);
  const svg = await decompressGzip(compressedData);
  
  return { svg, metadata };
}

/**
 * 从 URL 加载并解码人体地图
 */
export async function loadBodyMap(url: string): Promise<DecodedBodyMap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load body map: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return decodeBodyMap(new Uint8Array(arrayBuffer));
}
