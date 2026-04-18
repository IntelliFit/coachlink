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
let count = 0;

const skipPatterns = [
  /skeleton/i, /loading/i, /shimmer/i, /progress/i, /avatar/i, /badge/i,
  /icon-/i, /gradient-premium/i, /gradient-advanced/i, /gradient-basic/i,
  /hero-/i, /page-/i, /container-bg/i, /mask/i, /overlay/i, /card-bg/i,
  /self-plan-card/i, /pro-badge/i, /rest-hero/i, /info-tip/i, /share-entry/i,
  /strength-panel/i, /rest-timer-panel/i, /guest-notice/i, /role-notice/i,
  /library-tip/i, /cover-fallback/i, /start-summary/i, /loc-summary/i,
  /data-score/i, /membership-card/i, /profile-card/i, /balance-card/i,
  /detail-header/i, /plan-week-nav/i, /plan-onerm/i, /action-detail-page/i,
  /action-edit-page/i, /student-action-lib-page/i, /wechat-auth-page/i,
  /streetlifting-page/i, /plan-create-page/i, /plan-edit-page/i,
  /skeleton-header/i, /skeleton-line/i, /skeleton-body/i,
  /analysis-rank-fill/i, /analysis-trend/i,
];

const buttonPatterns = [
  /\bbtn\b/i, /\bbutton\b/i, /\bprimary\b/i, /\baction\b/i, /\bconfirm\b/i,
  /\bsave\b/i, /\badd\b/i, /\bsubmit\b/i, /\bcta\b/i, /\bfooter-btn\b/i,
  /\bchip\b/i, /\btag\b/i, /\bfilter\b/i, /\bactive\b/i, /\bwarning\b/i,
  /\bempty-state-action\b/i, /\bslider-thumb\b/i, /\bshare-preview\b/i,
  /\blightweight-add\b/i, /\bselected\b/i, /\bcreate\b/i, /\bsearch-btn\b/i,
];

for (const { rel, full } of files) {
  const content = fs.readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('linear-gradient')) continue;
    if (!line.includes('background')) continue;
    
    // Find selector
    let selector = '';
    for (let j = i; j >= 0; j--) {
      const l = lines[j].trim();
      if (l.startsWith('.') || l.startsWith('&') || l.startsWith('#')) {
        selector = l.split('{')[0].trim();
        break;
      }
    }
    
    const context = (selector + ' ' + line).toLowerCase();
    
    // Skip non-button patterns
    let isSkip = false;
    for (const p of skipPatterns) {
      if (p.test(context)) { isSkip = true; break; }
    }
    if (isSkip) continue;
    
    // Check button patterns
    let isButton = false;
    for (const p of buttonPatterns) {
      if (p.test(selector)) { isButton = true; break; }
    }
    
    // Check for button-like features
    if (!isButton) {
      const blockLines = [];
      for (let j = i - 8; j <= i + 3; j++) {
        if (j >= 0 && j < lines.length) blockLines.push(lines[j]);
      }
      const block = blockLines.join('\n').toLowerCase();
      const hasPadding = /padding\s*:/.test(block);
      const hasBorderRadius = /border-radius\s*:\s*(?!9999)/.test(block);
      const hasTextAlign = /text-align\s*:\s*center/.test(block);
      const hasFlexCenter = /display:\s*flex/.test(block) && /justify-content\s*:\s*center/.test(block);
      const hasBoxShadow = /box-shadow\s*:/.test(block);
      if ((hasPadding && hasBorderRadius) || hasTextAlign || hasFlexCenter || hasBoxShadow) {
        if (!line.includes('::before') && !line.includes('::after')) {
          isButton = true;
        }
      }
    }
    
    if (isButton) {
      console.log(`BUTTON: ${rel}:${i+1} [${selector}] ${line.trim().slice(0, 80)}`);
      count++;
    }
  }
}

console.log(`\n=== Potential button gradients remaining: ${count} ===`);
