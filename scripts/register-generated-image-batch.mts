import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
const root=path.resolve(import.meta.dirname,'..')
const dir=path.join(root,'design/image-workspace/action-library/reviewed-outputs/2026-10-07/full-replacement')
const jobs=JSON.parse(readFileSync(path.resolve(root,process.argv[2]),'utf8').replace(/^\uFEFF/,''))
const assetPath=path.join(dir,'assets.json')
const assets=JSON.parse(readFileSync(assetPath,'utf8').replace(/^\uFEFF/,''))
for(const job of jobs) {
  if(job.reviewStatus!=='visually_reviewed' || !/^[a-z0-9-]+$/.test(job.key) || !path.resolve(job.nativePath).startsWith(path.resolve('C:/Users/29454/.codex/generated_images')+path.sep)) throw new Error('Invalid reviewed image registration')
  const localFile=path.join(dir,`${job.key}.png`)
  copyFileSync(job.nativePath,localFile)
  const {nativePath,...details}=job
  const asset={...details,localFile:path.relative(root,localFile).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(localFile)).digest('hex'),assetKind:'generated-illustration',styleReference:'CoachLink v4 persona sheet',reviewedAt:job.reviewedAt || '2026-10-07'}
  const index=assets.findIndex(item=>item.key===job.key)
  if(index<0)assets.push(asset);else assets[index]=asset
}
writeFileSync(assetPath,JSON.stringify(assets,null,2)+'\n')
console.log(JSON.stringify({registered:jobs.length,totalAssets:assets.length}))
