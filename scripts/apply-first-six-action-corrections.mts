import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { isDeepStrictEqual } from 'node:util'
import { bootstrapEnv } from './config/bootstrap-env.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'artifacts/action-image-review/first-six-2026-10-08')
const plan = JSON.parse(readFileSync(path.join(dir, 'correction-plan.json'), 'utf8'))
const backup = JSON.parse(readFileSync(path.join(dir, 'database-before.json'), 'utf8'))
const beforeReview = JSON.parse(readFileSync(path.join(root, 'artifacts/action-image-review/user-first-six-before.json'), 'utf8'))
const orderPath = path.join(root, 'artifacts/action-image-review/order.json')
const correctionsPath = path.join(root, 'artifacts/action-image-review/catalog-corrections.json')
const execute = process.argv.includes('--execute')
const renames = plan.renamePlan.map(change => {
  const old = backup.public.find(row => row.id === change.publicId)
  if (old?.name !== change.oldName) throw new Error('Rename backup mismatch')
  const attrs = [...new Set([...(old.attrs || []).filter(attr => !attr.startsWith('难度')), '组数', '次数', '强度', '休息时间', '可调负重'])]
  const load = { adjustable: true, modes: ['kg', 'bodyweight_percent'], defaultMode: 'kg',
    suggestedBodyweightPercent: change.options, percentMeaning: '外加负重 / 自身体重 × 100%；不是1RM百分比' }
  const technique = old.detail && !old.detail.includes('原动作库难度') ? `${old.detail}\n` : ''
  const detail = `${technique}${change.newName}。负重是可调参数，可直接填写外加重量（kg），或按自身体重比例设置。${change.options.length ? '50%、100%、150%等负重水平不是不同动作。' : '可做自重版本或加负重版本。'}`
  return { ...change, canonicalId: old.canonical_action_id,
    patch: { name: change.newName, attrs, detail, item_schema: { ...(old.item_schema || {}), load }, includesBodyWeight: true,
      enableAutoWeightCompute: old.enableAutoWeightCompute } }
})
const removed = [...plan.deleteRows.map(row => ({ ...row, status: 'user_deleted', reason: '用户明确要求从公共动作库删除' })),
  ...renames.flatMap(row => row.mergedIds.map(id => ({ publicId: id, name: backup.public.find(item => item.id === id).name,
    status: 'user_merged', mergedIntoId: row.publicId, mergedIntoName: row.newName, reason: `已并入${row.newName}，负重比例改为属性` })))]
const corrections = { appliedAt: new Date().toISOString(), lastReviewedPublicId: plan.lastReviewedPublicId,
  renames: Object.fromEntries(renames.map(row => [row.publicId, row.patch])),
  removed: Object.fromEntries(removed.map(row => [row.publicId, row])) }
