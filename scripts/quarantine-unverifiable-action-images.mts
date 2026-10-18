import {createClient} from '@supabase/supabase-js'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import path from 'node:path'
import {bootstrapEnv} from './config/bootstrap-env.mjs'
const root=path.resolve(import.meta.dirname,'..')
const dir=path.join(root,'artifacts/action-image-replacement/2026-10-07')
const names=['单杠卡指俄挺','单杠卡指飞机','仙人挂画','手肘松解']
const snapshot=JSON.parse(readFileSync(path.join(dir,'catalog-current.json'),'utf8'))
const approvals=JSON.parse(readFileSync(path.join(root,'src/lib/streetWorkoutImageApprovals.json'),'utf8'))
const targets=snapshot.public.filter(row=>names.includes(row.name))
if(targets.length!==names.length||targets.some(row=>approvals[row.id]))throw Error('Scope or approval mismatch')
await bootstrapEnv({mode:'development',projectRoot:root})
const url=process.env.NEXT_SUPABASE_URL||process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url||!key||new URL(url).host!=='uhlqribpagvklpqmcqvo.supabase.co')throw Error('Unexpected database')
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const ids=targets.map(r=>r.id), cids=targets.map(r=>r.canonical_action_id)
async function read(){
const p=await db.from('community_actions').select('*').in('id',ids)
const c=await db.from('canonical_actions').select('*').in('id',cids)
if(p.error||c.error||p.data?.length!==4||c.data?.length!==4)throw p.error||c.error||Error('Read scope mismatch')
return {public:p.data,canonical:c.data}
}
const before=await read()
for(const t of targets){const r=before.public.find(r=>r.id===t.id);if(!r||r.name!==t.name||r.canonical_action_id!==t.canonical_action_id||!['STRENGTH','STREET_REVIEW_PENDING'].includes(r.type))throw Error('Identity changed')}
if(!process.argv.includes('--execute')){console.log(JSON.stringify({mode:'dry-run',names,before:before.public.map(r=>({id:r.id,name:r.name,type:r.type,hasVideo:!!r.url})),canonical:before.canonical.map(r=>({id:r.id,hasImage:!!r.reference_image_url}))}));process.exit(0)}
const backupPath=path.join(dir,'unverifiable-four-before.json')
if(!existsSync(backupPath))writeFileSync(backupPath,JSON.stringify({savedAt:new Date().toISOString(),host:new URL(url).host,...before},null,2)+'\n')
for(const r of before.public){if(r.type==='STREET_REVIEW_PENDING')continue;const q=await db.from('community_actions').update({type:'STREET_REVIEW_PENDING'}).eq('id',r.id).eq('type',r.type).eq('canonical_action_id',r.canonical_action_id).select('id');if(q.error||q.data?.length!==1)throw q.error||Error('Quarantine CAS failed')}
for(const r of before.canonical){if(r.reference_image_url===null)continue;const q=await db.from('canonical_actions').update({reference_image_url:null}).eq('id',r.id).eq('reference_image_url',r.reference_image_url).select('id');if(q.error||q.data?.length!==1)throw q.error||Error('Image CAS failed')}
const after=await read()
for(const r of before.public){const a=after.public.find(a=>a.id===r.id);for(const k of Object.keys(r)){if(['type','updated_at'].includes(k))continue;if(JSON.stringify(a?.[k])!==JSON.stringify(r[k]))throw Error('Other public field changed: '+k)}if(a?.type!=='STREET_REVIEW_PENDING')throw Error('Quarantine readback failed')}
for(const r of before.canonical){const a=after.canonical.find(a=>a.id===r.id);for(const k of Object.keys(r)){if(['reference_image_url','updated_at'].includes(k))continue;if(JSON.stringify(a?.[k])!==JSON.stringify(r[k]))throw Error('Other canonical field changed: '+k)}if(a?.reference_image_url!==null)throw Error('Image readback failed')}
const result={verifiedAt:new Date().toISOString(),host:new URL(url).host,status:'temporarily_hidden_unverifiable_pose',names,ids,canonicalIds:cids,reason:'卡指握法缺少可靠近景；仙人挂画支撑点无法核实；手肘松解原视频不可访问且无动作说明。保留全部ID、视频和训练关联，不作替换完成计数。'}
writeFileSync(path.join(dir,'unverifiable-four-result.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result))
