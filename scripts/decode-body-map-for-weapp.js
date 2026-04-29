/**
 * 将 web 端的 body-map .bin 文件解码为 SVG，供小程序使用
 * 用法: node scripts/decode-body-map-for-weapp.js
 */
const fs = require('fs');
const path = require('path');
const pako = require('pako');

const ENCRYPTION_KEY = Buffer.from([
  0x42, 0x6F, 0x64, 0x79, 0x4D, 0x61, 0x70, 0x4B,
  0x65, 0x79, 0x32, 0x30, 0x32, 0x34, 0x21, 0x40
]);

function xorDecrypt(data) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
  }
  return result;
}

function decodeBodyMap(inputPath, outputPath) {
  const binaryData = fs.readFileSync(inputPath);
  const decrypted = xorDecrypt(binaryData);

  const magic = (decrypted[0] << 24) | (decrypted[1] << 16) | (decrypted[2] << 8) | decrypted[3];
  if (magic !== 0x424D5301) {
    throw new Error('Invalid body map file format: ' + magic.toString(16));
  }

  const metadataLength = (decrypted[4] << 24) | (decrypted[5] << 16) | (decrypted[6] << 8) | decrypted[7];
  const compressedLength = (decrypted[8] << 24) | (decrypted[9] << 16) | (decrypted[10] << 8) | decrypted[11];

  const metadataBuffer = decrypted.slice(12, 12 + metadataLength);
  const metadata = JSON.parse(metadataBuffer.toString('utf-8'));

  const compressedData = decrypted.slice(12 + metadataLength, 12 + metadataLength + compressedLength);
  const svg = pako.inflate(compressedData, { to: 'string' });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, svg, 'utf-8');
  console.log(`Decoded ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${svg.length} bytes)`);
  console.log('Metadata:', JSON.stringify(metadata));
}

const root = path.resolve(__dirname, '..');

decodeBodyMap(
  path.join(root, 'public/body-map/front.bin'),
  path.join(root, 'wechat_app/src/assets/body-map/front.svg')
);

decodeBodyMap(
  path.join(root, 'public/body-map/back.bin'),
  path.join(root, 'wechat_app/src/assets/body-map/back.svg')
);

console.log('Done. SVG files are ready for the mini-program.');
