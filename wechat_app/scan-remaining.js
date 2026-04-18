const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'src');

// Scan for remaining gradients
const allScssFiles = [];
function findScss(dir, relDir = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name);
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findScss(fullPath, relPath);
    } else if (entry.name.endsWith('.scss')) {
      allScssFiles.push({ rel: relPath, full: fullPath });
    }
  }
}
findScss(BASE_DIR);

let gradientCount = 0;
const gradientFiles = [];
let gridCount = 0;
const gridFiles = [];

const gridProps = ['margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'gap', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'border-radius',
  'top', 'bottom', 'left', 'right'];
const skipProps = ['font-size', 'line-height', 'border-width', 'box-shadow', 'letter-spacing'];

for (const { rel, full } of allScssFiles) {
  const content = fs.readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  let fileGradient = 0;
  let fileGrid = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check gradients
    if (line.includes('linear-gradient') && line.includes('background')) {
      gradientCount++;
      fileGradient++;
      console.log(`GRADIENT: ${rel}:${i+1} ${line.trim().slice(0, 100)}`);
    }
    // Check 8-grid
    const propMatch = line.match(/^\s*([a-z-]+)\s*:/);
    if (propMatch) {
      const prop = propMatch[1];
      if (gridProps.includes(prop) && !skipProps.includes(prop)) {
        const matches = line.matchAll(/(^|[:\s(+-])(\d+)(rpx)/g);
        for (const m of matches) {
          const num = parseInt(m[2], 10);
          if (num !== 9999 && num !== 1 && num !== 0 && num % 8 !== 0) {
            gridCount++;
            fileGrid++;
            if (fileGrid <= 3) {
              console.log(`GRID: ${rel}:${i+1} [${prop}] ${num}rpx -> ${line.trim().slice(0, 80)}`);
            }
          }
        }
      }
    }
  }
  if (fileGradient > 0) gradientFiles.push(`${rel} (${fileGradient})`);
  if (fileGrid > 0) gridFiles.push(`${rel} (${fileGrid})`);
}

console.log(`\n=== Remaining gradients: ${gradientCount} in ${gradientFiles.length} files ===`);
if (gradientFiles.length > 0) console.log(gradientFiles.join('\n'));

console.log(`\n=== Remaining 8-grid violations: ${gridCount} in ${gridFiles.length} files ===`);
if (gridFiles.length > 0) console.log(gridFiles.slice(0, 20).join('\n'));
