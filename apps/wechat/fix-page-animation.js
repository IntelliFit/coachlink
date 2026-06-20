const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'src');

function findConfigFiles(dir, relDir = '', result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name);
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findConfigFiles(fullPath, relPath, result);
    } else if (entry.name === 'index.config.ts') {
      result.push({ rel: relPath, full: fullPath });
    }
  }
  return result;
}

const files = findConfigFiles(BASE_DIR);
let modified = 0;
let skipped = 0;

for (const { rel, full } of files) {
  let content = fs.readFileSync(full, 'utf-8');
  
  // Skip if already has animationType
  if (content.includes('animationType')) {
    skipped++;
    continue;
  }
  
  // Handle export default { ... } format
  if (content.includes('export default {')) {
    // Find the last } and add animationType before it
    const lastBrace = content.lastIndexOf('}');
    if (lastBrace !== -1) {
      const before = content.slice(0, lastBrace);
      const after = content.slice(lastBrace);
      // Check if there's a comma before the last }
      const trimmed = before.trimEnd();
      const needsComma = !trimmed.endsWith(',');
      content = trimmed + (needsComma ? ',' : '') + "\n  animationType: 'none'" + "\n" + after;
      fs.writeFileSync(full, content, 'utf-8');
      modified++;
      console.log(`FIXED: ${rel}`);
      continue;
    }
  }
  
  // Handle export default definePageConfig({ ... }) format
  if (content.includes('definePageConfig({')) {
    const lastBrace = content.lastIndexOf('})');
    if (lastBrace !== -1) {
      const before = content.slice(0, lastBrace);
      const after = content.slice(lastBrace);
      const trimmed = before.trimEnd();
      const needsComma = !trimmed.endsWith(',');
      content = trimmed + (needsComma ? ',' : '') + "\n  animationType: 'none'" + "\n" + after;
      fs.writeFileSync(full, content, 'utf-8');
      modified++;
      console.log(`FIXED: ${rel}`);
      continue;
    }
  }
  
  console.log(`SKIP (unrecognized format): ${rel}`);
  skipped++;
}

console.log(`\n=== Modified: ${modified}, Skipped: ${skipped}, Total: ${files.length} ===`);
