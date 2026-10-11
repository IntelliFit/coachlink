/** Correct the mistaken video import with a visually reviewed still. Dry-run by default. */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

throw new Error('Retired: video frames are pose references only. Final CoachLink assets must be generated in the existing anatomy style. See promote-reviewed-plank-illustration.mts.')

const root = path.resolve(import.meta.dirname, '..')
const evidenceDir = path.join(root, 'artifacts/street-workout-image-review/2026-10-07')
const sourceFile = path.join(evidenceDir, 'forearm-plank-reviewed.jpg')
const actionId = '8b83f52f-1d03-406b-8e64-e921f813be18'
const canonicalId = 'auto_e051e34349e66344350282be'
const expectedSha = '8cfa08d29563b697b4c96c9987d1e68be2b07540f10a7a9ac0eb2831a9f4877d'
const expectedHost = 'uhlqribpagvklpqmcqvo.supabase.co'
const mistakenVideoUrl = 'https://cdn-videos.coachlink.fit/street-workout-reviewed/8b83f52f-1d03-406b-8e64-e921f813be18/forearm-plank-dvids-825280-a50f25bd.mp4'
const imageKey = `street-workout-reviewed/${canonicalId}/forearm-plank-dvids-825280-${expectedSha.slice(0, 8)}.jpg`
const { bootstrapEnv } = await import('./config/bootstrap-env.mjs')
await bootstrapEnv({ mode: 'development', projectRoot: root })
const dbUrl = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dbUrl || !serviceKey || new URL(dbUrl).host !== expectedHost) throw new Error('Unexpected database target')
if (createHash('sha256').update(readFileSync(sourceFile)).digest('hex') !== expectedSha) throw new Error('Reviewed image hash mismatch')
const { cosUploadFile, buildPublicUrl } = await import('../src/lib/cos')
const expectedUrl = buildPublicUrl('action-reference-images', imageKey)
const db = createClient(dbUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const publicResult = await db.from('community_actions').select('id,name,type,url,canonical_action_id').eq('id', actionId).single()
const canonicalResult = await db.from('canonical_actions').select('id,reference_image_url').eq('id', canonicalId).single()
if (publicResult.error || canonicalResult.error) throw publicResult.error || canonicalResult.error
const publicRow = publicResult.data!
const canonicalRow = canonicalResult.data!
if (publicRow.name !== '平板支撑' || publicRow.canonical_action_id !== canonicalId ||
    !['STRENGTH', 'STREET_REVIEW_PENDING'].includes(publicRow.type) ||
    (publicRow.url !== mistakenVideoUrl && publicRow.url !== null) ||
    (canonicalRow.reference_image_url !== null && canonicalRow.reference_image_url !== expectedUrl)) {
  throw new Error('Action or image changed; inspect before correcting')
}
const copiedRows: Record<string, { id: string; url: string }[]> = {}
for (const table of ['student_actions', 'coach_actions']) {
  const { data, error } = await db.from(table).select('id,url').eq('url', mistakenVideoUrl)
  if (error) throw error
  copiedRows[table] = data || []
}
mkdirSync(evidenceDir, { recursive: true })
const backupPath = path.join(evidenceDir, 'forearm-plank-before-correction.json')
if (!existsSync(backupPath)) writeFileSync(backupPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), supabaseHost: expectedHost, publicRow, canonicalRow, copiedRows }, null, 2)}\n`)
const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
if (backup.supabaseHost !== expectedHost || backup.publicRow?.id !== actionId || backup.canonicalRow?.id !== canonicalId) throw new Error('Backup scope mismatch')
const plan = {
  actionId, canonicalId, imageUrl: expectedUrl, sha256: expectedSha,
  sourceUrl: 'https://www.dvidshub.net/video/825280/forearm-plank',
  sourceVideoSha256: 'fd9faaca3b52db86f15a4e0de0456eca693239a5173a54a33f916dcf464ac5f7',
  sourceFrameSeconds: 120, crop: '640:640:352:64',
  credit: 'U.S. Air Force, Staff Sgt. Randall Moose / 301st Fighter Wing',
  license: 'Public domain (DVIDS work of a U.S. federal employee)',
  copiedVideoCounts: Object.fromEntries(Object.entries(copiedRows).map(([table, rows]) => [table, rows.length])),
}
if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ mode: 'dry-run', ...plan }))
  process.exit(0)
}
const journalPath = path.join(evidenceDir, 'forearm-plank-image-import.json')
const journal = (status: string) => writeFileSync(journalPath, `${JSON.stringify({ ...plan, status, updatedAt: new Date().toISOString() }, null, 2)}\n`)
journal('starting')
await cosUploadFile('action-reference-images', imageKey, sourceFile, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' })
const response = await fetch(expectedUrl)
if (!response.ok || !response.headers.get('content-type')?.includes('image/jpeg') ||
    createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex') !== expectedSha) throw new Error('CDN image verification failed')
if (canonicalRow.reference_image_url !== expectedUrl) {
  const { data, error } = await db.from('canonical_actions').update({ reference_image_url: expectedUrl })
    .eq('id', canonicalId).is('reference_image_url', null).select('id')
  if (error || data?.length !== 1) throw error || new Error('Canonical image precondition changed')
}
journal('image_imported')
if (publicRow.url === mistakenVideoUrl || publicRow.type !== 'STRENGTH') {
  let query = db.from('community_actions').update({ url: null, type: 'STRENGTH' }).eq('id', actionId).eq('type', publicRow.type)
  query = publicRow.url ? query.eq('url', mistakenVideoUrl) : query.is('url', null)
  const { data, error } = await query.select('id')
  if (error || data?.length !== 1) throw error || new Error('Public video precondition changed')
}
for (const [table, rows] of Object.entries(copiedRows)) {
  // Only remove this task's exact mistaken URL, preserving all other user media.
  for (const row of rows) {
    const { data, error } = await db.from(table).update({ url: null }).eq('id', row.id).eq('url', mistakenVideoUrl).select('id')
    if (error || data?.length !== 1) throw error || new Error(`Copied video precondition changed: ${table}`)
  }
}
const { data: afterPublic, error: publicError } = await db.from('community_actions').select('type,url,canonical_action_id').eq('id', actionId).single()
const { data: afterImage, error: imageError } = await db.from('canonical_actions').select('reference_image_url').eq('id', canonicalId).single()
if (publicError || imageError || afterPublic?.type !== 'STRENGTH' || afterPublic?.url !== null || afterImage?.reference_image_url !== expectedUrl) throw new Error('Correction readback failed')
for (const table of ['student_actions', 'coach_actions']) {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq('url', mistakenVideoUrl)
  if (error || count !== 0) throw error || new Error(`Mistaken video remains: ${table}`)
}
journal('verified')
console.log(JSON.stringify({ status: 'verified', ...plan, videoUrl: null }))
