/**
 * Hide unreviewed street-workout reference images without deleting actions.
 *
 * Usage:
 *   node scripts/quarantine-street-workout-reference-images.mjs
 *   node scripts/quarantine-street-workout-reference-images.mjs --execute
 *   node scripts/quarantine-street-workout-reference-images.mjs --shared --execute
 *   node scripts/quarantine-street-workout-reference-images.mjs --restore
 *
 * --shared targets six imported street images on canonicals also used outside
 * the bulk street category. Each scope has a separate backup and journal.
 * The backup is created before any update and checked again on execution.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { bootstrapEnv } from './config/bootstrap-env.mjs'

const root = path.resolve(import.meta.dirname, '..')
const shared = process.argv.includes('--shared')
const sharedIds = [
  'chinup',
  'public_tpl_2ddefe1f-4753-4dea-b5f3-2e0eda7633a1',
  'public_tpl_cddd563b-25a2-4ff7-a65a-7c2cf7d9688f',
  'auto_2a39edc2104deb6388428867',
  'custom_46ad107f-d1a7-480c-a526-a09e182dde12',
  'auto_12278d3ac6fc9bc9b60b8ce0',
]
const backupPath = path.join(root, `artifacts/street-workout-video-review/2026-10-06/${shared ? 'shared-canonical-images-before' : 'canonical-images-before'}.json`)
const journalPath = path.join(root, `artifacts/street-workout-video-review/2026-10-06/${shared ? 'shared-image-quarantine-journal' : 'image-quarantine-journal'}.json`)
const expectedHost = 'uhlqribpagvklpqmcqvo.supabase.co'
const expectedCount = shared ? sharedIds.length : 307
const execute = process.argv.includes('--execute')
const restore = process.argv.includes('--restore')

if (execute && restore) throw new Error('Choose --execute or --restore')
await bootstrapEnv({ mode: 'development', projectRoot: root })
const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || new URL(url).host !== expectedHost) throw new Error('Unexpected Supabase target')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function currentRows() {
  let query = db.from('canonical_actions')
    .select('id,name,category,reference_image_url')
  query = shared ? query.in('id', sharedIds) : query.like('category', '街头健身%')
  const { data, error } = await query.order('id').limit(1000)
  if (error) throw error
  if (data.length !== expectedCount) throw new Error(`Expected ${expectedCount} street actions, got ${data.length}`)
  if (shared && data.some((row) => !sharedIds.includes(row.id))) throw new Error('Unexpected shared action')
  return data
}

function saveJournal(status, ids, detail = null) {
  writeFileSync(journalPath, `${JSON.stringify({ status, updatedAt: new Date().toISOString(), count: ids.length, ids, detail }, null, 2)}\n`)
}

const current = await currentRows()
if (!restore) {
  if (!existsSync(backupPath)) {
    if (shared && current.some((row) => !row.reference_image_url?.includes('street-workout.png'))) {
      throw new Error('Shared image is not an imported street-workout image; aborting')
    }
    mkdirSync(path.dirname(backupPath), { recursive: true })
    writeFileSync(backupPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), supabaseHost: expectedHost, rows: current }, null, 2)}\n`)
  }
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  if (backup.supabaseHost !== expectedHost || backup.rows?.length !== expectedCount) throw new Error('Backup scope mismatch')
  const originals = new Map(backup.rows.map((row) => [row.id, row.reference_image_url]))
  if (current.some((row) => !originals.has(row.id) || (row.reference_image_url !== null && row.reference_image_url !== originals.get(row.id)))) {
    throw new Error('Images changed since backup; aborting')
  }
  if (!execute) {
    console.log(JSON.stringify({ mode: 'dry-run', targetHost: expectedHost, count: current.length, visibleImages: current.filter((row) => row.reference_image_url).length, backupPath }))
    process.exit(0)
  }
  const changed = []
  for (let offset = 0; offset < current.length; offset += 40) {
    const ids = current.slice(offset, offset + 40).filter((row) => row.reference_image_url).map((row) => row.id)
    if (ids.length === 0) continue
    let update = db.from('canonical_actions')
      .update({ reference_image_url: null })
      .in('id', ids)
    if (!shared) update = update.like('category', '街头健身%')
    const { data, error } = await update.not('reference_image_url', 'is', null).select('id')
    if (error || data?.length !== ids.length) {
      saveJournal('partial', changed, error?.message || `Expected ${ids.length}, updated ${data?.length}`)
      throw error || new Error('Image quarantine batch count mismatch')
    }
    changed.push(...ids)
    saveJournal('in_progress', changed)
  }
  const remaining = (await currentRows()).filter((row) => row.reference_image_url)
  if (remaining.length) throw new Error(`${remaining.length} images still visible`)
  saveJournal('verified', changed)
  console.log(JSON.stringify({ mode: 'execute', updated: changed.length, remaining: 0, journalPath }))
} else {
  if (!existsSync(backupPath)) throw new Error('Backup missing')
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  if (backup.supabaseHost !== expectedHost || backup.rows?.length !== expectedCount) throw new Error('Backup scope mismatch')
  const restored = []
  for (const original of backup.rows) {
    const live = current.find((row) => row.id === original.id)
    if (!live || live.reference_image_url || !original.reference_image_url) continue
    const { data, error } = await db.from('canonical_actions')
      .update({ reference_image_url: original.reference_image_url })
      .eq('id', original.id)
      .is('reference_image_url', null)
      .select('id')
    if (error) throw error
    if (data?.length === 1) restored.push(original.id)
  }
  saveJournal('restored', restored, { backupSha256: createHash('sha256').update(readFileSync(backupPath)).digest('hex') })
  console.log(JSON.stringify({ mode: 'restore', restored: restored.length }))
}
