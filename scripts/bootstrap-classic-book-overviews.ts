import fs from "node:fs";
import path from "node:path";

import { KNOWLEDGE_BOOK_WORKSPACE_ROOT } from "../src/lib/knowledgeBookWorkspace";
import type {
  KnowledgeBookMindMap,
  KnowledgeBookWorkspaceBundle,
  KnowledgeBookWorkspaceNote,
} from "../src/content/knowledgeBooks/schema";

type ClassicBook = {
  slug: string;
  title: string;
  authors: string[];
  category: string;
  summary: string;
  coreQuestion: string;
  framework: string[];
  applications: string[];
  boundary: string;
  sortOrder: number;
};

type ClassicTopicDetail = {
  title: string;
  concept: string;
  decision: string;
  pitfall: string;
};

type ClassicTopicCatalog = Record<
  string,
  Record<string, Omit<ClassicTopicDetail, "title">>
>;

const catalogPath = path.resolve(process.cwd(), "config/knowledge-book-classics.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as ClassicBook[];
const topicCatalogPath = path.resolve(
  process.cwd(),
  "config/knowledge-book-classic-topics.json"
);
const topicCatalog = JSON.parse(
  fs.readFileSync(topicCatalogPath, "utf8")
) as ClassicTopicCatalog;
const force = process.argv.includes("--force");

function buildMindMap(book: ClassicBook): KnowledgeBookMindMap {
  return {
    title: `《${book.title}》全书知识地图`,
    description: "这是 CoachLink 根据书籍主题绘制的原创导航图，不复制原书插图或版式。",
    data: [{
      id: "root",
      title: book.title,
      node_type: "domain",
      children: [
        {
          id: "question",
          title: "核心问题",
          description: book.coreQuestion,
          node_type: "category",
        },
        ...book.framework.map((title, index) => ({
          id: `framework-${index + 1}`,
          title,
          node_type: "category" as const,
        })),
        {
          id: "boundary",
          title: "应用边界",
          description: book.boundary,
          node_type: "category",
        },
      ],
    }],
  };
}

function buildTopicMindMap(
  book: ClassicBook,
  topic: ClassicTopicDetail,
  index: number
): KnowledgeBookMindMap {
  return {
    title: `《${book.title}》主题 ${index + 1} · ${topic.title}`,
    description: "CoachLink 原创主题知识地图：概念、决策、验证、误区和边界放在同一张图里。",
    data: [{
      id: "root",
      title: topic.title,
      node_type: "domain",
      children: [
        {
          id: "concept",
          title: "核心概念",
          description: topic.concept,
          node_type: "category",
        },
        {
          id: "decision",
          title: "教练决策",
          description: topic.decision,
          node_type: "category",
        },
        {
          id: "practice",
          title: "最小实践",
          description: book.applications[index % book.applications.length],
          node_type: "category",
        },
        {
          id: "feedback",
          title: "记录与复盘",
          description: "先留基线，一次只改一个关键变量，再用结果和恢复信号判断。",
          node_type: "category",
        },
        {
          id: "pitfall",
          title: "常见误用",
          description: topic.pitfall,
          node_type: "category",
        },
        {
          id: "boundary",
          title: "应用边界",
          description: book.boundary,
          node_type: "category",
        },
      ],
    }],
  };
}

function buildMetricChecklist(book: ClassicBook) {
  const category = book.category;
  if (/跑步|耐力/.test(category)) {
    return ["目标配速或分段表现", "主观用力与呼吸反应", "次日腿部状态、睡眠与疼痛趋势"];
  }
  if (/营养/.test(category)) {
    return ["训练表现和恢复稳定性", "能量、饥饿与消化反应", "体重或体成分的中期趋势，而非单日波动"];
  }
  if (/心理/.test(category)) {
    return ["计划依从率和关键行为完成率", "比赛或训练前后的唤醒与注意状态", "主观信心、压力和恢复趋势"];
  }
  if (/康复|纠正|解剖|核心|柔韧|肌筋膜/.test(category)) {
    return ["目标动作的可用范围与控制质量", "疼痛、麻木或代偿是否变化", "负荷耐受和真实任务表现"];
  }
  if (/速度|运动表现/.test(category)) {
    return ["速度、跳跃或专项表现", "动作技术在高强度下是否稳定", "组间下降幅度与次日恢复"];
  }
  return ["主项表现、次数余量或速度趋势", "动作技术的一致性", "疲劳、睡眠和下一次训练准备度"];
}

function buildOverviewMarkdown(book: ClassicBook) {
  return `# 《${book.title}》深读入口

## 这本书最值得解决的问题

${book.coreQuestion}

这篇不是原书缩写，也不按页复述内容。它先建立一张可复习的决策地图，帮助读者判断自己为什么读、先读哪一部分、哪些观点需要结合现代证据和个人训练数据继续验证。

## 全书知识框架

${book.framework.map((item, index) => `### ${index + 1}. ${item}\n\n这一主题已经拆成独立深读页。阅读时要回答三件事：它改变哪一个训练决策、用什么信号检验、在什么条件下应该停止或转介。`).join("\n\n")}

## 四个主题怎样连起来

先用第一个主题建立语言和机制，再用第二个主题把观察变成评估，用第三个主题组织训练变量，最后用第四个主题处理复盘、恢复和边界。实际阅读不必机械按顺序，但任何应用都应该能回到“目标—剂量—反馈—调整”这条链路。

## CoachLink 怎么读

- **作者与体系观点**：先准确理解方法在什么人群、目标和环境中形成。
- **现代证据**：涉及生理、康复、营养或心理结论时，继续与指南、研究和真实结果交叉验证。
- **训练转译**：只把能解释目标、剂量、反馈和风险的部分带进计划，不因为一本书有影响力就整套照搬。

## 可以立刻做的三件事

${book.applications.map((item) => `- ${item}`).join("\n")}

## 应用边界

${book.boundary}

## 建议阅读与复盘顺序

1. 先看本页思维导图，写下你当前最需要解决的问题。
2. 再回到正版书或经授权版本，按知识框架精读对应章节。
3. 每读一部分只改一个训练假设，并提前确定观察指标。
4. 两到四周后用训练日志、表现和恢复数据复盘，而不是只凭阅读时的认同感。

## 讨论前先想

- 这本书最可能改变你当前的哪一个训练决策？
- 哪一个观点高度依赖作者的目标人群或训练环境？
- 你会用什么数据判断它对自己是否有效？
`;
}

function buildTopicMarkdown(
  book: ClassicBook,
  topic: ClassicTopicDetail,
  index: number
) {
  const application = book.applications[index % book.applications.length];
  const metrics = buildMetricChecklist(book);
  return `# 《${book.title}》主题深读 ${index + 1}：${topic.title}

## 这部分在全书中的位置

这一主题是回答“${book.coreQuestion}”时不可跳过的一层。下面内容是 CoachLink 的原创解释和训练转译，不按原书页序复述，也不提供原书完整模板。

## 核心概念

${topic.concept}

理解这一主题时，不要急着找一个动作或一组数字。先分清目标、当前能力、可控制变量和反馈信号，才能判断某种方法对眼前这个人是否真的合适。

## 从知识转成教练决策

${topic.decision}

### 训练前要写清

- 当前要解决的具体问题是什么，怎样算改善。
- 哪个变量是本轮真正要改变的，哪些变量暂时保持稳定。
- 哪些条件出现时必须降级、停止或转介。

### 本轮最小实践

- ${application}
- 先记录一段基线，再实施小幅变化；不要同时更换动作、容量、强度、频率和恢复策略。
- 预先约定复盘日期，避免只在状态好或坏时临时解释结果。

## 建议记录的反馈

${metrics.map((item) => `- ${item}`).join("\n")}

## 一个可验证的微实验

1. 用最近一到两周记录描述当前基线，不凭印象写结论。
2. 从“${topic.title}”中只选一个可执行改变，并保持其它关键变量基本稳定。
3. 每次训练记录过程指标，同时保留恢复和不良反应。
4. 到约定日期比较趋势；有效则小步延续，无效则回到假设而不是盲目加量。

## 常见误用

${topic.pitfall}

经典书里的模型往往诞生于特定人群、项目、器械和时代。把模型名称背下来不等于掌握决策逻辑，更不能把个案经验包装成适用于所有人的规则。

## 应用边界

${book.boundary}

## 讨论与复盘

- 你当前最接近这个主题的真实问题是什么？
- 你会保留哪个变量不变，才看得出干预是否有效？
- 如果结果与书中框架不一致，你准备先检查数据、执行还是原始假设？
`;
}

function buildBundle(book: ClassicBook): KnowledgeBookWorkspaceBundle {
  const detailByTitle = topicCatalog[book.slug];
  const topics = book.framework.map((title) => ({
    title,
    ...detailByTitle?.[title],
  })) as ClassicTopicDetail[];
  if (
    !detailByTitle ||
    topics.length !== book.framework.length ||
    topics.some((topic) => !topic.concept || !topic.decision || !topic.pitfall)
  ) {
    throw new Error(
      `${book.slug}: expected complete details for ${book.framework.length} topics`
    );
  }

  const overview: KnowledgeBookWorkspaceNote = {
    slug: "overview",
    file: "notes/00-overview.md",
    noteType: "overview",
    chapterOrder: 0,
    chapterTitle: "深读入口",
    title: `《${book.title}》深读入口：先建立全书地图，再决定怎么用`,
    summary: book.summary,
    sortOrder: book.sortOrder * 10,
    author: book.authors.join("、") || "作者与版本待核验",
    isFree: true,
    isPublished: true,
    mindMap: buildMindMap(book),
    readingGuide: {
      estimatedMinutes: 8,
      suitableFor: [`关注${book.category}的训练者`, "教练与知识库编辑", "准备精读正版原书的读者"],
      goals: ["掌握全书核心问题", "看懂主题之间的关系", "明确应用边界与复盘方法"],
      prerequisites: ["本页不替代原书，也不提供原文件下载"],
    },
    keyTakeaways: book.framework,
    discussionPrompts: [
      "这本书最可能改变你当前的哪一个训练决策？",
      "哪一个观点高度依赖作者的目标人群或训练环境？",
      "你会用什么训练数据判断它对自己是否有效？",
    ],
    citations: [{
      title: `书目：${book.title}`,
      note: "基于本地书目盘点建立原创导读；原始电子文件仅供内部研究，不上传、不公开下载。正式引用前应继续核对正版书的作者、版次、出版社与页码。",
      license: "interpretive-notes-only",
    }],
  };

  const topicNotes: KnowledgeBookWorkspaceNote[] = topics.map((topic, index) => ({
    slug: `topic-${String(index + 1).padStart(2, "0")}`,
    file: `notes/${String(index + 1).padStart(2, "0")}-topic.md`,
    noteType: "chapter",
    chapterOrder: index + 1,
    chapterTitle: topic.title,
    title: `《${book.title}》主题深读 ${index + 1}：${topic.title}`,
    summary: `${topic.concept} 本页进一步给出教练决策、反馈记录、微实验和应用边界。`,
    sortOrder: book.sortOrder * 10 + index + 1,
    author: book.authors.join("、") || "作者与版本待核验",
    isFree: true,
    isPublished: true,
    mindMap: buildTopicMindMap(book, topic, index),
    readingGuide: {
      estimatedMinutes: 10,
      suitableFor: [`正在学习${book.category}的训练者`, "需要把理论转成计划的教练", "愿意记录并复盘的读者"],
      goals: ["说清核心概念", "形成可执行决策", "设计一次可验证的小实验"],
      prerequisites: ["先阅读全书深读入口", "本页不替代正版原书或专业诊疗"],
    },
    keyTakeaways: [
      topic.title,
      book.applications[index % book.applications.length],
      "一次只改变少量关键变量，并提前定义反馈信号",
      topic.pitfall,
    ],
    discussionPrompts: [
      "你当前最接近这个主题的真实问题是什么？",
      "你会保留哪个变量不变，才看得出干预是否有效？",
      "如果结果与书中框架不一致，你先检查数据、执行还是原始假设？",
    ],
    citations: [{
      title: `书目：${book.title}`,
      note: "本页为 CoachLink 原创解释性笔记；不复制原书正文、插图、表格或完整处方。正式学术或专业引用请回到正版书核对作者、版次、出版社和页码。",
      license: "interpretive-notes-only",
    }],
  }));

  return {
    format: "book-note-v4-classic-deep-read",
    noteStyle: "interpretive-reading-note",
    disclaimer: "本页为 CoachLink 原创导读与知识地图，不复制原书正文、插图、表格或完整训练模板，也不替代购买和阅读正版原书。",
    source: {
      title: book.title,
      authors: book.authors,
      originalFilePath: `local-library://${book.slug}`,
      copyrightMode: "interpretive-notes-only",
      collectionSlug: book.slug,
      collectionTitle: `《${book.title}》原创深读笔记`,
    },
    notes: [overview, ...topicNotes],
  };
}

