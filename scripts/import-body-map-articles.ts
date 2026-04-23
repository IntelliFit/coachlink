import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.production' });

type BodyMapMode = 'screening' | 'training';

type ImportCandidate = {
  fileName: string;
  filePath: string;
  sourceTopic: string;
  title: string;
  slug: string;
  description: string;
  bodyRegions: string[];
  modes: BodyMapMode[];
  status: 'direct' | 'alias' | 'related' | 'skipped';
  reason: string;
  html?: string;
};

const DEFAULT_ARTICLE_DIR =
  'C:\\Users\\29454\\.openclaw\\workspace-main\\body-map-system\\articles';

const CLICKABLE_BODY_REGIONS = [
  '斜方肌',
  '三角肌',
  '胸大肌',
  '腹直肌',
  '肱二头肌',
  '肱桡肌',
  '肱侧腕屈肌',
  '腹外直肌',
  '内收肌',
  '股四头肌',
  '腓肠肌',
  '胫骨前肌',
  '比目鱼肌',
  '半腱肌',
  '股二头肌',
  '臀大肌',
  '竖脊肌',
  '背阔肌',
  '肱三头肌',
  '大圆肌',
  '岗下肌',
  '膝关节',
  '踝关节',
  '髋关节',
  '腕关节',
  '肩关节',
] as const;

const DIRECT_REGION_SET = new Set<string>(CLICKABLE_BODY_REGIONS);

const ALIASES: Record<string, string[]> = {
  冈下肌: ['岗下肌'],
  腹外斜肌: ['腹外直肌'],
  内收肌群: ['内收肌'],
  大腿内收肌群: ['内收肌'],
};

