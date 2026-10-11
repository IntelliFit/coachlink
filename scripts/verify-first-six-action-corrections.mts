import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {createClient} from '@supabase/supabase-js'
import {bootstrapEnv} from './config/bootstrap-env.mjs'
const root=path.resolve(import.meta.dirname,'..')
const dir=path.join(root,'artifacts/action-image-review/first-six-2026-10-08')
const backup=JSON.parse(readFileSync(path.join(dir,'database-before.json'),'utf8'))
const correctionsPath=path.join(root,'artifacts/action-image-review/catalog-corrections.json')
const corrections=JSON.parse(readFileSync(correctionsPath,'utf8'))
await bootstrapEnv({mode:'development',projectRoot:root})
const url=process.env.NEXT_SUPABASE_URL||process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url||!key||new URL(url).host!==backup.host)throw Error('Unexpected database')
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
// Restore the existing ring technique text while keeping the normalized loading property.
if(process.argv.includes('--preserve-technique')) {
 const id='dd47b8b3-d888-4f30-a311-34fa1b098a1b'
 const patch=corrections.renames[id]
 const old=backup.public.find(row=>row.id===id)
 const detail=old.detail+'\n'+patch.detail
 const result=await db.from('community_actions').update({detail}).eq('id',id).eq('name',patch.name).eq('detail',patch.detail).select('id')
 if(result.error||result.data?.length!==1)throw result.error||Error('Technique restore precondition failed')
 patch.detail=detail
 writeFileSync(correctionsPath,JSON.stringify(corrections,null,2)+'\n')
}
const [publicResult,canonicalResult]=await Promise.all([db.from('community_actions').select('*').order('id').range(0,999),db.from('canonical_actions').select('*').order('id').range(0,999)])
if(publicResult.error||canonicalResult.error)throw publicResult.error||canonicalResult.error
const beforeReview=JSON.parse(readFileSync(path.join(root,'artifacts/action-image-review/user-first-six-before.json'),'utf8'))
const firstSixIds=new Set(beforeReview.actions.filter(r=>r.available).slice(0,144).map(r=>r.publicId))
for(const id of Object.keys(corrections.removed))if(publicResult.data.some(r=>r.id===id))throw Error('Deleted row is still present: '+id)
for(const [id,patch] of Object.entries(corrections.renames) as any) {
 const actual=publicResult.data.find(r=>r.id===id)
 for(const [field,value]of Object.entries(patch))if(!isDeepStrictEqual(actual?.[field],value))throw Error('Property mismatch: '+id+'/'+field)
}
for(const row of backup.public) {
 if(firstSixIds.has(row.id))continue
 if(!isDeepStrictEqual(row,publicResult.data.find(r=>r.id===row.id)))throw Error('Later/unrelated public action changed: '+row.id)
}
const keys=['ultrawide-supinated-muscleup','explosive-onearm-pullup-release','ring-tuck-pullup','supinated-falsegrip-abdominal-touch','supinated-falsegrip-abdominal-pull','supinated-falsegrip-abdominal-bump']
const queue=JSON.parse(readFileSync(path.join(root,'artifacts/action-image-replacement/2026-10-07/scope-queue.json'),'utf8'))
const assets=JSON.parse(readFileSync(path.join(root,'design/image-workspace/action-library/reviewed-outputs/2026-10-07/full-replacement/assets.json'),'utf8'))
const imageChecks=keys.map(key=>{
 const asset=assets.find(a=>a.key===key)
 const rows=queue.filter(r=>!r.retired&&r.imageUrl?.includes('/'+key+'-'))
 for(const row of rows)if(canonicalResult.data.find(c=>c.id===row.canonicalId)?.reference_image_url!==row.imageUrl)throw Error('Canonical image mismatch: '+key)
 return {key,reviewedAt:asset.reviewedAt,publicIds:rows.map(r=>r.publicId),sha256:asset.sha256}
})
const report={checkedAt:new Date().toISOString(),deleted:18,merged:2,renamed:3,laterPublicRowsUnchanged:true,publicCount:publicResult.data.length,canonicalCount:canonicalResult.data.length,imageChecks}
writeFileSync(path.join(dir,'final-database-audit.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
