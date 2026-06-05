export type KnowledgeCoreTopicKey = "injury" | "plateau" | "standard" | "start";

export type KnowledgeCoreTopicTag = {
  label: string;
  kind: "body-map" | "search" | "plans" | "books";
  value: string;
};

export type KnowledgeCoreTopic = {
  topicKey: KnowledgeCoreTopicKey;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  imageUrl: string;
  primaryCta: string;
  primaryKind: KnowledgeCoreTopicTag["kind"];
  primaryValue: string;
  linkedPlans: string[];
  linkedArticles: string[];
  linkedBooks: string[];
  tags: KnowledgeCoreTopicTag[];
};

export const knowledgeCoreTopics: KnowledgeCoreTopic[] = [
  {
    topicKey: "injury",
    title: "不舒服 / 怕受伤",
    shortTitle: "不舒服",
    eyebrow: "先排风险",
    description: "手腕、肩、腰背不舒服时，先判断能不能练，再找替代动作和恢复路径。",
    imageUrl: "/images/knowledge-core/injury.png",
    primaryCta: "查看肩腕腰痛入口",
    primaryKind: "body-map",
    primaryValue: "shoulder",
    linkedPlans: ["round-shoulder-scapula-4w", "anterior-pelvic-tilt-4w"],
    linkedArticles: ["手腕 TFCC/尺侧痛训练避险", "肩袖/肩前侧不适自查", "腰背不适时怎么调整深蹲硬拉"],
    linkedBooks: ["体态纠正与动作控制笔记"],
    tags: [
      { label: "肩腕腰痛", kind: "body-map", value: "shoulder" },
      { label: "训练避险", kind: "search", value: "伤病 康复 疼痛" },
      { label: "恢复计划", kind: "plans", value: "posture" },
    ],
  },
  {
    topicKey: "plateau",
    title: "卡住了 / 没效果",
    shortTitle: "卡住了",
    eyebrow: "先诊断瓶颈",
    description: "重量、次数、体型或神技进度停住时，先拆原因，再选择专项计划。",
    imageUrl: "/images/knowledge-core/plateau.png",
    primaryCta: "诊断平台期",
    primaryKind: "search",
    primaryValue: "平台期 瓶颈 负重引体 卧推",
    linkedPlans: ["weighted-pullup-6w-strength", "weighted-dip-6w-strength", "bench-press-8w-specialization", "squat-8w-depth-and-strength"],
    linkedArticles: ["负重引体平台期诊断", "卧推平台期：先判断卡点再加重量", "俄挺/前水平为什么不能只练专项"],
    linkedBooks: ["力量专项计划设计笔记"],
    tags: [
      { label: "负重引体", kind: "plans", value: "weighted_pullup" },
      { label: "卧推卡点", kind: "search", value: "卧推 平台期" },
      { label: "专项计划", kind: "plans", value: "all" },
    ],
  },
  {
    topicKey: "standard",
    title: "练标准 / 动作自查",
    shortTitle: "练标准",
    eyebrow: "先看动作",
    description: "用统一标准看动作幅度、借力、代偿和视频角度，减少无效争论。",
    imageUrl: "/images/knowledge-core/standard.png",
    primaryCta: "看动作标准",
    primaryKind: "search",
    primaryValue: "动作 标准 自查 引体 臂屈伸",
    linkedPlans: ["weighted-pullup-6w-strength", "weighted-dip-6w-strength", "powerlifting-12w-total-base"],
    linkedArticles: ["标准引体向上检查表", "负重臂屈伸检查表", "深蹲/卧推/硬拉视频自查角度"],
    linkedBooks: ["力量训练原理"],
    tags: [
      { label: "引体标准", kind: "search", value: "引体 标准" },
      { label: "视频自查", kind: "search", value: "视频 自查 动作" },
      { label: "常见代偿", kind: "search", value: "代偿 动作标准" },
    ],
  },
  {
    topicKey: "start",
    title: "直接开练",
    shortTitle: "开练",
    eyebrow: "先执行一版",
    description: "不想先读长文时，直接选一个可复制计划，从今天开始记录。",
    imageUrl: "/images/knowledge-core/start.png",
    primaryCta: "复制训练计划",
    primaryKind: "plans",
    primaryValue: "all",
    linkedPlans: ["weighted-pullup-6w-strength", "weighted-dip-6w-strength", "round-shoulder-scapula-4w", "anterior-pelvic-tilt-4w"],
    linkedArticles: ["如何选择力量专项计划", "体态纠正不是拉伸清单"],
    linkedBooks: ["力量专项计划设计笔记", "体态纠正与动作控制笔记"],
    tags: [
      { label: "负重引体 6 周", kind: "plans", value: "weighted_pullup" },
      { label: "体态纠正", kind: "plans", value: "posture" },
      { label: "深度资料", kind: "books", value: "books" },
    ],
  },
];

export function getKnowledgeCoreTopic(key: KnowledgeCoreTopicKey) {
  return knowledgeCoreTopics.find((topic) => topic.topicKey === key) || knowledgeCoreTopics[0];
}