const RELATED_TOPIC_REGIONS: Record<string, string[]> = {
  高低肩: ['斜方肌', '三角肌', '肩关节'],
  圆肩: ['胸大肌', '肩关节', '斜方肌', '背阔肌'],
  头前伸: ['斜方肌', '肩关节'],
  骨盆前倾: ['髋关节', '臀大肌', '竖脊肌', '腹直肌'],
  骨盆侧倾: ['髋关节', '臀大肌', '竖脊肌', '腹直肌'],
  翼状肩胛: ['肩关节', '背阔肌', '斜方肌'],
  膝内扣: ['膝关节', '髋关节', '臀大肌', '股四头肌'],
  扁平足: ['踝关节', '胫骨前肌', '腓肠肌', '比目鱼肌'],
  网球肘: ['肱桡肌', '腕关节', '肱二头肌'],
  高尔夫球肘: ['肱桡肌', '腕关节', '肱二头肌'],
  腰椎: ['竖脊肌', '腹直肌', '髋关节'],
  跟腱: ['踝关节', '腓肠肌', '比目鱼肌'],
  足底筋膜: ['踝关节', '胫骨前肌', '腓肠肌'],
  髌腱: ['膝关节', '股四头肌'],
  前锯肌: ['肩关节', '胸大肌', '背阔肌'],
  胸小肌: ['胸大肌', '肩关节'],
  上斜方肌: ['斜方肌', '肩关节'],
  下斜方肌: ['斜方肌', '肩关节'],
  臀中肌: ['髋关节', '臀大肌'],
  髂腰肌: ['髋关节', '腹直肌'],
  腰方肌: ['竖脊肌', '髋关节', '腹直肌'],
  胸锁乳突肌: ['斜方肌', '肩关节'],
  斜角肌: ['斜方肌', '肩关节'],
  肩胛提肌: ['斜方肌', '肩关节'],
  头夹肌: ['斜方肌', '肩关节'],
  颈椎: ['斜方肌', '肩关节'],
  三角肌前束: ['三角肌', '肩关节'],
  三角肌中束: ['三角肌', '肩关节'],
  三角肌后束: ['三角肌', '肩关节'],
  冈上肌: ['肩关节', '三角肌'],
  小圆肌: ['肩关节', '岗下肌'],
  肩胛下肌: ['肩关节'],
  菱形肌: ['斜方肌', '背阔肌', '肩关节'],
  斜方肌中束: ['斜方肌'],
  斜方肌下束: ['斜方肌'],
  肩胛胸廓节律: ['肩关节', '斜方肌', '背阔肌'],
  锁骨: ['肩关节', '胸大肌'],
  肩锁关节: ['肩关节'],
  肩峰下间隙: ['肩关节', '三角肌'],
  肋间肌: ['胸大肌', '腹直肌'],
  胸骨: ['胸大肌'],
  胸椎: ['竖脊肌', '背阔肌', '肩关节'],
  胸廓活动度: ['胸大肌', '背阔肌', '肩关节'],
  背阔肌: ['大圆肌'],
  胸腰筋膜: ['竖脊肌', '背阔肌', '臀大肌'],
  多裂肌: ['竖脊肌', '腹直肌'],
  回旋肌: ['竖脊肌'],
  腹内斜肌: ['腹直肌', '腹外直肌'],
  腹横肌: ['腹直肌', '腹外直肌'],
  膈肌: ['腹直肌', '胸大肌'],
  腹股沟: ['髋关节', '内收肌'],
  臀小肌: ['髋关节', '臀大肌'],
  梨状肌: ['髋关节', '臀大肌'],
  深层外旋肌群: ['髋关节', '臀大肌'],
  阔筋膜张肌: ['髋关节', '股四头肌'],
  髂胫束: ['髋关节', '膝关节', '股四头肌'],
  骨盆: ['髋关节', '臀大肌', '竖脊肌', '腹直肌'],
  骶髂关节: ['髋关节', '竖脊肌', '臀大肌'],
  股直肌: ['股四头肌', '髋关节', '膝关节'],
  股外侧肌: ['股四头肌', '膝关节'],
  股内侧肌: ['股四头肌', '膝关节'],
  腘绳肌群: ['股二头肌', '半腱肌', '臀大肌'],
  大腿外侧筋膜区: ['股四头肌', '髋关节', '膝关节'],
  髌骨: ['膝关节', '股四头肌'],
  髂胫束止点: ['膝关节', '股四头肌'],
  内侧副韧带: ['膝关节'],
  外侧副韧带: ['膝关节'],
  后交叉韧带: ['膝关节'],
  腘窝: ['膝关节', '腓肠肌', '股二头肌'],
  腓骨长肌: ['踝关节', '腓肠肌'],
  胫骨后肌: ['踝关节', '胫骨前肌'],
  小腿三头肌: ['腓肠肌', '比目鱼肌', '踝关节'],
  距下关节: ['踝关节'],
  足弓: ['踝关节', '胫骨前肌'],
  大脚趾: ['踝关节'],
  跟骨: ['踝关节', '腓肠肌', '比目鱼肌'],
  足底内在肌: ['踝关节'],
  踝背屈受限: ['踝关节', '胫骨前肌', '腓肠肌', '比目鱼肌'],
  高足弓: ['踝关节', '胫骨前肌'],
  肱肌: ['肱二头肌', '肱桡肌'],
  肱二头肌长头腱: ['肱二头肌', '肩关节'],
  肘关节: ['肱二头肌', '肱三头肌', '肱桡肌'],
  肘外侧: ['肱桡肌', '腕关节'],
  肘内侧: ['肱桡肌', '腕关节'],
  前臂伸肌群: ['肱桡肌', '腕关节'],
  前臂屈肌群: ['肱侧腕屈肌', '腕关节'],
  腕屈肌群: ['肱侧腕屈肌', '腕关节'],
  腕伸肌群: ['肱桡肌', '腕关节'],
  握力系统: ['肱桡肌', '肱侧腕屈肌', '腕关节'],
  腱鞘炎区: ['腕关节', '肱侧腕屈肌', '肱桡肌'],
  手掌内在肌: ['腕关节'],
  深蹲模式: ['髋关节', '膝关节', '踝关节', '股四头肌', '臀大肌'],
  硬拉模式: ['髋关节', '臀大肌', '股二头肌', '半腱肌', '竖脊肌'],
  推类模式: ['胸大肌', '三角肌', '肱三头肌', '肩关节'],
  拉类模式: ['背阔肌', '大圆肌', '肱二头肌', '肱桡肌', '肩关节'],
  单腿稳定性: ['髋关节', '膝关节', '踝关节', '臀大肌'],
  核心抗压: ['腹直肌', '竖脊肌'],
  核心抗旋转: ['腹直肌', '腹外直肌', '竖脊肌'],
  肩肱节律: ['肩关节', '三角肌', '背阔肌'],
  步态周期: ['髋关节', '膝关节', '踝关节', '臀大肌', '腓肠肌'],
  呼吸模式: ['腹直肌', '胸大肌', '竖脊肌'],
  骨盆后倾: ['髋关节', '臀大肌', '腹直肌', '竖脊肌'],
  驼背: ['斜方肌', '竖脊肌', '肩关节', '胸大肌'],
  膝过伸: ['膝关节', '股四头肌', '股二头肌', '半腱肌'],
  X型腿: ['膝关节', '髋关节', '臀大肌', '股四头肌'],
  O型腿: ['膝关节', '髋关节', '踝关节', '股四头肌'],
};

const SKIPPED_TOPICS = new Set([
  '颈前淋巴结区',
  '颞下颌关节',
  '咬肌',
  '翼内肌',
]);

