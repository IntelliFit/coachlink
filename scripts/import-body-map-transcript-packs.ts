import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.production' });

type BodyMapMode = 'screening' | 'training';

type TopicConfig = {
  slug: string;
  alternateDirSlugs?: string[];
  displayName: string;
  bodyRegions: string[];
  modes: BodyMapMode[];
  structureType: 'muscle' | 'joint' | 'problem' | 'mixed';
  focus: string[];
  searchGaps?: string[];
  skipReason?: string;
};

type TranscriptPackCandidate = {
  slug: string;
  displayName: string;
  status: 'usable' | 'pending';
  bodyRegions: string[];
  modes: BodyMapMode[];
  structureType: TopicConfig['structureType'];
  transcriptCount: number;
  charCount: number;
  filePath: string;
  sourceBvids: string[];
  searchGaps: string[];
  skipReason?: string;
  html?: string;
  title: string;
  description: string;
  knowledgeSlug: string;
};

const DEFAULT_CONTENT_DIR =
  'C:\\Users\\29454\\.openclaw\\workspace-main\\body-map-system\\content';

const TOPIC_CONFIGS: TopicConfig[] = [
  {
    slug: '002-rounded-shoulders',
    displayName: '圆肩',
    bodyRegions: ['胸大肌', '肩关节', '斜方肌', '背阔肌'],
    modes: ['screening'],
    structureType: 'problem',
    focus: ['圆肩识别', '胸小肌/胸大肌紧张', '肩胛位置异常', '训练代偿'],
  },
  {
    slug: '004-anterior-pelvic-tilt',
    displayName: '骨盆前倾',
    bodyRegions: ['髋关节', '臀大肌', '竖脊肌', '腹直肌'],
    modes: ['screening'],
    structureType: 'problem',
    focus: ['骨盆位置判断', '髂腰肌紧张', '臀肌抑制', '核心控制'],
  },
  {
    slug: '007-knee-valgus-knee-cave',
    displayName: '膝内扣',
    bodyRegions: ['膝关节', '髋关节', '臀大肌', '股四头肌'],
    modes: ['screening'],
    structureType: 'problem',
    focus: ['深蹲/落地膝轨迹', '髋稳定不足', '足部支撑', '纠正训练'],
  },
  {
    slug: '008-flat-feet',
    displayName: '扁平足',
    bodyRegions: ['踝关节', '胫骨前肌', '腓肠肌', '比目鱼肌'],
    modes: ['screening'],
    structureType: 'problem',
    focus: ['足弓支撑', '步态', '下肢连锁', '足底稳定'],
  },
  {
    slug: '009-tennis-elbow',
    displayName: '网球肘',
    bodyRegions: ['肱桡肌', '腕关节', '肱二头肌'],
    modes: ['screening'],
    structureType: 'problem',
    focus: ['肘外侧疼痛', '前臂伸肌负荷', '握力/抓握', '康复训练'],
  },
  {
    slug: '010-golfers-elbow',
    displayName: '高尔夫球肘',
    bodyRegions: ['肱桡肌', '腕关节', '肱二头肌', '肱侧腕屈肌'],
    modes: ['screening'],
    structureType: 'problem',
    focus: ['肘内侧疼痛', '腕屈肌群负荷', '抓握压力', '恢复训练'],
  },
  {
    slug: '018-patellar-tendon',
    displayName: '髌腱',
    bodyRegions: ['膝关节', '股四头肌'],
    modes: ['screening', 'training'],
    structureType: 'mixed',
    focus: ['髌腱负荷管理', '跳跃/跑跳', '股四头肌力量', '疼痛监测'],
  },
  {
    slug: '019-serratus-anterior',
    displayName: '前锯肌',
    bodyRegions: ['肩关节', '胸大肌', '背阔肌'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['肩胛前伸', '肩胛上旋', '卧推/过顶稳定', '激活训练'],
  },
  {
    slug: '020-pectoralis-minor',
    alternateDirSlugs: ['020-胸小肌'],
    displayName: '胸小肌',
    bodyRegions: ['胸大肌', '肩关节'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['胸前紧张', '圆肩', '肩胛前倾', '松解与拉伸'],
    searchGaps: ['胸小肌综合征', 'pectoralis minor syndrome rehab', '胸小肌与肩峰撞击'],
  },
  {
    slug: '023-gluteus-medius',
    displayName: '臀中肌',
    bodyRegions: ['髋关节', '臀大肌'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['单腿稳定', '骨盆控制', '髋外展', '膝内扣关联'],
  },
  {
    slug: '025-iliopsoas',
    displayName: '髂腰肌',
    bodyRegions: ['髋关节', '腹直肌'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['髋屈', '久坐紧张', '骨盆前倾', '拉伸与负荷'],
  },
  {
    slug: '028-triceps-brachii',
    displayName: '肱三头肌',
    bodyRegions: ['肱三头肌', '肩关节'],
    modes: ['training'],
    structureType: 'muscle',
    focus: ['肘伸', '推类动作', '双杠臂屈伸', '长头训练'],
  },
  {
    slug: '036-cervical-lymph-nodes',
    alternateDirSlugs: ['036-颈前淋巴结区'],
    displayName: '颈前淋巴结区',
    bodyRegions: [],
    modes: [],
    structureType: 'problem',
    focus: ['颈前区肿胀', '压痛', '感染红线', '就医指征'],
    skipReason: '当前人体图没有头面颈前点击区，且该主题医学红线较高，不适合硬挂到现有 26 个点击部位。',
    searchGaps: ['颈前淋巴结 肿大 何时就医', 'cervical lymph nodes red flags'],
  },
  {
    slug: '037-temporomandibular-joint',
    alternateDirSlugs: ['037-颞下颌关节'],
    displayName: '颞下颌关节',
    bodyRegions: [],
    modes: [],
    structureType: 'joint',
    focus: ['张口弹响', '咬合', '颞下颌关节紊乱', 'TMJ 评估'],
    skipReason: '当前人体图没有头面颌面点击区，更适合后续扩点击区或做问题模式时接入。',
    searchGaps: ['TMJ rehab', '颞下颌关节 弹响 康复', 'jaw pain red flags'],
  },
  {
    slug: '038-masseter',
    alternateDirSlugs: ['038-咬肌'],
    displayName: '咬肌',
    bodyRegions: [],
    modes: [],
    structureType: 'muscle',
    focus: ['咬肌紧张', '磨牙', '面部张力', '咀嚼负荷'],
    skipReason: '当前人体图没有面部点击区。',
    searchGaps: ['咬肌 紧张 放松', 'masseter bruxism rehab'],
  },
  {
    slug: '039-medial-pterygoid',
    alternateDirSlugs: ['039-翼内肌'],
    displayName: '翼内肌',
    bodyRegions: [],
    modes: [],
    structureType: 'muscle',
    focus: ['咀嚼肌', '颞下颌关节紊乱', '张口偏移', '咬合压力'],
    skipReason: '当前人体图没有面部点击区。',
    searchGaps: ['翼内肌 TMJ', 'medial pterygoid rehab'],
  },
  {
    slug: '044-infraspinatus',
    displayName: '冈下肌',
    bodyRegions: ['岗下肌', '肩关节'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['肩外旋', '肩袖稳定', '肩后侧不适', '抗阻训练'],
  },
  {
    slug: '065-external-obliques',
    displayName: '腹外斜肌',
    bodyRegions: ['腹外直肌', '腹直肌'],
    modes: ['training'],
    structureType: 'muscle',
    focus: ['抗旋转', '侧向稳定', '呼吸与核心', '躯干传力'],
  },
  {
    slug: '073-adductors',
    displayName: '内收肌群',
    bodyRegions: ['内收肌', '髋关节'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['大腿内侧', '髋稳定', '侧向力量', '拉伤与恢复'],
  },
  {
    slug: '081-biceps-femoris',
    displayName: '股二头肌',
    bodyRegions: ['股二头肌', '臀大肌'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['后链', '膝屈与髋伸', '跑跳', '腘绳肌损伤'],
  },
  {
    slug: '082-semitendinosus-semimembranosus',
    displayName: '半腱肌与半膜肌',
    bodyRegions: ['半腱肌', '臀大肌', '膝关节'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['腘绳肌内侧', '膝稳定', '后链控制', '拉伤恢复'],
  },
  {
    slug: '101-foot-arch',
    displayName: '足弓',
    bodyRegions: ['踝关节', '胫骨前肌'],
    modes: ['screening', 'training'],
    structureType: 'mixed',
    focus: ['足底支撑', '步态', '跑跳落地', '足内在肌'],
  },
  {
    slug: '105-ankle-dorsiflexion-limit',
    displayName: '踝背屈受限',
    bodyRegions: ['踝关节', '胫骨前肌', '腓肠肌', '比目鱼肌'],
    modes: ['screening', 'training'],
    structureType: 'problem',
    focus: ['深蹲受限', '小腿后侧紧张', '踝灵活性', '补偿动作'],
  },
  {
    slug: '109-elbow-joint',
    displayName: '肘关节',
    bodyRegions: ['肱二头肌', '肱三头肌', '肱桡肌'],
    modes: ['screening', 'training'],
    structureType: 'joint',
    focus: ['屈伸与旋前旋后', '肘部疼痛', '前臂连锁', '康复策略'],
  },
  {
    slug: '114-wrist-flexors',
    alternateDirSlugs: ['114-腕屈肌群'],
    displayName: '腕屈肌群',
    bodyRegions: ['肱侧腕屈肌', '腕关节'],
    modes: ['training', 'screening'],
    structureType: 'muscle',
    focus: ['前臂内侧', '握力', '腕屈', '高尔夫球肘'],
    searchGaps: ['腕屈肌群 康复', 'wrist flexors rehab', '前臂内侧疼痛 训练'],
  },
  {
    slug: '134-teres-major',
    displayName: '大圆肌',
    bodyRegions: ['大圆肌', '背阔肌', '肩关节'],
    modes: ['training'],
    structureType: 'muscle',
    focus: ['肩内收', '肩伸', '拉类动作', '与背阔肌区分'],
    searchGaps: ['大圆肌 背阔肌 区别', 'teres major anatomy training', '大圆肌 肩后侧疼痛'],
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dirArg = args.find((arg) => arg.startsWith('--dir='));
  return {
    apply,
    contentDir: dirArg ? dirArg.slice('--dir='.length) : DEFAULT_CONTENT_DIR,
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

function cleanTranscriptLines(text: string) {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 2)
    .filter((line) => !/^字幕/.test(line))
    .filter((line) => !/^[=\-–—_]+$/.test(line));

  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] === line) continue;
    deduped.push(line);
  }
  return deduped;
}

function linesToParagraphs(lines: string[], maxParagraphs = 3) {
  const paragraphs: string[] = [];
  let current = '';
  for (const line of lines) {
    const next = current ? `${current}${line}` : line;
    current = next;
    if (current.length >= 90) {
      paragraphs.push(current);
      current = '';
      if (paragraphs.length >= maxParagraphs) break;
    }
  }
  if (current && paragraphs.length < maxParagraphs) {
    paragraphs.push(current);
  }
  return paragraphs;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function collectTranscriptFiles(topicDirs: string[]) {
  const found: Array<{ sourceId: string; filePath: string; depth: number }> = [];

  function walk(dirPath: string, depth: number) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath, depth + 1);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase() === 'transcript.txt') {
        found.push({
          sourceId: path.basename(path.dirname(entryPath)),
          filePath: entryPath,
          depth,
        });
      }
    }
  }

  for (const topicDir of topicDirs) {
    if (fs.existsSync(topicDir)) {
      walk(topicDir, 0);
    }
  }

  const bySourceId = new Map<string, { sourceId: string; filePath: string; depth: number }>();
  for (const item of found) {
    const existing = bySourceId.get(item.sourceId);
    if (!existing || item.depth > existing.depth || item.filePath.length > existing.filePath.length) {
      bySourceId.set(item.sourceId, item);
    }
  }

  return Array.from(bySourceId.values()).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

function buildMarkdown(candidate: TranscriptPackCandidate, previewBlocks: Array<{ bvid: string; preview: string[] }>) {
  const intro =
    candidate.status === 'usable'
      ? `该素材包基于 ${candidate.transcriptCount} 份原始视频转录整理，当前挂载到人体地图部位：${candidate.bodyRegions.join('、')}。内容仍属于“素材摘录/待进一步加工”层，不等同于最终定稿的系统指南。`
      : `${candidate.skipReason || '当前人体图暂未提供对应点击区。'}本节点已作为待接入内容入库，后续补头面/颈前 hitbox 后可直接挂载。`;

  const gaps = candidate.searchGaps.length
    ? candidate.searchGaps.map((gap) => `- ${gap}`).join('\n')
    : '- 当前这批转录已可作为首轮补强素材，后续可按需要追加更专业来源。';

  const blocks = previewBlocks
    .map(
      (block, index) => `### 摘录 ${index + 1} · ${block.bvid}\n${block.preview.map((paragraph) => `> ${paragraph}`).join('\n>\n')}`,
    )
    .join('\n\n');

  return `# ${candidate.displayName} 转录素材包

> ${intro}

## 素材概况

- 主题：${candidate.displayName}
- 转录份数：${candidate.transcriptCount}
- 总字数（原始转录）：约 ${candidate.charCount}
- 当前建议模式：${candidate.modes.length ? candidate.modes.join(' / ') : '暂不挂载'}
- 关联部位：${candidate.bodyRegions.length ? candidate.bodyRegions.join('、') : '无'}
- 结构类型：${candidate.structureType}

## 当前可提炼方向

${candidate.bodyRegions.length ? candidate.bodyRegions.map((region) => `- ${region}：${candidate.displayName} 与该部位的结构、训练或筛查关系`).join('\n') : '- 当前素材更适合后续扩图或问题模式'}

## 建议继续补料的搜索词

${gaps}

## 转录摘录

${blocks || '> 当前未抽到可用摘录。'}
`;
}

function buildCandidate(config: TopicConfig, contentRoot: string, md: MarkdownIt): TranscriptPackCandidate {
  const topicDirs = [config.slug, ...(config.alternateDirSlugs || [])].map((dirSlug) => path.join(contentRoot, dirSlug));
  const transcriptFiles = collectTranscriptFiles(topicDirs).map((entry) => ({
    bvid: entry.sourceId,
    filePath: entry.filePath,
  }));
  const topicDir = topicDirs.filter((dirPath) => fs.existsSync(dirPath)).join('; ');

  const previewBlocks = transcriptFiles.slice(0, 5).map(({ bvid, filePath }) => {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = cleanTranscriptLines(text);
    return {
      bvid,
      preview: linesToParagraphs(lines),
    };
  });

  const charCount = transcriptFiles.reduce((sum, { filePath }) => sum + fs.readFileSync(filePath, 'utf8').length, 0);

  const status = config.skipReason ? 'pending' : 'usable';
  const bodyRegions = config.bodyRegions.length > 0 ? config.bodyRegions : [config.displayName];
  const modes = config.modes.length > 0 ? config.modes : ['screening' as const];
  const title =
    status === 'usable'
      ? `${config.displayName} 转录素材摘录`
      : `${config.displayName} 转录素材包（待扩点击区）`;

  const description =
    status === 'usable'
      ? `基于 ${transcriptFiles.length} 份视频转录整理的 ${config.displayName} 素材摘录，当前挂载到 ${bodyRegions.join('、')}。`
      : config.skipReason || `${config.displayName} 素材已作为待接入内容入库`;

  const markdown = buildMarkdown(
    {
      slug: config.slug,
      displayName: config.displayName,
      status,
      bodyRegions,
      modes,
      structureType: config.structureType,
      transcriptCount: transcriptFiles.length,
      charCount,
      filePath: topicDir,
      sourceBvids: transcriptFiles.map((item) => item.bvid),
      searchGaps: config.searchGaps || [],
      skipReason: config.skipReason,
      title,
      description,
      knowledgeSlug: `body-map-transcript-pack-${config.slug}`,
    },
    previewBlocks,
  );

  return {
    slug: config.slug,
    displayName: config.displayName,
    status,
    bodyRegions,
    modes,
    structureType: config.structureType,
    transcriptCount: transcriptFiles.length,
    charCount,
    filePath: topicDir,
    sourceBvids: transcriptFiles.map((item) => item.bvid),
    searchGaps: config.searchGaps || [],
    skipReason: config.skipReason,
    html: md.render(markdown),
    title,
    description,
    knowledgeSlug: `body-map-transcript-pack-${config.slug}`,
  };
}

async function upsertCandidate(serviceRoleSupabase: any, candidate: TranscriptPackCandidate) {
  if (!candidate.html || candidate.transcriptCount <= 0) {
    return { action: 'skipped' as const };
  }

  const payload = {
    node_type: 'article',
    title: candidate.title,
    slug: candidate.knowledgeSlug,
    description: candidate.description,
    icon: 'FileText',
    content: {
      body: candidate.html,
      tags: [
        candidate.displayName,
        ...candidate.bodyRegions,
        ...candidate.modes,
        'transcript-pack',
        'source-material',
        candidate.status === 'pending' ? 'pending-body-map-hitbox' : 'body-map-hitbox-ready',
      ],
      difficulty: 2,
      source: 'body-map-system/content',
      source_topic: candidate.displayName,
      source_topic_slug: candidate.slug,
      source_bvids: candidate.sourceBvids,
      transcript_count: candidate.transcriptCount,
      body_map_modes: candidate.modes,
      import_version: '2026-04-21-body-map-transcript-pack-v1',
      body_map_import_status: candidate.status,
      pending_body_map_hitbox: candidate.status === 'pending',
    },
    body_region: candidate.bodyRegions,
    difficulty: 2,
    is_free: true,
    is_published: true,
    sort_order: 1200,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await serviceRoleSupabase
    .from('knowledge_nodes')
    .select('id')
    .eq('slug', candidate.knowledgeSlug)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await serviceRoleSupabase.from('knowledge_nodes').update(payload).eq('id', existing.id);
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
  const { apply, contentDir } = parseArgs();
  const resolvedContentDir = path.resolve(contentDir);
  if (!fs.existsSync(resolvedContentDir)) {
    throw new Error(`Content directory not found: ${resolvedContentDir}`);
  }

  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  const candidates = TOPIC_CONFIGS.map((config) => buildCandidate(config, resolvedContentDir, md));

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    generated_at: new Date().toISOString(),
    contentDir: resolvedContentDir,
    total_topics: candidates.length,
    usable_topics: candidates.filter((candidate) => candidate.status === 'usable').length,
    pending_topics: candidates.filter((candidate) => candidate.status === 'pending').length,
    total_transcripts: candidates.reduce((sum, candidate) => sum + candidate.transcriptCount, 0),
    likely_enough_topics: candidates
      .filter((candidate) => candidate.status === 'usable' && candidate.transcriptCount >= 4)
      .map((candidate) => candidate.slug),
    thin_topics: candidates
      .filter((candidate) => candidate.status === 'usable' && candidate.transcriptCount < 4)
      .map((candidate) => candidate.slug),
    pending: candidates
      .filter((candidate) => candidate.status === 'pending')
      .map((candidate) => ({
        slug: candidate.slug,
        displayName: candidate.displayName,
        reason: candidate.skipReason,
      })),
  };

  const writeResults: Array<{ slug: string; action: string; id?: string; error?: string }> = [];

  if (apply) {
    const supabaseUrl =
      process.env.NEXT_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
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
          slug: candidate.slug,
          action: result.action,
          id: 'id' in result ? result.id : undefined,
        });
      } catch (e: any) {
        writeResults.push({
          slug: candidate.slug,
          action: 'error',
          error: e?.message || String(e),
        });
      }
    }
  }

  const outDir = path.join(process.cwd(), 'temp_dir');
  ensureDir(outDir);
  const outPath = path.join(outDir, `body_map_transcript_pack_import_${summary.mode}_${nowStamp()}.json`);
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
          total_topics: summary.total_topics,
          usable_topics: summary.usable_topics,
          pending_topics: summary.pending_topics,
          total_transcripts: summary.total_transcripts,
          thin_topics: summary.thin_topics,
        },
        write: apply
          ? {
              inserted: writeResults.filter((item) => item.action === 'inserted').length,
              updated: writeResults.filter((item) => item.action === 'updated').length,
              skipped: writeResults.filter((item) => item.action === 'skipped').length,
              errors: writeResults.filter((item) => item.action === 'error').length,
            }
          : undefined,
      },
      null,
      2,
    ),
  );

  if (writeResults.some((item) => item.action === 'error')) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[import-body-map-transcript-packs] Failed:', e);
  process.exitCode = 1;
});