if (!execute) {
  writeFileSync(path.join(dir, 'mutation-dry-run.json'), JSON.stringify({ renames, removed }, null, 2) + '\n')
  console.log(JSON.stringify({ mode: 'dry-run', rename: renames.map(row => row.newName), delete: removed.length }))
  process.exit(0)
}
await bootstrapEnv({ mode: 'development', projectRoot: root })
const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || new URL(url).host !== backup.host || backup.host !== 'uhlqribpagvklpqmcqvo.supabase.co') throw new Error('Unexpected database')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const affectedIds = [...renames.map(row => row.publicId), ...removed.map(row => row.publicId)]
const currentResult = await db.from('community_actions').select('*').in('id', affectedIds)
if (currentResult.error) throw currentResult.error
for (const old of backup.public.filter(row => affectedIds.includes(row.id))) {
  const current = currentResult.data.find(row => row.id === old.id)
  const rename = renames.find(row => row.publicId === old.id)
  if (!current && removed.some(row => row.publicId === old.id)) continue
  if (!current || current.canonical_action_id !== old.canonical_action_id || ![old.name, rename?.newName].includes(current.name)) {
    throw new Error(`Target changed: ${old.id}`)
  }
  if (current.name === old.name && (JSON.stringify(current.attrs) !== JSON.stringify(old.attrs) || JSON.stringify(current.item_schema) !== JSON.stringify(old.item_schema))) {
    throw new Error(`Attributes changed since backup: ${old.id}`)
  }
}
const results: any[] = []
const journal = () => writeFileSync(path.join(dir, 'mutation-results.json'), JSON.stringify({ updatedAt: new Date().toISOString(), results }, null, 2) + '\n')
// Retain canonical IDs and private/historical references. Remove actual public rows, not just hide them.
for (const change of renames) {
  const current = currentResult.data.find(row => row.id === change.publicId)
  const result = await db.from('community_actions').update(change.patch).eq('id', change.publicId)
    .eq('name', current.name).eq('canonical_action_id', change.canonicalId).select('id,name,attrs,item_schema,detail')
  if (result.error || result.data?.length !== 1) throw result.error || new Error('Rename precondition failed')
  const oldCanonical = backup.canonical.find(row => row.id === change.canonicalId)
  const aliases = [...new Set([...(oldCanonical.aliases || []), change.oldName])]
  const canonicalResult = await db.from('canonical_actions').update({ name: change.newName, aliases }).eq('id', change.canonicalId)
    .in('name', [oldCanonical.name, change.newName]).select('id,name')
  if (canonicalResult.error || canonicalResult.data?.length !== 1) throw canonicalResult.error || new Error('Canonical rename failed')
  results.push({ operation: 'rename', publicId: change.publicId, name: change.newName }); journal()
}
for (const removal of removed) {
  const current = currentResult.data.find(row => row.id === removal.publicId)
  if (!current) { results.push({ operation: removal.status, publicId: removal.publicId, alreadyRemoved: true }); continue }
  const result = await db.from('community_actions').delete().eq('id', removal.publicId).eq('name', current.name)
    .eq('canonical_action_id', current.canonical_action_id).select('id')
  if (result.error || result.data?.length !== 1) throw result.error || new Error(`Delete precondition failed: ${removal.publicId}`)
  results.push({ operation: removal.status, publicId: removal.publicId, name: current.name }); journal()
}
const after = await db.from('community_actions').select('*').in('id', affectedIds)
if (after.error || after.data.length !== renames.length || removed.some(row => after.data.some(item => item.id === row.publicId))) throw after.error || new Error('Removal readback failed')
for (const change of renames) {
  const actual = after.data.find(row => row.id === change.publicId)
  for (const [field, value] of Object.entries(change.patch)) if (!isDeepStrictEqual(actual[field], value)) throw new Error(`Rename readback failed: ${field}`)
}
for (const table of ['student_actions', 'coach_actions']) {
  const original = backup.dependencies[table]
  if (!original.length) continue
  const readback = await db.from(table).select('id,canonical_action_id,name').in('id', original.map(row => row.id))
  if (readback.error || JSON.stringify(readback.data.sort((a,b) => a.id.localeCompare(b.id))) !== JSON.stringify([...original].sort((a,b) => a.id.localeCompare(b.id)))) {
    throw readback.error || new Error('Private/historical action references changed')
  }
}
// Freeze the exact original review slots, including deletion/merge markers, before changing names.
writeFileSync(orderPath, JSON.stringify({ schemaVersion: 1, frozenAt: new Date().toISOString(),
  publicIds: beforeReview.actions.map(row => row.publicId), lastReviewedPublicId: plan.lastReviewedPublicId,
  lastReviewedName: plan.lastReviewedName }, null, 2) + '\n')
writeFileSync(correctionsPath, JSON.stringify(corrections, null, 2) + '\n')
writeFileSync(path.join(dir, 'database-readback.json'), JSON.stringify({ checkedAt: new Date().toISOString(), actions: after.data, privateReferencesUnchanged: true }, null, 2) + '\n')
console.log(JSON.stringify({ mode: 'verified', deleted: plan.deleteRows.length, mergedDuplicates: removed.length - plan.deleteRows.length, renamed: renames.length, privateReferencesUnchanged: true }))
