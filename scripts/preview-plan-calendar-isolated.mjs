// Local UI harness using the real components; all completion writes stay in memory.
// node scripts/preview-plan-calendar-isolated.mjs <allocated-port>
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Pass an allocated test port');
const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const out = join(root, 'artifacts', 'plan-calendar-verification');
await mkdir(out, { recursive: true });
await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import BrowseSection from './src/app/today-training/BrowseSection';
import RecordCompletionButton from './src/app/today-training/components/RecordCompletionButton';
import {buildPlanScheduleModel} from './packages/core/src/planCalendar';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
const days=Array.from({length:21},(_,i)=>({dayIndex:i+1,type:i%3===0?'training':'rest',actionSets:[]}));
const make=(day)=>({id:'40000000-0000-4000-8000-'+String(day).padStart(12,'0'),day_index:day,status:'completed',completed_at:'2026-09-10T08:00:00+08:00',updated_at:'2026-09-10T09:00:00Z'});
function App(){ const [selected,setSelected]=useState(1); const [execs,setExecs]=useState({1:make(1),4:make(4)}); const [saves,setSaves]=useState(0);
const schedule=buildPlanScheduleModel({trainingDays:days,executionsByDayIndex:execs,effectiveStartDate:'2026-09-01',progressDayIndex:7,today:new Date('2026-09-26')});
return <main style={{padding:32,maxWidth:1100,margin:'auto'}}><h1>隔离验证 · 不连接业务数据库</h1>
<BrowseSection instance={{id:'10000000-0000-4000-8000-000000000001',training_days:days}} currentDayIndex={7} progressDayIndex={7} selectedDayIndex={selected} onSelectedDayChange={setSelected} executionsByDayIndex={execs} scheduleModel={schedule} effectiveStartDate='2026-09-01'/>
<p>当前选择：D{selected} · 模拟保存次数：{saves}</p>
<RecordCompletionButton key={selected} instanceId='10000000-0000-4000-8000-000000000001' dayIndex={selected} execution={execs[selected]} earliestDate='2026-09-01'
onSaved={row=>{setExecs(prev=>({...prev,[row.day_index]:row}));setSaves(n=>n+1)}}/>
</main>}; createRoot(document.getElementById('root')).render(<App/>);
` }, outfile: join(out,'bundle.js'), bundle:true, platform:'browser', format:'iife', loader:{'.woff2':'dataurl'},
  alias:{'@':join(root,'src')}, define:{'process.env.NODE_ENV':'"development"'}, plugins:[{
    name:'no-business-network', setup(builder){
      builder.onResolve({filter:/^@\/app\/service\/executionService$/},()=>({path:'memory-service',namespace:'memory'}));
      builder.onLoad({filter:/.*/,namespace:'memory'},()=>({contents:`export const executionService={recordCompletion:async input=>({id:input.executionId||'40000000-0000-4000-8000-000000000001',day_index:input.dayIndex,status:'completed',performed_on:input.performedOn,completed_at:input.performedOn+'T00:00:00+08:00',updated_at:new Date().toISOString()})}`,loader:'js'}));
    }
  }] });
let appCss='';
try { const dir=join(root,'.next/static/chunks'); for(const file of await readdir(dir)) if(file.endsWith('.css')) appCss+=await readFile(join(dir,file),'utf8'); } catch {}
const server=createServer(async (req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:");
  if(req.url==='/bundle.js'||req.url==='/bundle.css') { res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(join(out,req.url.slice(1)))); }
  else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(appCss);}
  else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>计划月历隔离验证</title><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}
});
server.listen(port,'127.0.0.1',()=>console.log('Isolated component UI: http://127.0.0.1:'+port));
