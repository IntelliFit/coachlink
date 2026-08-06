import fs from "node:fs";
import path from "node:path";

import { KNOWLEDGE_BOOK_WORKSPACE_ROOT } from "../src/lib/knowledgeBookWorkspace";
import type {
  KnowledgeBookMindMap,
  KnowledgeBookWorkspaceBundle,
  KnowledgeBookWorkspaceNote,
} from "../src/content/knowledgeBooks/schema";

const COLLECTION_SLUG = "huangdi-neijing-public-domain";
const WORKSPACE_DIR = path.join(KNOWLEDGE_BOOK_WORKSPACE_ROOT, COLLECTION_SLUG);
const TEMP_DIR = path.resolve(
  process.cwd(),
  "temp_dir/knowledge-book-workspaces",
  COLLECTION_SLUG
);
const WIKISOURCE_API = "https://zh.wikisource.org/w/api.php";
const LOC_SOURCE = "https://www.loc.gov/item/2021666312/";
const ACCESSED_AT = "2026-08-01";

const CHINESE_NUMERALS = [
  "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八",
  "十九", "二十", "二十一", "二十二", "二十三", "二十四",
];

type Division = {
  key: "suwen" | "lingshu";
  label: "素問" | "靈樞";
  simplifiedLabel: "素问" | "灵枢";
  volumeCount: number;
  sortBase: number;
};

type WikisourceParse = {
  title: string;
  wikitext: string;
  sections: Array<{ line?: string }>;
};

const DIVISIONS: Division[] = [
  { key: "suwen", label: "素問", simplifiedLabel: "素问", volumeCount: 24, sortBase: 100 },
  { key: "lingshu", label: "靈樞", simplifiedLabel: "灵枢", volumeCount: 12, sortBase: 200 },
];

function stripMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanWikitext(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\{header2[\s\S]*?\}\}/gi, "")
    .replace(/\{\{Textquality[\s\S]*?\}\}/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref\b[^>]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^\s*==\s*(.+?)\s*==\s*$/gm, "### $1")
    .replace(/'''?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sourcePageTitle(division: Division, volumeIndex: number) {
  return `黃帝內經/${division.label}第${CHINESE_NUMERALS[volumeIndex - 1]}卷`;
}

function sourcePageUrl(pageTitle: string) {
  return `https://zh.wikisource.org/wiki/${encodeURIComponent(pageTitle).replace(/%2F/g, "/")}`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sectionsFromWikitext(wikitext: string) {
  return Array.from(wikitext.matchAll(/^==\s*(.+?)\s*==\s*$/gm)).map((match) => ({
    line: match[1],
  }));
}

async function fetchPage(
  pageTitle: string,
  cachePath: string
): Promise<WikisourceParse> {
  if (fs.existsSync(cachePath)) {
    const wikitext = fs.readFileSync(cachePath, "utf8");
    if (wikitext.trim()) {
      return {
        title: pageTitle,
        wikitext,
        sections: sectionsFromWikitext(wikitext),
      };
    }
  }

  const url = new URL(WIKISOURCE_API);
  url.search = new URLSearchParams({
    action: "parse",
    page: pageTitle,
    prop: "wikitext|sections",
    format: "json",
    formatversion: "2",
  }).toString();

  let response: Response | null = null;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    response = await fetch(url, {
      headers: {
        "user-agent": "CoachLink knowledge-library/1.0 (public-domain book sync)",
      },
    });
    if (response.status !== 429) break;
    const retryAfterSeconds = Number(response.headers.get("retry-after") || "0");
    await wait(
      Math.max(retryAfterSeconds * 1000, 15000 + attempt * 5000)
    );
  }
  if (!response?.ok) {
    throw new Error(`Wikisource request failed (${response?.status || "unknown"}): ${pageTitle}`);
  }

  const payload = await response.json() as {
    error?: { info?: string };
    parse?: { title?: string; wikitext?: string; sections?: Array<{ line?: string }> };
  };
  if (payload.error || !payload.parse?.wikitext) {
    throw new Error(
      `${payload.error?.info || "Wikisource page is empty"}: ${pageTitle}`
    );
  }

  const result = {
    title: payload.parse.title || pageTitle,
    wikitext: payload.parse.wikitext,
    sections: payload.parse.sections || [],
  };
  fs.writeFileSync(cachePath, result.wikitext, "utf8");
  await wait(2200);
  return result;
}

function buildOverviewMindMap(): KnowledgeBookMindMap {
  return {
    title: "《黄帝内经》全书思维导图",
    description: "以文本结构和阅读主题组织，不把古代医理直接等同于现代医学结论。",
    data: [{
      id: "root",
      title: "黄帝内经",
      node_type: "domain",
      children: [
        {
          id: "suwen",
          title: "素问：理论与整体观",
          node_type: "category",
          children: [
            { id: "suwen-rhythm", title: "四时、起居与节律", node_type: "topic" },
            { id: "suwen-body", title: "身体、脏腑与经脉模型", node_type: "topic" },
            { id: "suwen-diagnosis", title: "诊察、病因与辨析", node_type: "topic" },
            { id: "suwen-method", title: "治则与方法的历史文本", node_type: "topic" },
          ],
        },
        {
          id: "lingshu",
          title: "灵枢：经脉与针刺体系",
          node_type: "category",
          children: [
            { id: "lingshu-meridian", title: "经脉、经筋与营卫", node_type: "topic" },
            { id: "lingshu-acupuncture", title: "针刺原则与器具", node_type: "topic" },
            { id: "lingshu-constitution", title: "体质、年龄与个体差异", node_type: "topic" },
            { id: "lingshu-history", title: "古代医学史与概念史", node_type: "topic" },
          ],
        },
        {
          id: "modern-reading",
          title: "现代阅读边界",
          node_type: "category",
          children: [
            { id: "history-not-evidence", title: "历史思想 ≠ 现代临床证据", node_type: "topic" },
            { id: "translation", title: "原文、今译与解释分层", node_type: "topic" },
            { id: "coach-use", title: "教练只做生活方式启发", node_type: "topic" },
          ],
        },
      ],
    }],
  };
}

function buildOverviewMarkdown() {
  return `# 《黄帝内经》公版原文与现代阅读导览

## 先说明这套内容是什么

这里收录的是《黄帝内经》古籍原文的结构化阅读版本，按《素问》二十四卷与《灵枢》十二卷组织。古籍原文本身属于公有领域；CoachLink 只新增目录、阅读路径、思维导图和现代训练场景的安全边界，不搬运现代出版社的点校、白话译文、注释或版式。

## 为什么放进 CoachLink

它不是现代运动科学教材，也不能替代医学诊断。它的价值在于帮助读者理解中国古代关于节律、劳逸、整体观和个体差异的思想传统。对教练而言，可以把这些内容当成文化史与提问框架，再用现代运动生理学、训练学和循证医学去验证具体判断。

## 全书阅读路径

1. 先读总览，理解《素问》与《灵枢》的分工。
2. 生活方式与训练节律读者，可先看《素问》第一、七卷。
3. 对身体模型和医学史感兴趣，再按卷阅读其余《素问》。
4. 《灵枢》大量涉及经脉与针刺，适合做历史文本阅读，不作为无资质操作指南。
5. 每卷先看篇目地图和思维导图，再进入公版原文。

## 三条阅读边界

- **作者观点 / 古代模型**：按历史语境理解，不直接写成现代科学事实。
- **现代证据**：涉及训练、营养、康复和疾病时，以现代专业指南与合格医疗人员意见为准。
- **CoachLink 解读**：只做概念辨析、生活方式反思和训练复盘，不给出针刺、处方或疾病治疗方案。

## 来源与版权

- 原文底本：维基文库《黄帝内经》，页面标注先秦原作属于公有领域；站点整理文本按 CC BY-SA 4.0 提供。
- 版本核验：美国国会图书馆所藏金代《黄帝内经素问》影像，馆方说明未发现版权或其他使用限制。
- 访问日期：${ACCESSED_AT}。
`;
}

function buildVolumeMarkdown(input: {
  division: Division;
  volumeIndex: number;
  chapterTitles: string[];
  originalText: string;
  sourceUrl: string;
}) {
  const { division, volumeIndex, chapterTitles, originalText, sourceUrl } = input;
  const numeral = CHINESE_NUMERALS[volumeIndex - 1];
  const chapterList = chapterTitles.length
    ? chapterTitles.map((title) => `- ${title}`).join("\n")
    : "- 本卷篇目未能从来源页稳定识别，请对照来源页核验。";

  return `# 《黄帝内经·${division.simplifiedLabel}》第${numeral}卷

## 阅读提示

本页首先保留公版原文，再提供结构导航。请把它当作古代医学与思想史文本阅读；文中的身体模型、病名、诊察和治疗方法不自动等同于现代医学结论，也不构成诊疗或训练处方。

## 篇目地图

${chapterList}

## 公版原文

${originalText}

## CoachLink 阅读边界

- 先区分原文在说什么、后世如何解释、现代证据是否支持，三层不要混写。
- 涉及训练时，只提取“节律、劳逸、观察个体反应”等一般性问题意识。
- 涉及疾病、针刺、药物或康复决策时，应交给有资质的医疗专业人员。

## 来源

- [维基文库原文页](${sourceUrl})：古籍原文为公有领域；站点整理文本按 CC BY-SA 4.0 提供。
- [美国国会图书馆金代《素问》版本记录](${LOC_SOURCE})：用于版本与权利状态交叉核验。
- 访问日期：${ACCESSED_AT}。
`;
}

function createOverviewNote(): KnowledgeBookWorkspaceNote {
  return {
    slug: "overview",
    file: "notes/00-overview.md",
    noteType: "overview",
    chapterOrder: 0,
    chapterTitle: "全书总览",
    title: "《黄帝内经》总览：先分清古籍原文、现代证据与训练启发",
    summary: "按《素问》24卷与《灵枢》12卷整理的公版原文入口，配套整书阅读路径、现代证据边界和原创思维导图。",
    sortOrder: 90,
    author: "佚名 · CoachLink 整理",
    isFree: true,
    isPublished: true,
    readingGuide: {
      estimatedMinutes: 10,
      suitableFor: ["中国医学思想史读者", "关注节律与劳逸观念的教练", "希望阅读公版古籍原文的用户"],
      goals: ["理解《素问》与《灵枢》的结构", "建立原文、解释与现代证据三层框架", "选择适合自己的阅读路径"],
      prerequisites: ["不把古代医学文本当作个人诊疗建议"],
    },
    keyTakeaways: [
      "《黄帝内经》由《素问》与《灵枢》两部分构成",
      "古籍思想具有历史价值，但不等同于现代临床证据",
      "训练场景只做节律、劳逸和个体观察的启发性转译",
      "现代点校、翻译和注释不因原作公版而自动公版",
    ],
    discussionPrompts: [
      "你最想从《黄帝内经》中理解的是文化史、生活节律，还是身体观？",
      "面对古代经验与现代证据冲突时，你会用什么标准判断？",
      "教练在引用传统养生观念时，应该明确哪些专业边界？",
    ],
    citations: [
      {
        title: "维基文库：《黄帝内经》",
        url: "https://zh.wikisource.org/wiki/黃帝內經",
        note: "公版原文与篇目结构来源",
        license: "古籍原文 Public Domain；站点文本 CC BY-SA 4.0",
        accessedAt: ACCESSED_AT,
      },
      {
        title: "Library of Congress: Huang di nei jing su wen",
        url: LOC_SOURCE,
        note: "金代版本记录与权利状态交叉核验",
        license: "馆方未发现版权或其他限制",
        accessedAt: ACCESSED_AT,
      },
    ],
    mindMap: buildOverviewMindMap(),
  };
}

async function main() {
  const force = process.argv.includes("--force");
  if (fs.existsSync(WORKSPACE_DIR) && !force) {
    throw new Error(`Workspace already exists: ${WORKSPACE_DIR}. Re-run with --force.`);
  }

  fs.mkdirSync(path.join(WORKSPACE_DIR, "notes"), { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const notes: KnowledgeBookWorkspaceNote[] = [createOverviewNote()];
  fs.writeFileSync(
    path.join(WORKSPACE_DIR, "notes/00-overview.md"),
    buildOverviewMarkdown(),
    "utf8"
  );

  for (const division of DIVISIONS) {
    for (let volumeIndex = 1; volumeIndex <= division.volumeCount; volumeIndex += 1) {
      const pageTitle = sourcePageTitle(division, volumeIndex);
      const slug = `${division.key}-volume-${String(volumeIndex).padStart(2, "0")}`;
      const cachePath = path.join(TEMP_DIR, `${slug}.wikitext`);
      const parsed = await fetchPage(pageTitle, cachePath);
      const chapterTitles = parsed.sections
        .map((section) => stripMarkup(section.line || ""))
        .filter(Boolean);
      const originalText = cleanWikitext(parsed.wikitext);
      const sourceUrl = sourcePageUrl(pageTitle);
      const numeral = CHINESE_NUMERALS[volumeIndex - 1];
      const fileName = `${division.key}-${String(volumeIndex).padStart(2, "0")}.md`;

      fs.writeFileSync(
        cachePath,
        parsed.wikitext,
        "utf8"
      );
      fs.writeFileSync(
        path.join(WORKSPACE_DIR, "notes", fileName),
        buildVolumeMarkdown({
          division,
          volumeIndex,
          chapterTitles,
          originalText,
          sourceUrl,
        }),
        "utf8"
      );

      notes.push({
        slug,
        file: `notes/${fileName}`,
        noteType: "chapter",
        chapterOrder: division.sortBase + volumeIndex,
        chapterTitle: `${division.simplifiedLabel}第${numeral}卷`,
        title: `《黄帝内经·${division.simplifiedLabel}》第${numeral}卷：${chapterTitles.join("、") || "公版原文"}`,
        summary: `收录《${division.simplifiedLabel}》第${numeral}卷公版原文，共 ${chapterTitles.length} 篇，并提供篇目地图、来源和现代阅读边界。`,
        sortOrder: division.sortBase + volumeIndex,
        author: "佚名 · CoachLink 整理",
        isFree: true,
        isPublished: true,
        readingGuide: {
          suitableFor: ["古代医学思想史读者", "需要原文与结构导航的用户"],
          goals: ["辨认本卷篇目主线", "在历史语境中阅读原文", "区分古代模型与现代证据"],
          prerequisites: ["不将古籍原文作为个人诊疗或针刺操作指南"],
        },
        keyTakeaways: chapterTitles.slice(0, 6),
        discussionPrompts: [
          `本卷哪一个概念最需要结合历史语境才能理解？`,
          `本卷哪些说法属于古代身体模型，不能直接写成现代科学结论？`,
          `如果只提取一般性的劳逸或观察原则，你会如何避免越过教练专业边界？`,
        ],
        citations: [{
          title: `维基文库：${pageTitle}`,
          url: sourceUrl,
          note: "公版古籍原文来源",
          license: "古籍原文 Public Domain；站点文本 CC BY-SA 4.0",
          accessedAt: ACCESSED_AT,
        }],
      });
    }
  }

  const bundle: KnowledgeBookWorkspaceBundle = {
    format: "book-note-v3-public-domain",
    noteStyle: "public-domain-original-with-reading-guide",
    disclaimer: "本内容用于古籍与医学思想史阅读，不构成现代医学、针刺、康复或训练处方。具体健康问题请咨询有资质的医疗专业人员。",
    source: {
      title: "黄帝内经",
      authors: ["佚名"],
      originalFilePath: "https://zh.wikisource.org/wiki/黃帝內經",
      copyrightMode: "public-domain",
      collectionSlug: COLLECTION_SLUG,
      collectionTitle: "《黄帝内经》公版原文与现代阅读导览",
    },
    notes,
  };

  fs.writeFileSync(
    path.join(WORKSPACE_DIR, "book.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(WORKSPACE_DIR, "README.md"),
    `# 《黄帝内经》公版原文工作区\n\n本目录由 \`npm run knowledge-books:sync-neijing -- --force\` 从维基文库公开 API 确定性生成。\n\n- 结构：总览 + 《素问》24卷 + 《灵枢》12卷\n- 原文：公有领域古籍文本\n- 站点整理：维基文库 CC BY-SA 4.0\n- 现代导读：CoachLink 原创\n- 禁止混入现代出版社点校、翻译、注释或扫描版式\n`,
    "utf8"
  );

  console.log(JSON.stringify({
    workspaceDir: WORKSPACE_DIR,
    noteCount: notes.length,
    suwenVolumes: 24,
    lingshuVolumes: 12,
  }, null, 2));
}

main().catch((error) => {
  console.error("Failed to sync Huangdi Neijing workspace:");
  console.error(error);
  process.exit(1);
});
