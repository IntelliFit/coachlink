const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'src');

const gridFiles = [
  'auth/wechat-auth/index.scss',
  'me/action-lib/edit/index.scss',
  'training/action-detail/index.scss',
  'training/action-edit/index.scss',
  'training/actions/index.scss',
  'components/PlanCompactWeekCalendar/index.scss',
  'components/PlanReferenceOneRMPanel/index.scss',
  'discovery/ranking/detail/index.scss',
  'me/membership/index.scss',
  'me/user/index.scss',
  'streetlifting/index/data/index.scss',
  'streetlifting/index/locations/index.scss',
  'streetlifting/index/locations-map/index.scss',
  'coach/wallet/index.scss',
  'me/profile/index.scss',
  'me/cart/index.scss',
  'me/action-lib/index.scss',
  'me/profile/detail/components/VideoCollectionSection.scss',
  'coach/students/assign-plan/index.scss',
  'training/today-training/index.scss',
  'training/today-training/components/RestDayCard.scss',
  'training/today-training/components/TodayTrainingCard.scss',
  'training/training-execution/index.scss',
];

const gridProps = [
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'gap',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'border-radius',
  'top', 'bottom', 'left', 'right',
];

const skipProps = ['font-size', 'line-height', 'border-width', 'box-shadow', 'letter-spacing'];

function roundTo8Grid(n) {
  if (n === 9999 || n === 1 || n === 0) return n;
  const remainder = n % 8;
  if (remainder === 0) return n;
  const lower = n - remainder;
  const upper = lower + 8;
  if (remainder < 4) return lower;
  if (remainder > 4) return upper;
  if (lower === 0) return 0;
  if (n >= 36) return upper;
  return lower;
}

let totalGridChanges = 0;

for (const relPath of gridFiles) {
  const filePath = path.join(BASE_DIR, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const newLines = [];
  let fileChanges = 0;

  for (const line of lines) {
    let newLine = line;
    const propMatch = newLine.match(/^\s*([a-z-]+)\s*:/);
    if (propMatch) {
      const prop = propMatch[1];
      if (skipProps.includes(prop)) {
        newLines.push(newLine);
        continue;
      }
      if (gridProps.includes(prop)) {
        const before = newLine;
        newLine = newLine.replace(/(^|[:\s(+-])(\d+)(rpx)/g, (match, prefix, numStr, suffix) => {
          const num = parseInt(numStr, 10);
          if (num === 9999 || num === 1 || num === 0 || num % 8 === 0) return match;
          const rounded = roundTo8Grid(num);
          return prefix + rounded + suffix;
        });
        if (newLine !== before) fileChanges++;
      }
    }
    newLines.push(newLine);
  }

  if (fileChanges > 0) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
    totalGridChanges += fileChanges;
    console.log(`FIXED (${fileChanges} lines): ${relPath}`);
  } else {
    console.log(`SKIP (no changes): ${relPath}`);
  }
}

console.log(`\n=== 8-grid fixes: ${totalGridChanges} lines modified ===`);
