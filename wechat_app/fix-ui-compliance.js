const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'src');

// ============ Phase 1: Exact gradient replacements from PRD ============
const gradientReplacements = [
  // filePath, oldStr, newStr
  ['auth/student-onboarding/index.scss', 'background: linear-gradient(90deg, #cf6d4e 0%, #fb923c 100%);', 'background: #cf6d4e;'],
  ['coach/plan-lib/create/index.scss', 'background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);', 'background: #3b82f6;'],
  ['coach/plan-lib/edit/index.scss', 'background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);', 'background: #3b82f6;'],
  ['coach/questionnaire/edit/index.scss', 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);', 'background: #10b981;'],
  ['coach/questionnaire/edit/index.scss', 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);', 'background: #667eea;'],
  ['coach/students/assign-plan/index.scss', 'background: linear-gradient(135deg, #ff9f4a, #ff7b2c);', 'background: #ff9f4a;'],
  ['coach/students/plan/index.scss', 'background: linear-gradient(135deg, #34c759 0%, #248a3d 100%);', 'background: #34c759;'],
  ['coach/students/plan/index.scss', 'background: linear-gradient(135deg, #007aff 0%, #0056d2 100%);', 'background: #007aff;'],
  ['coach/videos/index.scss', 'background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);', 'background: #3b82f6;'],
  ['coach/videos/index.scss', 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);', 'background: #10b981;'],
  ['components/ResetPasswordForm/index.scss', 'background: linear-gradient(135deg, #CF6D4E 0%, #FBB924 100%);', 'background: #CF6D4E;'],
  ['components/ResetPasswordForm/index.scss', 'background: linear-gradient(135deg, #CF6D4E 0%, #FBB924 100%) !important;', 'background: #CF6D4E !important;'],
  ['content/public/training/index.scss', 'background: linear-gradient(135deg, #38bdf8, #0ea5e9);', 'background: #38bdf8;'],
  ['discovery/coach-profile/index.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['discovery/coach-profile/components/CoachIntro.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['discovery/market/index.scss', 'background: linear-gradient(135deg, #F28631 0%, #FFAC6B 100%);', 'background: #F28631;'],
  ['me/cart/index.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['me/friends/index.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['me/membership/subscribe/index.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['me/messages/chat/index.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['me/my-coaches/components/CoachCard.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['me/payment/webview/index.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['me/plan-lib/create/index.scss', 'background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);', 'background: #f8fafc;'],
  ['me/plan-lib/create/index.scss', 'background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);', 'background: #fffbeb;'],
  ['me/plan-lib/create/index.scss', 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);', 'background: #f59e0b;'],
  ['me/plan-lib/edit/index.scss', 'background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);', 'background: #f8fafc;'],
  ['me/plan-lib/edit/index.scss', 'background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);', 'background: #fffbeb;'],
  ['me/plan-lib/edit/index.scss', 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);', 'background: #f59e0b;'],
  ['me/profile/detail/components/ProgressTimeline.scss', 'background: linear-gradient(135deg, #FFF5EB 0%, #FFE8D1 100%);', 'background: #FFF5EB;'],
  ['me/toolbox/scenario/index.scss', 'background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);', 'background: #f97316;'],
  ['training/action-edit/index.scss', 'background: linear-gradient(135deg, #cf6d4e 0%, #fb923c 100%);', 'background: #cf6d4e;'],
  ['training/copy-from-coach/index.scss', 'background: linear-gradient(135deg, #cf6d4e 0%, #fb923c 100%);', 'background: #cf6d4e;'],
  ['training/today-training/index.scss', 'background: linear-gradient(135deg, #cf6d4e 0%, #e59b7d 100%);', 'background: #cf6d4e;'],
  ['training/today-training/components/BrowseSection.scss', 'background: linear-gradient(135deg, #CF6D4E 0%, #E59B7D 100%);', 'background: #CF6D4E;'],
  ['training/training-execution/index.scss', 'background: linear-gradient(90deg, #53c96b 0%, #75df88 100%);', 'background: #53c96b;'],
];

let totalGradientChanges = 0;

for (const [relPath, oldStr, newStr] of gradientReplacements) {
  const filePath = path.join(BASE_DIR, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences === 0) {
    console.log(`SKIP (no match): ${relPath} -> "${oldStr.slice(0, 60)}..."`);
    continue;
  }
  content = content.split(oldStr).join(newStr);
  fs.writeFileSync(filePath, content, 'utf-8');
  totalGradientChanges += occurrences;
  console.log(`FIXED (${occurrences}x): ${relPath}`);
}

console.log(`\n=== Gradient fixes: ${totalGradientChanges} ===\n`);

// ============ Phase 2: 8-grid auto-fix for 53 files ============

const gridFiles = [
  'app.scss',
  'auth/onboarding/index.scss',
  'auth/register/index.scss',
  'auth/wechat-auth/index.scss',
  'coach/overview/index.scss',
  'coach/plan-lib/index.scss',
  'coach/students/assign-plan/index.scss',
  'coach/students/detail/index.scss',
  'coach/students/plan/index.scss',
  'components/ActionSelectModal/index.scss',
  'components/PlanCompactWeekCalendar/index.scss',
  'components/PlanEditorWorkbench/index.scss',
  'components/PlanReferenceOneRMPanel/index.scss',
  'content/public/training/index.scss',
  'discovery/coach-profile/index.scss',
  'discovery/generate-plan/assessment.scss',
  'discovery/generate-plan/index.scss',
  'discovery/generate-plan/waiting/index.scss',
  'discovery/market/index.scss',
  'discovery/share/index.scss',
  'me/about/index.scss',
  'me/action-lib/index.scss',
  'me/action-lib/edit/index.scss',
  'me/contact/index.scss',
  'me/feedback/index.scss',
  'me/membership/index.scss',
  'me/payment-waiting/index.scss',
  'me/plan-lib/index.scss',
  'me/plan-lib/create/index.scss',
  'me/plan-lib/edit/index.scss',
  'me/platform-agreement/index.scss',
  'me/profile/index.scss',
  'me/profile/e1rm-chart/index.scss',
  'me/protection-of-consumer/index.scss',
  'me/terms/index.scss',
  'me/training-history/index.scss',
  'me/user/index.scss',
  'pages/index/index.scss',
  'streetlifting/index.scss',
  'streetlifting/index/calculator/index.scss',
  'streetlifting/index/data/index.scss',
  'streetlifting/index/locations/index.scss',
  'streetlifting/index/locations-map/index.scss',
  'streetlifting/index/methodology/index.scss',
  'streetlifting/index/stories/index.scss',
  'streetlifting/index/submit/index.scss',
  'streetlifting/index/submit/success/index.scss',
  'training/action-detail/index.scss',
  'training/action-edit/index.scss',
  'training/copy-from-coach/index.scss',
  'training/impromptu-training/index.scss',
  'training/today-training/index.scss',
  'training/training-execution/index.scss',
];

const gridProperties = [
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'gap',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'border-radius',
  'top', 'bottom', 'left', 'right',
];

const skipProperties = ['font-size', 'line-height', 'border-width', 'box-shadow', 'letter-spacing'];

function roundTo8Grid(n) {
  if (n === 9999 || n === 1 || n === 0) return n;
  const remainder = n % 8;
  if (remainder === 0) return n;
  const lower = n - remainder;
  const upper = lower + 8;
  // Standard rounding; for ties (remainder === 4), prefer lower for small values, upper for larger
  if (remainder < 4) return lower;
  if (remainder > 4) return upper;
  // remainder === 4, tie-breaker: use PRD observed pattern
  // PRD shows: 4->0, 52->48 (lower), 76->80 (upper)
  // Heuristic: if lower is 0, use 0; otherwise use upper for >= 36, lower for < 36
  if (lower === 0) return 0;
  if (n >= 36) return upper;
  return lower;
}

function processRpxValue(match, prefix, numStr, suffix) {
  const num = parseInt(numStr, 10);
  if (num === 9999 || num === 1) return match;
  const rounded = roundTo8Grid(num);
  if (rounded === num) return match;
  return prefix + rounded + suffix;
}

let totalGridChanges = 0;

for (const relPath of gridFiles) {
  const filePath = path.join(BASE_DIR, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  const lines = content.split('\n');
  const newLines = [];
  let fileChanges = 0;

  for (const line of lines) {
    let newLine = line;
    // Check if this line contains a grid property
    const propMatch = newLine.match(/^\s*([a-z-]+)\s*:/);
    if (propMatch) {
      const prop = propMatch[1];
      if (skipProperties.includes(prop)) {
        newLines.push(newLine);
        continue;
      }
      if (gridProperties.includes(prop)) {
        // Replace all numeric rpx values in this line
        const before = newLine;
        newLine = newLine.replace(/(^|[:\s(+-])(\d+)(rpx)/g, (match, prefix, numStr, suffix) => {
          return processRpxValue(match, prefix, numStr, suffix);
        });
        if (newLine !== before) {
          fileChanges++;
        }
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

console.log(`\n=== 8-grid fixes: ${totalGridChanges} lines modified ===\n`);
