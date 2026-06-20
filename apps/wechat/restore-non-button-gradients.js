const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'src');

const restoreRules = [
  // [file, currentWrongValue, originalCorrectValue]
  ['auth/wechat-auth/index.scss', 'background: #E8E8E8;', 'background: linear-gradient(180deg, #E8E8E8 0%, #F8F8F8 100%);'],
  ['me/action-lib/edit/index.scss', 'background: #E8E8E8;', 'background: linear-gradient(180deg, #E8E8E8 0%, #F8F8F8 100%);'],
  ['training/action-detail/index.scss', 'background: #E8E8E8;', 'background: linear-gradient(180deg, #E8E8E8 0%, #F8F8F8 100%);'],
  ['training/action-edit/index.scss', 'background: #E8E8E8;', 'background: linear-gradient(180deg, #E8E8E8 0%, #F8F8F8 100%);'],
  ['training/actions/index.scss', 'background: #E8E8E8;', 'background: linear-gradient(180deg, #E8E8E8 0%, #F8F8F8 100%);'],
  ['components/PlanCompactWeekCalendar/index.scss', 'background: #ffffff;', 'background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);'],
  ['components/PlanReferenceOneRMPanel/index.scss', 'background: #ffffff;', 'background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);'],
  ['discovery/ranking/detail/index.scss', 'background: #ea580c;', 'background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);'],
  ['me/membership/index.scss', 'background: #667eea;', 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'],
  ['me/user/index.scss', 'background: #667eea;', 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'],
  ['streetlifting/index/data/index.scss', 'background: #eff6ff;', 'background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);'],
  ['streetlifting/index/locations/index.scss', 'background: #f0fdf4;', 'background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);'],
  ['streetlifting/index/locations-map/index.scss', 'background: #f0fdf4;', 'background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);'],
  ['coach/wallet/index.scss', 'background: #10b981;', 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);'],
  ['me/profile/index.scss', 'background: #fff7ed;', 'background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);'],
  ['me/cart/index.scss', 'background: #fff7ed;', 'background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);'],
  ['me/action-lib/index.scss', 'background: #fff7ed;', 'background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);'],
  ['me/profile/detail/components/VideoCollectionSection.scss', 'background: #0f172a;', 'background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);'],
  ['coach/students/assign-plan/index.scss', 'background: #fff8f2;', 'background: linear-gradient(135deg, #fff8f2 0%, #fff0e0 100%);'],
  ['training/today-training/index.scss', 'background: #fff7ed;', 'background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%);'],
  ['training/today-training/components/RestDayCard.scss', 'background: #fff7ed;', 'background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);'],
  ['training/today-training/components/TodayTrainingCard.scss', 'background: #fff;', 'background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);'],
  ['training/today-training/components/TodayTrainingCard.scss', 'background: #fff7ed;', 'background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);'],
  ['training/training-execution/index.scss', 'background: #1e2127;', 'background: linear-gradient(180deg, #1e2127 0%, #0f1115 100%);'],
];

let restored = 0;
for (const [relPath, wrong, correct] of restoreRules) {
  const filePath = path.join(BASE_DIR, relPath);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf-8');
  const occurrences = content.split(wrong).length - 1;
  if (occurrences === 0) {
    console.log(`SKIP (not found): ${relPath} -> "${wrong}"`);
    continue;
  }
  content = content.split(wrong).join(correct);
  fs.writeFileSync(filePath, content, 'utf-8');
  restored += occurrences;
  console.log(`RESTORED (${occurrences}x): ${relPath}`);
}

console.log(`\n=== Restored ${restored} non-button gradients ===`);