function main() {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const book of catalog) {
    const workspaceDir = path.join(KNOWLEDGE_BOOK_WORKSPACE_ROOT, book.slug);
    if (fs.existsSync(workspaceDir) && !force) {
      skipped.push(book.slug);
      continue;
    }

    fs.mkdirSync(path.join(workspaceDir, "notes"), { recursive: true });
    const bundle = buildBundle(book);
    fs.writeFileSync(
      path.join(workspaceDir, "book.json"),
      `${JSON.stringify(bundle, null, 2)}\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(workspaceDir, "notes/00-overview.md"),
      buildOverviewMarkdown(book),
      "utf8"
    );
    const topics = book.framework.map((title) => ({
      title,
      ...topicCatalog[book.slug]?.[title],
    })) as ClassicTopicDetail[];
    topics.forEach((topic, index) => {
      fs.writeFileSync(
        path.join(
          workspaceDir,
          `notes/${String(index + 1).padStart(2, "0")}-topic.md`
        ),
        buildTopicMarkdown(book, topic, index),
        "utf8"
      );
    });
    fs.writeFileSync(
      path.join(workspaceDir, "README.md"),
      `# ${book.title}\n\n本工作区收录 1 篇全书导读和 ${topics.length} 篇原创主题深读，每篇都带独立知识地图、决策清单、复盘问题和版权边界。内容不复制原书正文、插图、表格或完整模板。\n`,
      "utf8"
    );
    created.push(book.slug);
  }

  console.log(JSON.stringify({ catalogCount: catalog.length, created, skipped }, null, 2));
}

main();
