/** Read-only inventory by default; precise first-six-page correction plan. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { bootstrapEnv } from './config/bootstrap-env.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'artifacts/action-image-review/first-six-2026-10-08')
mkdirSync(dir, { recursive: true })
await bootstrapEnv({ mode: 'development', projectRoot: root })
const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || new URL(url).host !== 'uhlqribpagvklpqmcqvo.supabase.co') throw new Error('Unexpected CoachLink database')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const review = JSON.parse(readFileSync(path.join(root, 'artifacts/action-image-review/user-first-six-before.json'), 'utf8'))
const firstSix = review.actions.filter(row => row.available).slice(0, 144)
const deleteNames = ['标准后水平双力臂', '彩虹前水平', '侧悬挂', '搭肘前水平', '大天使', '单杠超宽距直腕后倾',
  '单杠窄距正反手', '单手人旗', '单手人旗（悬挂）', '单手肘贴腹', '吊环变举', '吊环STANCHEV',
  '吊环ZANETTI', '对握前水平', '对握前水平 (团身/进阶团身)', '俄挺进阶', '俄挺起死回生', '反手交叉手俄挺']
const deleteRows = deleteNames.map(name => {
  const row = firstSix.find(row => row.name === name)
  if (!row) throw new Error(`Delete name not in first six pages: ${name}`)
  return row
})
const renamePlan = [
  { publicId: '8cd4ae6c-f664-417b-8118-d67591e4f57d', oldName: '+50% 体重负重俯卧撑', newName: '负重俯卧撑',
    options: [50, 100, 150], mergedIds: ['633740b8-eb52-472a-95a3-a6f0192d33c1', '3f3aaca8-b071-4144-be54-ba036fa6dd4d'] },
  { publicId: 'fbec0412-0f4e-4aea-b5e6-c3f1b6b5dad7', oldName: '+50% 体重负重屈臂撑', newName: '负重屈臂撑', options: [50], mergedIds: [] },
  { publicId: 'dd47b8b3-d888-4f30-a311-34fa1b098a1b', oldName: '吊环俯卧撑可加负重', newName: '吊环俯卧撑', options: [], mergedIds: [] },
]
const affectedIds = [...new Set([...deleteRows.map(row => row.publicId), ...renamePlan.flatMap(row => [row.publicId, ...row.mergedIds])])]
const [publicResult, canonicalResult] = await Promise.all([
  db.from('community_actions').select('*').order('id').range(0, 999),
  db.from('canonical_actions').select('*').order('id').range(0, 999),
])
if (publicResult.error || canonicalResult.error) throw publicResult.error || canonicalResult.error
const current = publicResult.data.filter(row => affectedIds.includes(row.id))
const canonicalIds = [...new Set(current.map(row => row.canonical_action_id).filter(Boolean))]
const dependencies: Record<string, unknown> = {}
for (const table of ['community_action_likes', 'community_action_edits', 'community_action_edit_votes']) {
  const column = table === 'community_action_edit_votes' ? 'edit_id' : 'action_id'
  const ids = table === 'community_action_edit_votes' ? (dependencies.community_action_edits as any[])?.map(row => row.id) || [] : affectedIds
  if (!ids.length) { dependencies[table] = []; continue }
  const result = await db.from(table).select('*').in(column, ids)
  if (result.error) throw result.error
  dependencies[table] = result.data
}
for (const table of ['coach_actions', 'student_actions']) {
  const result = await db.from(table).select('id,canonical_action_id,name').in('canonical_action_id', canonicalIds)
  if (result.error) throw result.error
  dependencies[table] = result.data
}
const snapshot = { capturedAt: new Date().toISOString(), host: new URL(url).host,
  public: publicResult.data, canonical: canonicalResult.data, dependencies }
const baseline = path.join(dir, 'database-before.json')
// Never overwrite the rollback baseline on later runs.
if (!readFileExists(baseline)) writeFileSync(baseline, JSON.stringify(snapshot, null, 2) + '\n')
const plan = { pageSize: 24, lastReviewedPublicId: 'f6962e82-b892-4681-a6c5-7ccf710daf6e',
  lastReviewedName: '反手扣腕撞腹', deleteRows: deleteRows.map(row => ({ publicId: row.publicId, name: row.name })), renamePlan }
writeFileSync(path.join(dir, 'correction-plan.json'), JSON.stringify(plan, null, 2) + '\n')
writeFileSync(path.join(dir, 'latest-inventory.json'), JSON.stringify(snapshot, null, 2) + '\n')
console.log(JSON.stringify({ targetHost: snapshot.host, deleteCount: deleteRows.length, renamePlan,
  currentAffected: current.map(row => ({ id: row.id, name: row.name, attrs: row.attrs, item_schema: row.item_schema,
    includesBodyWeight: row.includesBodyWeight, enableAutoWeightCompute: row.enableAutoWeightCompute })),
  dependentCounts: Object.fromEntries(Object.entries(dependencies).map(([table, rows]) => [table, (rows as any[]).length])) }, null, 2))

function readFileExists(file: string) { try { readFileSync(file); return true } catch (error: any) { if (error.code === 'ENOENT') return false; throw error } }
