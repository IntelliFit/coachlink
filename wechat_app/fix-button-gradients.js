const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'src');

function findScssFiles(dir, relDir = '', result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name);
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findScssFiles(fullPath, relPath, result);
    } else if (entry.name.endsWith('.scss')) {
      result.push({ rel: relPath, full: fullPath });
    }
  }
  return result;
}

const files = findScssFiles(BASE_DIR);
let totalFixed = 0;
const fixedFiles = [];

const skipPatterns = [
  /skeleton/i, /loading/i, /shimmer/i, /progress/i, /avatar/i, /badge/i,
  /icon-/i, /gradient-premium/i, /gradient-advanced/i, /gradient-basic/i,
  /hero-/i, /page-/i, /container-bg/i, /mask/i, /overlay/i, /card-bg/i,
  /self-plan-card/i, /pro-badge/i,
];

const buttonPatterns = [
  /\bbtn\b/i, /\bbutton\b/i, /\bprimary\b/i, /\baction\b/i, /\bconfirm\b/i,
  /\bsave\b/i, /\badd\b/i, /\bsubmit\b/i, /\bcta\b/i, /\bfooter-btn\b/i,
  /\bchip\b/i, /\btag\b/i, /\bfilter\b/i, /\bactive\b/i,
];

function isButtonRule(lines, gradientLineIdx) {
  const line = lines[gradientLineIdx];
  
  // Skip ::before/::after narrow decorations
  if (line.includes('::before') || line.includes('::after')) {
    // Check if it's a narrow decorative bar
    const ruleBlock = [];
    for (let i = gradientLineIdx - 5; i <= gradientLineIdx + 2; i++) {
      if (i >= 0 && i < lines.length) ruleBlock.push(lines[i]);
    }
    const blockText = ruleBlock.join('\n');
    const widthMatch = blockText.match(/width:\s*(\d+)rpx/);
    const heightMatch = blockText.match(/height:\s*(\d+)rpx/);
    const w = widthMatch ? parseInt(widthMatch[1]) : 999;
    const h = heightMatch ? parseInt(heightMatch[1]) : 999;
    if (w < 20 || h < 20) return false;
  }
  
  // Find selector: look upward for non-indented line starting with . or & or #
  let selector = '';
  for (let i = gradientLineIdx; i >= 0; i--) {
    const l = lines[i].trim();
    if (l.startsWith('.') || l.startsWith('&') || l.startsWith('#')) {
      selector = l;
      break;
    }
    if (l.endsWith('{') && !l.includes('background')) {
      selector = l.replace('{', '').trim();
      break;
    }
  }
  
  // Check skip patterns on selector or current line
  const context = (selector + ' ' + line).toLowerCase();
  for (const p of skipPatterns) {
    if (p.test(context)) return false;
  }
  
  // Check button patterns
  for (const p of buttonPatterns) {
    if (p.test(selector)) return true;
  }
  
  // Check for button-like features in the same rule block
  const blockLines = [];
  for (let i = gradientLineIdx - 8; i <= gradientLineIdx + 3; i++) {
    if (i >= 0 && i < lines.length) blockLines.push(lines[i]);
  }
  const block = blockLines.join('\n').toLowerCase();
  
  // If has padding + border-radius (not 9999rpx), likely a button
  const hasPadding = /padding\s*:/.test(block);
  const hasBorderRadius = /border-radius\s*:\s*(?!9999)/.test(block);
  const hasTextAlign = /text-align\s*:\s*center/.test(block);
  const hasFlexCenter = /display:\s*flex/.test(block) && /justify-content\s*:\s*center/.test(block);
  
  if ((hasPadding && hasBorderRadius) || hasTextAlign || hasFlexCenter) {
    // But exclude decorative elements
    if (!line.includes('::before') && !line.includes('::after')) {
      return true;
    }
  }
  
  return false;
}

function extractFirstColor(gradientStr) {
  const match = gradientStr.match(/#[0-9a-fA-F]{3,8}/);
  return match ? match[0] : null;
}

for (const { rel, full } of files) {
  const content = fs.readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  let fileChanges = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('linear-gradient')) continue;
    if (!line.includes('background')) continue;
    
    if (isButtonRule(lines, i)) {
      const color = extractFirstColor(line);
      if (color) {
        const oldStr = line.match(/background:\s*linear-gradient\([^;]+\)[^;]*/)?.[0];
        if (oldStr) {
          const newStr = `background: ${color}`;
          // Preserve !important if present
          const hasImportant = line.includes('!important');
          const finalNewStr = hasImportant ? `${newStr} !important` : newStr;
          lines[i] = line.replace(oldStr, finalNewStr);
          fileChanges++;
          console.log(`FIX: ${rel}:${i+1} ${selectorFrom(lines, i)} -> ${color}`);
        }
      }
    }
  }
  
  if (fileChanges > 0) {
    fs.writeFileSync(full, lines.join('\n'), 'utf-8');
    totalFixed += fileChanges;
    fixedFiles.push(`${rel} (${fileChanges})`);
  }
}

function selectorFrom(lines, idx) {
  for (let i = idx; i >= 0; i--) {
    const l = lines[i].trim();
    if (l.startsWith('.') || l.startsWith('&') || l.startsWith('#')) {
      return l.split('{')[0].trim();
    }
  }
  return '?';
}

console.log(`\n=== Button gradient fixes: ${totalFixed} in ${fixedFiles.length} files ===`);
if (fixedFiles.length) console.log(fixedFiles.join('\n'));
