import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { bootstrapEnv } from './config/bootstrap-env.mjs'

const root = path.resolve(import.meta.dirname, '..')
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
const dir = path.join(root, 'artifacts/action-image-replacement/2026-10-07')
mkdirSync(dir, { recursive: true })
writeFileSync(path.join(dir, 'catalog-current.json'), JSON.stringify({ readAt: new Date().toISOString(), canonical: canonicalResult.data, public: publicResult.data }, null, 2) + '\n')
console.log(JSON.stringify({ canonical: canonicalResult.data.length, public: publicResult.data.length, types: publicResult.data.reduce((counts, row) => { counts[row.type] = (counts[row.type] || 0) + 1; return counts }, {} as Record<string, number>) }))
