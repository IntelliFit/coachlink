import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { bootstrapEnv } from './config/bootstrap-env.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'artifacts/action-image-replacement/2026-10-07')
const assetPath = path.join(root, 'design/image-workspace/action-library/reviewed-outputs/2026-10-07/full-replacement/assets.json')
const approvalPath = path.join(root, 'src/lib/streetWorkoutImageApprovals.json')
const assets = JSON.parse(readFileSync(assetPath, 'utf8'))
const snapshot = JSON.parse(readFileSync(path.join(dir, 'catalog-current.json'), 'utf8'))
const correctionsPath = path.join(root, 'artifacts/action-image-review/catalog-corrections.json')
const corrections = existsSync(correctionsPath) ? JSON.parse(readFileSync(correctionsPath, 'utf8')) : {renames:{},removed:{}}
const selectedKeys = process.argv.find(arg => arg.startsWith('--keys='))?.slice(7).split(',')
const execute = process.argv.includes('--execute')
if (selectedKeys && selectedKeys.some(key => !assets.some(asset => asset.key === key))) throw new Error('Unknown batch key; quote comma-separated --keys argument in PowerShell')
await bootstrapEnv({ mode: 'development', projectRoot: root })
const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || new URL(url).host !== 'uhlqribpagvklpqmcqvo.supabase.co') throw new Error('Unexpected database')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { cosUploadFile, buildPublicUrl } = await import('../src/lib/cos')
const hash = (body: Buffer) => createHash('sha256').update(body).digest('hex')
const approvals = JSON.parse(readFileSync(approvalPath, 'utf8'))
mkdirSync(dir, { recursive: true })
const results = []
for (const asset of assets.filter(item => !selectedKeys || selectedKeys.includes(item.key))) {
  if (asset.reviewStatus !== 'visually_reviewed' || asset.assetKind !== 'generated-illustration' || !asset.prompt || !asset.source || ![1,2,3].includes(asset.poseCount)) throw new Error(`Unreviewed asset: ${asset.key}`)
  const localFile = path.resolve(root, asset.localFile)
  if (!localFile.startsWith(path.join(root, 'design/image-workspace/action-library/reviewed-outputs') + path.sep)) throw new Error('Unexpected asset path')
  const body = readFileSync(localFile)
  const sha256 = hash(body)
  if (!asset.sha256 || asset.sha256 !== sha256) throw new Error(`Reviewed hash mismatch: ${asset.key}`)
  const names = asset.targetNames || [asset.name]
  const targets = snapshot.public.filter(row => !corrections.removed[row.id] && (names.includes(row.name) || names.includes(corrections.renames[row.id]?.name)) && ['STRENGTH','CARDIO','STREET_REVIEW_PENDING'].includes(row.type)).map(row => ({...row,name:corrections.renames[row.id]?.name || row.name}))
  if (!targets.length || targets.some(row => !row.canonical_action_id)) throw new Error(`Missing exact targets: ${asset.key}`)
  const canonicalIds = [...new Set(targets.map(row => row.canonical_action_id))] as string[]
  const objectKey = `reviewed-library-2026-10-07/${asset.key}-${sha256.slice(0,12)}.png`
  const imageUrl = buildPublicUrl('action-reference-images', objectKey)
  if (!execute) { results.push({ key:asset.key, targets:targets.map(row => ({id:row.id,name:row.name})),canonicalIds,sha256,imageUrl }); continue }
  const { data: beforeCanonical, error: cError } = await db.from('canonical_actions').select('id,name,reference_image_url').in('id',canonicalIds)
  const { data: beforePublic, error: pError } = await db.from('community_actions').select('id,name,type,canonical_action_id').in('id',targets.map(row=>row.id))
  if (cError || pError || beforeCanonical?.length !== canonicalIds.length || beforePublic?.length !== targets.length) throw cError || pError || new Error('Target count changed')
  for (const target of targets) {
    const current = beforePublic.find(row => row.id === target.id)
    if (current?.name !== target.name || current?.canonical_action_id !== target.canonical_action_id || ![target.type,'STRENGTH'].includes(current?.type)) throw new Error(`Target identity changed: ${target.id}`)
  }
  const backupPath = path.join(dir, `before-${asset.key}.json`)
  if (!existsSync(backupPath)) writeFileSync(backupPath, JSON.stringify({savedAt:new Date().toISOString(),host:new URL(url).host,canonical:beforeCanonical,public:beforePublic,asset:{...asset,sha256,imageUrl}},null,2)+'\n')
  await cosUploadFile('action-reference-images',objectKey,localFile,{contentType:'image/png',cacheControl:'public, max-age=31536000, immutable'})
  const cdnResponse = await fetch(imageUrl,{signal:AbortSignal.timeout(60000)})
  if (!cdnResponse.ok || !cdnResponse.headers.get('content-type')?.includes('image/png') || hash(Buffer.from(await cdnResponse.arrayBuffer())) !== sha256) throw new Error(`CDN mismatch: ${asset.key}`)
  for (const canonical of beforeCanonical) {
    if (canonical.reference_image_url === imageUrl) continue
    let update = db.from('canonical_actions').update({reference_image_url:imageUrl}).eq('id',canonical.id)
    update = canonical.reference_image_url === null ? update.is('reference_image_url',null) : update.eq('reference_image_url',canonical.reference_image_url)
    const {data,error}=await update.select('id')
    if(error || data?.length!==1) throw error || new Error(`Canonical changed: ${canonical.id}`)
  }
  const {data:canonicalAfter,error:afterError}=await db.from('canonical_actions').select('id,reference_image_url').in('id',canonicalIds)
  if(afterError || canonicalAfter?.some(row=>row.reference_image_url!==imageUrl)) throw afterError || new Error('Image readback failed')
  for (const target of targets) {
    approvals[target.id]={canonicalActionId:target.canonical_action_id,imageUrl,sourceUrl:asset.source,credit:'CoachLink generated anatomy illustration; online material used only for posture research',license:'Project-generated illustration',reviewedAt:asset.reviewedAt,assetKind:asset.assetKind,styleReference:asset.styleReference,poseCount:asset.poseCount}
  }
  writeFileSync(approvalPath,JSON.stringify(approvals,null,2)+'\n')
  for(const target of beforePublic.filter(row=>row.type==='STREET_REVIEW_PENDING')) {
    const {data,error}=await db.from('community_actions').update({type:'STRENGTH'}).eq('id',target.id).eq('type','STREET_REVIEW_PENDING').eq('canonical_action_id',target.canonical_action_id).select('id')
    if(error || data?.length!==1) throw error || new Error(`Public action changed: ${target.id}`)
  }
  const {data:publicAfter,error:publicAfterError}=await db.from('community_actions').select('id,type,canonical_action_id').in('id',targets.map(row=>row.id))
  if(publicAfterError || publicAfter?.some(row=>row.type==='STREET_REVIEW_PENDING')) throw publicAfterError || new Error('Public restore failed')
  const result={key:asset.key,status:'verified',sha256,imageUrl,poseCount:asset.poseCount,publicIds:targets.map(row=>row.id),canonicalIds,verifiedAt:new Date().toISOString()}
  writeFileSync(path.join(dir,`result-${asset.key}.json`),JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify(result))
  results.push(result)
}
writeFileSync(path.join(dir,execute?'last-batch-result.json':'batch-dry-run.json'),JSON.stringify(results,null,2)+'\n')
if(!execute) console.log(JSON.stringify({mode:'dry-run',assets:results.length,publicActions:results.reduce((n,r)=>n+r.targets.length,0)}))
