import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const dir=path.join(root,'artifacts/action-image-replacement/2026-10-07')
const queue=JSON.parse(readFileSync(path.join(dir,'scope-queue.json'),'utf8'))
const expected=queue.filter(r=>r.status==='replaced_verified')
const results=await Promise.all(['https://coachlink.fit','https://dev.coachlink.fit'].map(async origin=>{
 const rows=[], failures=[]
 for(const type of ['STRENGTH','CARDIO']){
  let response,body
  for(let attempt=0;attempt<2;attempt++){
   try{response=await fetch(origin+'/api/public-action-lib/list-actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({page:1,limit:1000,type}),signal:AbortSignal.timeout(30000)});body=await response.json();break}catch(e){if(attempt===1)failures.push(type+': '+String(e))}
  }
  if(!response?.ok||!body?.success||!Array.isArray(body?.data?.actions)){failures.push(type+': HTTP '+response?.status+' / '+body?.message);continue}
  if(body.data.actions.length!==body.data.totalCount)failures.push(type+': incomplete page')
  rows.push(...body.data.actions)
 }
 const checked=[]
 for(const r of expected){const a=rows.find(x=>x.id===r.publicId);if(!a){failures.push('Missing '+r.name);continue}if(a.reference_image_url!==r.imageUrl)failures.push('Image mismatch '+r.name);checked.push({id:a.id,name:a.name,imageUrl:a.reference_image_url})}
 const unverifiedVisible=rows.filter(a=>!expected.some(r=>r.publicId===a.id)).map(a=>({id:a.id,name:a.name,type:a.type}))
 if(unverifiedVisible.length)failures.push('Unexpected visible training actions: '+unverifiedVisible.length)
 return {origin,visibleCount:rows.length,checkedCount:checked.length,failures,unverifiedVisible,checked}
}))
const report={checkedAt:new Date().toISOString(),mode:'anonymous-read-only-public-api',expectedCount:expected.length,results}
writeFileSync(path.join(dir,'live-public-api-verification.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({...report,results:results.map(({checked,...r})=>r)}))
if(results.some(r=>r.failures.length))process.exitCode=1