const SCREENING_HINTS = [
  '高低肩',
  '圆肩',
  '头前伸',
  '骨盆前倾',
  '骨盆侧倾',
  '翼状肩胛',
  '膝内扣',
  '扁平足',
  '网球肘',
  '高尔夫球肘',
  '腰椎',
  '跟腱',
  '足底筋膜',
  '髌腱',
  '颈椎',
  '肩锁关节',
  '肩峰下间隙',
  '骶髂关节',
  '内侧副韧带',
  '外侧副韧带',
  '后交叉韧带',
  '踝背屈受限',
  '高足弓',
  '肘外侧',
  '肘内侧',
  '腱鞘炎区',
  '骨盆后倾',
  '驼背',
  '膝过伸',
  'X型腿',
  'O型腿',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dirArg = args.find((arg) => arg.startsWith('--dir='));
  return {
    apply,
    articleDir: dirArg ? dirArg.slice('--dir='.length) : DEFAULT_ARTICLE_DIR,
  };
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getTopic(fileName: string) {
  const baseName = path.basename(fileName, '.md');
  const parts = baseName.split('-');
  return parts.length >= 2 ? parts[1] : baseName;
}

function getArticleVariant(fileName: string) {
  const baseName = path.basename(fileName, '.md');
  const parts = baseName.split('-');
  return parts.slice(2).join('-') || '系统指南';
}

function slugFromFile(fileName: string) {
  return `body-map-${path.basename(fileName, '.md')}`
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueRegions(regions: string[]) {
  return Array.from(new Set(regions)).filter((region) => DIRECT_REGION_SET.has(region));
}

function classifyModes(topic: string, status: ImportCandidate['status']): BodyMapMode[] {
  if (SCREENING_HINTS.includes(topic)) return ['screening'];
  if (status === 'direct' || status === 'alias') return ['training', 'screening'];
  return ['training'];
}

function classifyCandidate(filePath: string, markdown: string, md: MarkdownIt): ImportCandidate {
  const fileName = path.basename(filePath);
  const sourceTopic = getTopic(fileName);
  const variant = getArticleVariant(fileName);
  const title = `${sourceTopic} ${variant}`.trim();

  let bodyRegions: string[] = [];
  let status: ImportCandidate['status'] = 'skipped';
  let reason = '当前人体图没有对应或可合理关联的点击部位';

  if (SKIPPED_TOPICS.has(sourceTopic)) {
    status = 'skipped';
    reason = '主题偏头面部/淋巴区域，当前人体图没有对应点击部位';
  } else if (DIRECT_REGION_SET.has(sourceTopic)) {
    status = 'direct';
    reason = '文章主题与当前人体图点击部位直接同名';
    bodyRegions = [sourceTopic, ...(RELATED_TOPIC_REGIONS[sourceTopic] || [])];
  } else if (ALIASES[sourceTopic]) {
    status = 'alias';
    reason = `文章主题通过别名映射到当前人体图部位：${ALIASES[sourceTopic].join('、')}`;
    bodyRegions = ALIASES[sourceTopic];
  } else if (RELATED_TOPIC_REGIONS[sourceTopic]) {
    status = 'related';
    reason = '文章主题是姿态/动作/细分结构，挂到相关可点击肌肉或关节';
    bodyRegions = RELATED_TOPIC_REGIONS[sourceTopic];
  }

  bodyRegions = uniqueRegions(bodyRegions);
  if (bodyRegions.length === 0) {
    status = 'skipped';
  }

  const modes = status === 'skipped' ? [] : classifyModes(sourceTopic, status);
  const description =
    status === 'skipped'
      ? reason
      : `围绕${sourceTopic}的基础介绍、训练方法、体态管理和伤病管理，关联到人体地图部位：${bodyRegions.join('、')}。`;

  return {
    fileName,
    filePath,
    sourceTopic,
    title,
    slug: slugFromFile(fileName),
    description,
    bodyRegions,
    modes,
    status,
    reason,
    html: status === 'skipped' ? undefined : md.render(markdown),
  };
}

async function upsertCandidate(serviceRoleSupabase: any, candidate: ImportCandidate) {
  if (!candidate.html || candidate.status === 'skipped') return { action: 'skipped' as const };

  const payload = {
    node_type: 'article',
    title: candidate.title,
    slug: candidate.slug,
    description: candidate.description,
    icon: 'MapPin',
    content: {
      body: candidate.html,
      tags: [candidate.sourceTopic, ...candidate.bodyRegions, ...candidate.modes],
      difficulty: 2,
      source: 'body-map-system/articles',
      source_file: candidate.fileName,
      source_topic: candidate.sourceTopic,
      body_map_modes: candidate.modes,
      import_version: '2026-04-20-body-map-articles-v1',
    },
    body_region: candidate.bodyRegions,
    difficulty: 2,
    is_free: true,
    is_published: true,
    sort_order: 1000,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await serviceRoleSupabase
    .from('knowledge_nodes')
    .select('id')
    .eq('slug', candidate.slug)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await serviceRoleSupabase
      .from('knowledge_nodes')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
    return { action: 'updated' as const, id: existing.id };
  }

  const { data: inserted, error } = await serviceRoleSupabase
    .from('knowledge_nodes')
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  const { error: closureError } = await serviceRoleSupabase
    .from('knowledge_node_closures')
    .upsert(
      {
        ancestor_id: inserted.id,
        descendant_id: inserted.id,
        depth: 0,
      },
      { onConflict: 'ancestor_id,descendant_id' },
    );

  if (closureError) throw closureError;

  return { action: 'inserted' as const, id: inserted.id };
}

async function main() {
  const { apply, articleDir } = parseArgs();
  const resolvedArticleDir = path.resolve(articleDir);
  if (!fs.existsSync(resolvedArticleDir)) {
    throw new Error(`Article directory not found: ${resolvedArticleDir}`);
  }

  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  });

  const files = fs
    .readdirSync(resolvedArticleDir)
    .filter((fileName) => fileName.endsWith('.md') && fileName.toLowerCase() !== 'readme.md')
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  const candidates = files.map((fileName) => {
    const filePath = path.join(resolvedArticleDir, fileName);
    const markdown = fs.readFileSync(filePath, 'utf8');
    return classifyCandidate(filePath, markdown, md);
  });

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    articleDir: resolvedArticleDir,
    generated_at: new Date().toISOString(),
    total_files: candidates.length,
    usable_total: candidates.filter((c) => c.status !== 'skipped').length,
    direct_count: candidates.filter((c) => c.status === 'direct').length,
    alias_count: candidates.filter((c) => c.status === 'alias').length,
    related_count: candidates.filter((c) => c.status === 'related').length,
    skipped_count: candidates.filter((c) => c.status === 'skipped').length,
    coverage_by_region: CLICKABLE_BODY_REGIONS.map((region) => ({
      region,
      count: candidates.filter((c) => c.bodyRegions.includes(region)).length,
      files: candidates.filter((c) => c.bodyRegions.includes(region)).map((c) => c.fileName),
    })),
    uncovered_regions: CLICKABLE_BODY_REGIONS.filter(
      (region) => !candidates.some((c) => c.bodyRegions.includes(region)),
    ),
    skipped: candidates
      .filter((c) => c.status === 'skipped')
      .map((c) => ({ fileName: c.fileName, sourceTopic: c.sourceTopic, reason: c.reason })),
  };

  const writeResults: Array<{
    fileName: string;
    slug: string;
    action: string;
    id?: string;
    error?: string;
  }> = [];

  if (apply) {
    const supabaseUrl =
      process.env.NEXT_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error(
        'Missing Supabase URL or service role key. Set NEXT_SUPABASE_URL / SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    const serviceRoleSupabase = createClient(supabaseUrl, serviceKey);

    for (const candidate of candidates) {
      try {
        const result = await upsertCandidate(serviceRoleSupabase as any, candidate);
        writeResults.push({
          fileName: candidate.fileName,
          slug: candidate.slug,
          action: result.action,
          id: 'id' in result ? result.id : undefined,
        });
      } catch (e: any) {
        writeResults.push({
          fileName: candidate.fileName,
          slug: candidate.slug,
          action: 'error',
          error: e?.message || String(e),
        });
      }
    }
  }

  const outDir = path.join(process.cwd(), 'temp_dir');
  ensureDir(outDir);
  const outPath = path.join(outDir, `body_map_article_import_${summary.mode}_${nowStamp()}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        ok: true,
        summary,
        candidates: candidates.map(({ html, ...candidate }) => candidate),
        writeResults,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath,
        summary: {
          mode: summary.mode,
          total_files: summary.total_files,
          usable_total: summary.usable_total,
          direct_count: summary.direct_count,
          alias_count: summary.alias_count,
          related_count: summary.related_count,
          skipped_count: summary.skipped_count,
          uncovered_regions: summary.uncovered_regions,
        },
        write: apply
          ? {
              inserted: writeResults.filter((r) => r.action === 'inserted').length,
              updated: writeResults.filter((r) => r.action === 'updated').length,
              skipped: writeResults.filter((r) => r.action === 'skipped').length,
              errors: writeResults.filter((r) => r.action === 'error').length,
            }
          : undefined,
      },
      null,
      2,
    ),
  );

  if (writeResults.some((result) => result.action === 'error')) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[import-body-map-articles] Failed:', e);
  process.exitCode = 1;
});
