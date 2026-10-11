/** Replace this task's repeated three-pose plank with its reviewed single static posture. */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(import.meta.dirname, '..')
const evidenceDir = path.join(root, 'artifacts/street-workout-image-review/2026-10-07')
const sourceFile = path.join(root, 'design/image-workspace/action-library/reviewed-outputs/2026-10-07/plank-v4-single.png')
const canonicalId = 'auto_e051e34349e66344350282be'
const publicId = '8b83f52f-1d03-406b-8e64-e921f813be18'
const expectedSha = '5e63bb0464bedef687efb2dad6c359ba0e2447ab60084acaceedf909629f01bb'
const expectedHost = 'uhlqribpagvklpqmcqvo.supabase.co'
const previousUrl = `https://cdn-assets.coachlink.fit/action-reference-images/street-workout-reviewed/${canonicalId}/plank-v4-generated-a91810ea.png`
const { bootstrapEnv } = await import('./config/bootstrap-env.mjs')
await bootstrapEnv({ mode: 'development', projectRoot: root })
const dbUrl = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dbUrl || !serviceKey || new URL(dbUrl).host !== expectedHost) throw new Error('Unexpected database target')
const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')
if (hash(readFileSync(sourceFile)) !== expectedSha) throw new Error('Reviewed generated image hash mismatch')
const { cosUploadFile, buildPublicUrl } = await import('../src/lib/cos')
const imageKey = `street-workout-reviewed/${canonicalId}/plank-v4-single-${expectedSha.slice(0, 8)}.png`
const imageUrl = buildPublicUrl('action-reference-images', imageKey)
const db = createClient(dbUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: canonical, error: canonicalError } = await db.from('canonical_actions').select('id,name,reference_image_url').eq('id', canonicalId).single()
const { data: action, error: actionError } = await db.from('community_actions').select('id,name,type,url,canonical_action_id').eq('id', publicId).single()
if (canonicalError || actionError) throw canonicalError || actionError
if (canonical?.name !== '平板支撑' || ![previousUrl, imageUrl].includes(canonical.reference_image_url) || action?.canonical_action_id !== canonicalId || action?.url !== null || action?.type !== 'STRENGTH') throw new Error('Plank media changed; inspect before replacing')
const backupPath = path.join(evidenceDir, 'plank-before-single-pose-replacement.json')
if (!existsSync(backupPath)) writeFileSync(backupPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), supabaseHost: expectedHost, canonical, action }, null, 2)}\n`)
const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
if (backup.supabaseHost !== expectedHost || backup.canonical?.id !== canonicalId || backup.action?.id !== publicId) throw new Error('Replacement backup mismatch')
const plan = { publicId, canonicalId, imageUrl, sha256: expectedSha, poseCount: 1, assetKind: 'generated-illustration', styleReference: 'CoachLink v4 persona sheet + original street-workout library illustrations', poseReference: 'https://www.dvidshub.net/video/825280/forearm-plank', generatedWith: 'built-in image_gen', localFile: path.relative(root, sourceFile), reviewedAt: '2026-10-07' }
if (!process.argv.includes('--execute')) { console.log(JSON.stringify({ mode: 'dry-run', ...plan })); process.exit(0) }
const journalPath = path.join(evidenceDir, 'plank-single-pose-replacement.json')
const journal = (status: string) => writeFileSync(journalPath, `${JSON.stringify({ ...plan, status, updatedAt: new Date().toISOString() }, null, 2)}\n`)
journal('starting')
await cosUploadFile('action-reference-images', imageKey, sourceFile, { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' })
const response = await fetch(imageUrl)
if (!response.ok || !response.headers.get('content-type')?.includes('image/png') || hash(Buffer.from(await response.arrayBuffer())) !== expectedSha) throw new Error('Generated CDN asset verification failed')
if (canonical.reference_image_url !== imageUrl) {
  const { data, error } = await db.from('canonical_actions').update({ reference_image_url: imageUrl }).eq('id', canonicalId).eq('reference_image_url', previousUrl).select('id')
  if (error || data?.length !== 1) throw error || new Error('Image replacement precondition changed')
}
const { data: after, error } = await db.from('canonical_actions').select('reference_image_url').eq('id', canonicalId).single()
if (error || after?.reference_image_url !== imageUrl) throw error || new Error('Generated image readback failed')
journal('verified')
console.log(JSON.stringify({ status: 'verified', ...plan }))
