/**
 * Reversible production quarantine for unreviewed public street-workout actions.
 * Mini-program public discovery requests type=STRENGTH, so the review type removes
 * these rows without deleting historical public IDs, likes, edits, or plan copies.
 *
 * Dry run: node scripts/quarantine-street-workout-public-actions.mjs
 * Apply:   node scripts/quarantine-street-workout-public-actions.mjs --execute
 * Restore one reviewed action:
 *   node scripts/quarantine-street-workout-public-actions.mjs --restore --action-id <uuid> --image-url <reviewed-url>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { bootstrapEnv } from './config/bootstrap-env.mjs'

const root = path.resolve(import.meta.dirname, '..')
const evidenceDir = path.join(root, 'artifacts/street-workout-video-review/2026-10-06')
const queuePath = path.join(root, 'artifacts/street-workout-image-review/2026-10-07/review-queue.json')
const backupPath = path.join(evidenceDir, 'public-action-types-before.json')
const journalPath = path.join(evidenceDir, 'public-action-quarantine-journal.json')
const expectedHost = 'uhlqribpagvklpqmcqvo.supabase.co'
const expectedCount = 313
const reviewType = 'STREET_REVIEW_PENDING'
const execute = process.argv.includes('--execute')
const restore = process.argv.includes('--restore')
const restoreId = process.argv[process.argv.indexOf('--action-id') + 1]
const restoreImageUrl = process.argv.includes('--image-url') ? process.argv[process.argv.indexOf('--image-url') + 1] : null

if (execute && restore) throw new Error('Choose --execute or --restore')
if (!existsSync(queuePath)) throw new Error('Review queue missing')
const queue = JSON.parse(readFileSync(queuePath, 'utf8'))
const ids = queue.map((item) => item.public_action_id)
const approved = new Map(queue
  .filter((item) => item.review_status === 'verified_image_imported' && item.reference_image_url)
  .map((item) => [item.public_action_id, item.reference_image_url]))
if (ids.length !== expectedCount || new Set(ids).size !== expectedCount) {
  throw new Error(`Review queue ID count mismatch: ${ids.length}`)
}

await bootstrapEnv({ mode: 'development', projectRoot: root })
const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || new URL(url).host !== expectedHost) throw new Error('Unexpected Supabase target')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function readRows() {
  const rows = []
  for (let start = 0; start < ids.length; start += 40) {
    const { data, error } = await db.from('community_actions')
      .select('id,name,type,url,attrs,detail,canonical_action_id')
      .in('id', ids.slice(start, start + 40))
    if (error) throw error
    rows.push(...data)
  }
  if (rows.length !== expectedCount || new Set(rows.map((row) => row.id)).size !== expectedCount) {
    throw new Error(`Database ID count mismatch: ${rows.length}`)
  }
  const canonicalIds = [...new Set(rows.map((row) => row.canonical_action_id).filter(Boolean))]
  const images = new Map()
  for (let start = 0; start < canonicalIds.length; start += 40) {
    const { data, error } = await db.from('canonical_actions').select('id,reference_image_url')
      .in('id', canonicalIds.slice(start, start + 40))
    if (error) throw error
    for (const row of data || []) images.set(row.id, row.reference_image_url)
  }
  for (const row of rows) row.reference_image_url = images.get(row.canonical_action_id) || null
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}

function hasReviewedImage(row) {
  const reviewed = queue.find((item) => item.public_action_id === row.id)
  return !!approved.get(row.id) && row.reference_image_url === approved.get(row.id) &&
    row.canonical_action_id === reviewed?.canonical_action_id
}

function isStreet(row) {
  return (row.attrs || []).includes('街头健身') ||
    String(row.detail || '').includes('街头健身') ||
    String(row.canonical_action_id || '').startsWith('street_workout_') ||
    ['跪姿俯卧撑', '平板支撑', '击掌俯卧撑', '反手引体'].includes(row.name)
}

function saveJournal(status, updatedIds, detail = null) {
  writeFileSync(journalPath, `${JSON.stringify({ status, updatedAt: new Date().toISOString(), count: updatedIds.length, ids: updatedIds, detail }, null, 2)}\n`)
}

const current = await readRows()
if (current.some((row) => !isStreet(row))) throw new Error('Queue includes non-street action')
if (!restore) {
  if (!existsSync(backupPath)) {
    if (current.some((row) => row.type !== 'STRENGTH' || row.url)) {
      throw new Error('Expected only strength actions with no videos before backup')
    }
    writeFileSync(backupPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), supabaseHost: expectedHost, rows: current }, null, 2)}\n`)
  }
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  if (backup.supabaseHost !== expectedHost || backup.rows?.length !== expectedCount) throw new Error('Backup scope mismatch')
  const before = new Map(backup.rows.map((row) => [row.id, row]))
  if (current.some((row) => !before.has(row.id) ||
    !['STRENGTH', reviewType].includes(row.type) || row.url !== before.get(row.id).url ||
    row.canonical_action_id !== before.get(row.id).canonical_action_id)) {
    throw new Error('Public action changed since backup; aborting')
  }
  if (!execute) {
    console.log(JSON.stringify({ mode: 'dry-run', targetHost: expectedHost, count: current.length, reviewPending: current.filter((row) => row.type === reviewType).length, approved: current.filter(hasReviewedImage).length, backupPath }))
    process.exit(0)
  }
  const changed = []
  for (let start = 0; start < ids.length; start += 40) {
    const targetIds = current.slice(start, start + 40).filter((row) => row.type === 'STRENGTH' && !hasReviewedImage(row)).map((row) => row.id)
    if (!targetIds.length) continue
    const { data, error } = await db.from('community_actions')
      .update({ type: reviewType })
      .in('id', targetIds)
      .eq('type', 'STRENGTH')
      .is('url', null)
      .select('id')
    if (error || data?.length !== targetIds.length) {
      saveJournal('partial', changed, error?.message || `Expected ${targetIds.length}, updated ${data?.length}`)
      throw error || new Error('Quarantine batch count mismatch')
    }
    changed.push(...targetIds)
    saveJournal('in_progress', changed)
  }
  const after = await readRows()
  if (after.some((row) => row.type !== reviewType && !(row.type === 'STRENGTH' && hasReviewedImage(row)))) {
    throw new Error('Quarantine verification failed')
  }
  saveJournal('verified', changed)
  console.log(JSON.stringify({ mode: 'execute', updated: changed.length, reviewPending: after.filter((row) => row.type === reviewType).length, approved: after.filter(hasReviewedImage).length, journalPath }))
} else {
  if (!existsSync(backupPath)) throw new Error('Backup missing')
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  if (backup.supabaseHost !== expectedHost || backup.rows?.length !== expectedCount) throw new Error('Backup scope mismatch')
  const original = backup.rows.find((row) => row.id === restoreId)
  const live = current.find((row) => row.id === restoreId)
  if (!original || !live || live.type !== reviewType || original.type !== 'STRENGTH' ||
      !restoreImageUrl || live.reference_image_url !== restoreImageUrl || !hasReviewedImage(live)) {
    throw new Error('Exact reviewed action ID and approved canonical image required for restore')
  }
  let updateQuery = db.from('community_actions')
    .update({ type: original.type })
    .eq('id', restoreId)
    .eq('type', reviewType)
  updateQuery = live.url ? updateQuery.eq('url', live.url) : updateQuery.is('url', null)
  const { data, error } = await updateQuery.select('id')
  if (error || data?.length !== 1) throw error || new Error('Restore precondition changed')
  const restored = (await readRows()).find((row) => row.id === restoreId)
  if (restored?.type !== original.type || !hasReviewedImage(restored)) throw new Error('Restore image verification failed')
  saveJournal('one_restored', [restoreId])
  console.log(JSON.stringify({ mode: 'restore', restored: 1, actionId: restoreId }))
}
