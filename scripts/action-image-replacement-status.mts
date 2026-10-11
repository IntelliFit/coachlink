import { readFileSync,writeFileSync,readdirSync,existsSync } from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const dir=path.join(root,'artifacts/action-image-replacement/2026-10-07')
const snapshot=JSON.parse(readFileSync(path.join(dir,'catalog-current.json'),'utf8'))
const approvals=JSON.parse(readFileSync(path.join(root,'src/lib/streetWorkoutImageApprovals.json'),'utf8'))
const results=readdirSync(dir).filter(name=>/^result-.+\.json$/.test(name)).map(name=>JSON.parse(readFileSync(path.join(dir,name),'utf8')))
const verified=new Map(results.flatMap(result=>result.publicIds.map(id=>[id,result])))
const plankId='8b83f52f-1d03-406b-8e64-e921f813be18'
const queue=snapshot.public.filter(row=>['STRENGTH','CARDIO','STREET_REVIEW_PENDING'].includes(row.type)).map(row=>({publicId:row.id,name:row.name,originalType:row.type,canonicalId:row.canonical_action_id,detail:row.detail,status:row.id===plankId?'replaced_verified':verified.has(row.id)&&approvals[row.id]?'replaced_verified':'pending_exact_pose_research_and_generation',imageUrl:row.id===plankId?'https://cdn-assets.coachlink.fit/action-reference-images/street-workout-reviewed/auto_e051e34349e66344350282be/plank-v4-single-5e63bb04.png':approvals[row.id]?.imageUrl||null,poseCount:row.id===plankId?1:approvals[row.id]?.poseCount||null}))
const correctionsPath=path.join(root,'artifacts/action-image-review/catalog-corrections.json')
if(existsSync(correctionsPath)) {
  const corrections=JSON.parse(readFileSync(correctionsPath,'utf8'))
  for(const row of queue) {
    const rename=corrections.renames[row.publicId]
    if(rename) Object.assign(row,{name:rename.name,detail:rename.detail,attrs:rename.attrs,itemSchema:rename.item_schema})
    const removed=corrections.removed[row.publicId]
    if(removed) Object.assign(row,{status:removed.status,imageUrl:null,poseCount:null,retired:true,retirementReason:removed.reason,mergedIntoId:removed.mergedIntoId,mergedIntoName:removed.mergedIntoName})
  }
}
const status={checkedAt:new Date().toISOString(),scope:queue.length,replaced:queue.filter(row=>row.status==='replaced_verified').length,pending:queue.filter(row=>!row.retired&&row.status!=='replaced_verified').length,deleted:queue.filter(row=>row.status==='user_deleted').length,merged:queue.filter(row=>row.status==='user_merged').length,generatedAssets:results.length+1,source:'precise upload/readback journals, user catalog corrections and local approvals; no global completion claim'}
writeFileSync(path.join(dir,'scope-queue.json'),JSON.stringify(queue,null,2)+'\n')
writeFileSync(path.join(dir,'status.json'),JSON.stringify(status,null,2)+'\n')
console.log(JSON.stringify(status))
