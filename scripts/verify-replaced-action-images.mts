import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { bootstrapEnv } from './config/bootstrap-env.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'artifacts/action-image-replacement/2026-10-07')
const snapshot = JSON.parse(readFileSync(path.join(dir, 'catalog-current.json'), 'utf8'))
const queue = JSON.parse(readFileSync(path.join(dir, 'scope-queue.json'), 'utf8'))
const verified = queue.filter(row => row.status === 'replaced_verified')
await bootstrapEnv({ mode: 'development', projectRoot: root })
const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || new URL(url).host !== 'uhlqribpagvklpqmcqvo.supabase.co') throw new Error('Unexpected database')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const [canonicalResult, publicResult] = await Promise.all([
  db.from('canonical_actions').select('*').order('id').range(0, 999),
  db.from('community_actions').select('id,name,type,detail,attrs,positions,canonical_action_id,url').order('id').range(0, 999),
])
if (canonicalResult.error || publicResult.error) throw canonicalResult.error || publicResult.error
const errors: string[] = []
const checked = []
for (const item of verified) {
  const oldPublic = snapshot.public.find(row => row.id === item.publicId)
  const currentPublic = publicResult.data.find(row => row.id === item.publicId)
  const oldCanonical = snapshot.canonical.find(row => row.id === item.canonicalId)
  const currentCanonical = canonicalResult.data.find(row => row.id === item.canonicalId)
  if (!oldPublic || !currentPublic || !oldCanonical || !currentCanonical) { errors.push(`Missing identity: ${item.publicId}`); continue }
  for (const field of ['id','name','detail','attrs','positions','canonical_action_id','url']) {
    if (JSON.stringify(oldPublic[field]) !== JSON.stringify(currentPublic[field])) errors.push(`Unexpected public field change: ${item.publicId}/${field}`)
  }
  for (const field of Object.keys(oldCanonical).filter(field => field !== 'reference_image_url')) {
    if (JSON.stringify(oldCanonical[field]) !== JSON.stringify(currentCanonical[field])) errors.push(`Unexpected canonical field change: ${item.canonicalId}/${field}`)
  }
  if (currentCanonical.reference_image_url !== item.imageUrl) errors.push(`Image mismatch: ${item.canonicalId}`)
  if (currentPublic.type !== (oldPublic.type === 'STREET_REVIEW_PENDING' ? 'STRENGTH' : oldPublic.type)) errors.push(`Type mismatch: ${item.publicId}`)
  checked.push({publicId:item.publicId, canonicalId:item.canonicalId, name:item.name, type:currentPublic.type, imageUrl:currentCanonical.reference_image_url, publicVideoUnchanged:currentPublic.url===oldPublic.url})
}
const result = {checkedAt:new Date().toISOString(), mode:'read-only', verified:checked.length, totalScope:queue.length, remaining:queue.length-checked.length, publicCount:publicResult.data.length, canonicalCount:canonicalResult.data.length, errors, checked}
writeFileSync(path.join(dir, 'live-verification.json'), JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({...result,checked:undefined}))
if (errors.length) process.exitCode=1
