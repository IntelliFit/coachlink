"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Dumbbell,
  HeartPulse,
  Home,
  Lock,
  MessageCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRoundCheck,
  Users,
  Video,
} from "lucide-react";

type ViewKey =
  | "landing"
  | "login"
  | "register"
  | "profile"
  | "diagnosis"
  | "today"
  | "ability"
  | "node"
  | "execution"
  | "coach"
  | "mine";
type TabKey = "today" | "ability" | "coach" | "mine";
type AuthMode = "wechat" | "password" | "code";
type ScenarioKey = "starter" | "posture" | "plateau";
type AbilityKey = "push" | "pull" | "legs" | "hinge" | "core" | "engine" | "restore";
type NodeStatus = "completed" | "current" | "available" | "locked" | "risk";

type AbilityNode = {
  id: string;
  ability: AbilityKey;
  level: string;
  title: string;
  status: NodeStatus;
  mission: string;
  standard: string;
  why: string;
  regression: string;
  progression: string;
  mistakes: string[];
  safety: string;
  content: string;
};

type Scenario = {
  key: ScenarioKey;
  title: string;
  subtitle: string;
  level: string;
  ability: AbilityKey;
  nodeId: string;
  weekGoal: string;
  risk: string;
  tags: string[];
};

const scenarios: Scenario[] = [
  {
    key: "starter",
    title: "零基础起步",
    subtitle: "怕练错、怕坚持不下去",
    level: "基础能力 L1",
    ability: "push",
    nodeId: "push-wall",
    weekGoal: "本周只做 2 次，每次 12 分钟，先建立动作习惯和正反馈。",
    risk: "低",
    tags: ["无器械", "10-20 分钟", "唯一计划"],
  },
  {
    key: "posture",
    title: "体态恢复",
    subtitle: "肩颈、腰背不舒服",
    level: "恢复能力 L1",
    ability: "restore",
    nodeId: "restore-neck",
    weekGoal: "先做风险筛查和低风险准备，再进入推拉训练。",
    risk: "中",
    tags: ["疼痛筛查", "动作替换", "先安全"],
  },
  {
    key: "plateau",
    title: "进阶卡关",
    subtitle: "练了很久没效果",
    level: "拉力能力 L3",
    ability: "pull",
    nodeId: "pull-row",
    weekGoal: "用完成度、RPE、视频反馈定位瓶颈，而不是泛泛地继续坚持。",
    risk: "中",
    tags: ["瓶颈诊断", "视频点评", "计划调整"],
  },
];

const abilityMeta: Array<{
  key: AbilityKey;
  title: string;
  short: string;
  desc: string;
}> = [
  { key: "push", title: "推力树", short: "推", desc: "俯卧撑、支撑、臂屈伸" },
  { key: "pull", title: "拉力树", short: "拉", desc: "悬垂、划船、引体向上" },
  { key: "legs", title: "下肢树", short: "腿", desc: "蹲、弓步、单腿稳定" },
  { key: "hinge", title: "髋与后链", short: "髋", desc: "臀腿后侧、腰背保护" },
  { key: "core", title: "核心树", short: "核", desc: "抗伸展、抗旋转、身体控制" },
  { key: "engine", title: "心肺移动", short: "能", desc: "减脂、体能、移动能力" },
  { key: "restore", title: "恢复活动库", short: "复", desc: "筛查、活动度、体态恢复" },
];

const abilityNodes: AbilityNode[] = [
  {
    id: "push-wall",
    ability: "push",
    level: "L1",
    title: "墙面推",
    status: "current",
    mission: "2 组 x 10 次",
    standard: "身体保持直线，肩胛稳定，手腕和肩前侧没有明显疼痛。",
    why: "先用最低门槛学习支撑、呼吸和肩胛控制，不急着做标准俯卧撑。",
    regression: "手腕不舒服时改成拳面支撑，或减少动作幅度。",
    progression: "连续两次轻松完成后，升级到上斜俯卧撑。",
    mistakes: ["塌腰", "耸肩", "憋气", "只追求次数"],
    safety: "疼痛超过 4/10 或出现刺痛时停止，先进入恢复树节点。",
    content: "平台内容会把动作标准、常见错误、替代动作和饮食原则拆成节点卡。",
  },
  {
    id: "push-incline",
    ability: "push",
    level: "L2",
    title: "上斜俯卧撑",
    status: "available",
    mission: "3 组 x 8 次",
    standard: "胸靠近支撑面，核心不塌，动作速度可控。",
    why: "用更低负荷接近标准俯卧撑，是小白最稳的推力升级节点。",
    regression: "把支撑面抬高，优先保证动作完整。",
    progression: "稳定完成后进入跪姿俯卧撑或标准俯卧撑。",
    mistakes: ["只弯脖子", "髋部下沉", "手掌离身体太远"],
    safety: "肩前侧不适时减少深度，并查看肩颈准备节点。",
    content: "动作库示范视频会作为节点标准，不再是孤立的动作列表。",
  },
  {
    id: "push-standard",
    ability: "push",
    level: "L3",
    title: "标准俯卧撑",
    status: "locked",
    mission: "3 组 x 8 次",
    standard: "3 组各 8 次，RPE 不超过 8，动作幅度稳定。",
    why: "这是臂屈伸、倒立推和上肢训练的基础门槛。",
    regression: "回到上斜俯卧撑继续积累容量。",
    progression: "进入臂屈伸和倒立支撑分支。",
    mistakes: ["半程动作", "塌腰", "抢速度"],
    safety: "腕、肘、肩疼痛时先降级，不硬冲次数。",
    content: "通过标准会解锁进阶知识和排行榜入口。",
  },
  {
    id: "pull-hang",
    ability: "pull",
    level: "L1",
    title: "主动悬垂",
    status: "completed",
    mission: "4 组 x 15 秒",
    standard: "稳定悬垂，肩部不过度耸起，握力可控。",
    why: "先建立握力和肩胛稳定，避免一上来就硬拉引体。",
    regression: "脚尖轻触地面减重。",
    progression: "进入澳式划船或肩胛引体。",
    mistakes: ["完全松肩", "身体大幅晃动", "憋气"],
    safety: "肩部刺痛或麻木时停止。",
    content: "适合作为儿童、零基础和体重较大用户的拉力起点。",
  },
  {
    id: "pull-row",
    ability: "pull",
    level: "L3",
    title: "澳式划船",
    status: "current",
    mission: "4 组 x 8 次",
    standard: "胸靠近杆，身体保持直线，背部主动发力。",
    why: "用水平拉积累背部容量，是引体向上前最关键的一站。",
    regression: "站得更高一点，减少身体倾斜。",
    progression: "进入弹力带引体或离心引体。",
    mistakes: ["耸肩", "只用手臂拉", "下放失控"],
    safety: "肘部或肩前侧疼痛时减少幅度并上传视频求点评。",
    content: "卡关时会触发 AI 瓶颈诊断和教练视频点评。",
  },
  {
    id: "pull-up",
    ability: "pull",
    level: "L4",
    title: "标准引体",
    status: "locked",
    mission: "5 组 x 3 次",
    standard: "下巴过杆，幅度统一，不借大幅摆动。",
    why: "拉力树核心节点，也是街健工具和排行榜入口之一。",
    regression: "弹力带引体或离心引体。",
    progression: "进入负重引体和专项排名。",
    mistakes: ["半程", "摆动借力", "肩胛失控"],
    safety: "肩肘慢性疼痛时进入恢复树和教练点评。",
    content: "高阶内容会包含赛级标准、系数计算和周期化训练。",
  },
  {
    id: "legs-sit",
    ability: "legs",
    level: "L1",
    title: "坐站",
    status: "current",
    mission: "2 组 x 12 次",
    standard: "膝盖方向稳定，起身不扶手，脚跟不离地。",
    why: "适合儿童、零基础、体能弱用户建立下肢基础。",
    regression: "提高椅子高度。",
    progression: "进入徒手深蹲。",
    mistakes: ["膝盖内扣", "身体猛冲", "脚跟离地"],
    safety: "膝痛加重时减少深度。",
    content: "下肢树会承接体态、减脂、跑跳和专项训练。",
  },
  {
    id: "hinge-bridge",
    ability: "hinge",
    level: "L1",
    title: "臀桥",
    status: "available",
    mission: "3 组 x 12 次",
    standard: "臀部主导发力，腰不过伸，顶峰停顿 1 秒。",
    why: "先找臀部发力，降低腰背代偿。",
    regression: "缩短动作幅度。",
    progression: "进入髋铰链和硬拉准备。",
    mistakes: ["顶腰", "脚离身体太远", "只追求高度"],
    safety: "腰痛明显时停止并查看恢复节点。",
    content: "后链内容可连接康复、体态和力量训练。",
  },
  {
    id: "core-deadbug",
    ability: "core",
    level: "L1",
    title: "死虫",
    status: "available",
    mission: "3 组 x 8 次/侧",
    standard: "腰背不离地，呼吸稳定，动作不抢速度。",
    why: "先学会控制骨盆和呼吸，再进入平板和悬垂举腿。",
    regression: "只移动手臂或只移动腿。",
    progression: "进入平板支撑。",
    mistakes: ["腰拱起", "动作太快", "憋气"],
    safety: "腰背不适时缩小幅度。",
    content: "核心树会作为所有动作分支的通用支撑能力。",
  },
  {
    id: "engine-walk",
    ability: "engine",
    level: "L1",
    title: "快走",
    status: "available",
    mission: "20 分钟",
    standard: "连续完成，能说短句但不能唱歌。",
    why: "对减脂、体能弱、时间碎片用户最友好。",
    regression: "拆成 2 次 10 分钟。",
    progression: "进入台阶训练或跑走结合。",
    mistakes: ["一开始太快", "只看步数", "不记录感受"],
    safety: "膝踝不适时降低速度和坡度。",
    content: "饮食内容会以手掌法和外食选择嵌入今日任务。",
  },
  {
    id: "restore-neck",
    ability: "restore",
    level: "L1",
    title: "肩颈准备",
    status: "risk",
    mission: "6 分钟",
    standard: "活动后紧张感下降，训练中无刺痛、麻木、放射痛。",
    why: "久坐用户进入推拉训练前，先降低肩颈代偿和恐惧感。",
    regression: "减少幅度，只保留无痛范围。",
    progression: "进入墙天使和上肢基础动作。",
    mistakes: ["用力拉拽", "追求酸爽", "疼痛还硬做"],
    safety: "刺痛、麻木、放射痛时停止，并建议专业评估。",
    content: "恢复树只做筛查、预防和转介提示，不做医疗诊断。",
  },
];

const goals = ["减脂", "增肌", "力量", "体态健康", "专项提升"];
const bodyParts = ["肩颈", "胸部", "背部", "腰腹", "臀腿", "膝踝"];
const levels = ["完全新手", "断续练过", "持续训练 6 个月+", "专项进阶"];
const equipments = ["无器械", "弹力带", "哑铃", "健身房", "单杠"];
const durations = ["10-20 分钟", "30-45 分钟", "60 分钟以上"];

function getScenario(key: ScenarioKey) {
  return scenarios.find((item) => item.key === key) ?? scenarios[0];
}

function getNode(id: string) {
  return abilityNodes.find((item) => item.id === id) ?? abilityNodes[0];
}

function getAbilityNodes(key: AbilityKey) {
  return abilityNodes.filter((item) => item.ability === key);
}

function getAbilityMeta(key: AbilityKey) {
  return abilityMeta.find((item) => item.key === key) ?? abilityMeta[0];
}

function statusText(status: NodeStatus) {
  const map: Record<NodeStatus, string> = {
    completed: "已点亮",
    current: "当前",
    available: "可训练",
    locked: "未解锁",
    risk: "风险",
  };
  return map[status];
}

export default function AbilityTreePrototypePage() {
  const [view, setView] = useState<ViewKey>("landing");
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [authMode, setAuthMode] = useState<AuthMode>("wechat");
  const [agreed, setAgreed] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [profileStep, setProfileStep] = useState(0);
  const [nickname, setNickname] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>(["体态健康"]);
  const [selectedParts, setSelectedParts] = useState<string[]>(["肩颈"]);
  const [selectedLevel, setSelectedLevel] = useState(levels[0]);
  const [selectedEquipment, setSelectedEquipment] = useState(equipments[0]);
  const [selectedDuration, setSelectedDuration] = useState(durations[0]);
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("starter");
  const [abilityKey, setAbilityKey] = useState<AbilityKey>("push");
  const [nodeId, setNodeId] = useState("push-wall");
  const [completedSets, setCompletedSets] = useState(0);
  const [pain, setPain] = useState(0);
  const [rpe, setRpe] = useState(6);
  const [showRisk, setShowRisk] = useState(false);
  const [litNodes, setLitNodes] = useState<string[]>(["pull-hang"]);

  const scenario = getScenario(scenarioKey);
  const node = getNode(nodeId);
  const ability = getAbilityMeta(abilityKey);
  const nodesForAbility = useMemo(() => getAbilityNodes(abilityKey), [abilityKey]);
  const profileDone = Boolean(nickname.trim());

  const goTab = (tab: TabKey) => {
    const map: Record<TabKey, ViewKey> = {
      today: "today",
      ability: "ability",
      coach: "coach",
      mine: "mine",
    };
    setActiveTab(tab);
    setView(map[tab]);
  };

  const applyScenario = (key: ScenarioKey) => {
    const next = getScenario(key);
    setScenarioKey(key);
    setAbilityKey(next.ability);
    setNodeId(next.nodeId);
    setCompletedSets(0);
    setPain(0);
    setRpe(key === "plateau" ? 8 : 6);
    setShowRisk(false);
  };

  const enterGuest = () => {
    setIsGuest(true);
    applyScenario("starter");
    goTab("today");
  };

  const completeAuth = () => {
    setIsGuest(false);
    setView("profile");
  };

  const finishProfile = () => {
    const nextScenario =
      selectedParts.includes("肩颈") || selectedParts.includes("腰腹")
        ? "posture"
        : selectedGoals.includes("专项提升") || selectedLevel.includes("6")
          ? "plateau"
          : "starter";
    applyScenario(nextScenario);
    setView("diagnosis");
  };

  const toggleList = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const selectAbility = (key: AbilityKey) => {
    const firstNode = getAbilityNodes(key)[0];
    setAbilityKey(key);
    setNodeId(firstNode?.id ?? nodeId);
    setActiveTab("ability");
    setView("ability");
  };

  const selectNode = (id: string) => {
    setNodeId(id);
    setActiveTab("ability");
    setView("node");
  };

  const finishSet = () => {
    setCompletedSets((current) => {
      const next = Math.min(3, current + 1);
      if (next === 3) {
        setLitNodes((items) => (items.includes(nodeId) ? items : [...items, nodeId]));
      }
      return next;
    });
  };

  const backFromHeader = () => {
    if (view === "profile") setView("login");
    else if (view === "diagnosis") setView("profile");
    else if (view === "node") goTab("ability");
    else if (view === "execution") goTab("today");
    else goTab("today");
  };

  return (
    <main className="prototype-stage">
      <section className="phone-shell" aria-label="CoachLink 小程序原型">
        {!["landing", "login", "register"].includes(view) && (
          <header className="app-header">
            <button className="icon-btn" type="button" onClick={backFromHeader} aria-label="返回">
              <ArrowLeft size={18} />
            </button>
            <div>
              <span>教链 CoachLink</span>
              <strong>{viewTitle(view)}</strong>
            </div>
            <button className="icon-btn" type="button" onClick={() => goTab("mine")} aria-label="我的">
              <Users size={18} />
            </button>
          </header>
        )}

        <section className={`screen ${["landing", "login", "register"].includes(view) ? "screen--auth" : ""}`}>
          {view === "landing" && (
            <AuthShell title="教链 CoachLink" subtitle="从注册资料到今日训练，把小白带进一条清晰成长路。">
              <section className="auth-card">
                <span className="card-kicker">完整新用户链路</span>
                <h1>先知道你是谁，再告诉你今天练什么</h1>
                <p>
                  这版原型会走完登录、注册、资料完善、起点诊断、今日训练、能力树、训练执行、教练承接和我的页。
                </p>
                <div className="auth-actions">
                  <button className="primary-btn" type="button" onClick={() => setView("login")}>
                    登录 / 微信快捷登录
                  </button>
                  <button className="secondary-btn" type="button" onClick={() => setView("register")}>
                    注册备用账号
                  </button>
                  <button className="text-btn" type="button" onClick={enterGuest}>
                    暂不登录，先逛逛
                  </button>
                </div>
              </section>
              <section className="mini-feature-grid">
                <Feature title="资料完善" desc="头像、昵称、目标、部位、条件" />
                <Feature title="起点诊断" desc="把问卷转成能力树路径" />
                <Feature title="今日训练" desc="只给一个主任务" />
                <Feature title="卡关升级" desc="视频点评和分层教练" />
              </section>
            </AuthShell>
          )}

          {view === "login" && (
            <AuthShell title="教链 CoachLink" subtitle="登录后保存训练记录、能力树进度和教练沟通。" onBack={() => setView("landing")}>
              <section className="auth-card auth-card--raised">
                <h1>登录</h1>
                <button className="browse-card" type="button" onClick={enterGuest}>
                  <strong>暂不登录，先逛逛</strong>
                  <span>先看内容和今日训练结构，保存资料时再登录。</span>
                </button>
                <div className="mode-switcher">
                  {[
                    ["wechat", "微信登录"],
                    ["password", "密码登录"],
                    ["code", "验证码"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={authMode === key ? "active" : ""}
                      type="button"
                      onClick={() => setAuthMode(key as AuthMode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {authMode === "wechat" ? (
                  <button className="primary-btn auth-main-btn" type="button" onClick={completeAuth} disabled={!agreed}>
                    手机号一键登录
                  </button>
                ) : (
                  <div className="form-stack">
                    <label className="input-row">
                      <span>{authMode === "password" ? "账号" : "手机"}</span>
                      <input placeholder={authMode === "password" ? "手机号 / 邮箱" : "输入手机号"} />
                    </label>
                    <label className="input-row">
                      <span>{authMode === "password" ? "密码" : "验证码"}</span>
                      <input placeholder={authMode === "password" ? "输入密码" : "6 位验证码"} />
                      {authMode === "code" && <button type="button">发送</button>}
                    </label>
                    <button className="primary-btn auth-main-btn" type="button" onClick={completeAuth}>
                      立即登录
                    </button>
                  </div>
                )}
                <Agreement checked={agreed} onToggle={() => setAgreed((value) => !value)} />
                <p className="auth-tip">
                  没有账号？<button type="button" onClick={() => setView("register")}>注册备用账号</button>
                </p>
              </section>
            </AuthShell>
          )}

          {view === "register" && (
            <AuthShell title="账号注册" subtitle="备用账号用于跨端登录；头像昵称放到资料完善里。" onBack={() => setView("landing")}>
              <section className="auth-card auth-card--raised">
                <h1>注册</h1>
                <p className="auth-desc">这里模拟现有小程序注册页：只创建账号，不在这里收集训练资料。</p>
                <div className="form-stack">
                  <label className="input-row">
                    <span>账号</span>
                    <input placeholder="手机号 / 邮箱" />
                  </label>
                  <label className="input-row">
                    <span>验证码</span>
                    <input placeholder="6 位验证码" />
                    <button type="button">发送</button>
                  </label>
                  <label className="input-row">
                    <span>密码</span>
                    <input placeholder="设置登录密码" />
                  </label>
                </div>
                <Agreement checked={agreed} onToggle={() => setAgreed((value) => !value)} />
                <button className="primary-btn auth-main-btn" type="button" onClick={completeAuth} disabled={!agreed}>
                  创建账号并完善资料
                </button>
                <p className="auth-tip">
                  已有账号？<button type="button" onClick={() => setView("login")}>去登录</button>
                </p>
              </section>
            </AuthShell>
          )}

          {view === "profile" && (
            <div className="onboarding-page">
              <StepDots current={profileStep} total={4} />
              {profileStep === 0 && (
                <ProfileStep title="先完善个人资料" desc="这一步对应现有资料完善：头像昵称由用户主动填写，不自动造默认昵称。">
                  <section className="profile-setup-card">
                    <button className="avatar-picker" type="button">
                      {nickname ? nickname.slice(0, 1) : "头像"}
                    </button>
                    <label className="nickname-shell">
                      <span>昵称</span>
                      <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="输入你的昵称" />
                    </label>
                  </section>
                  {!profileDone && <p className="field-error">昵称是进入个性化诊断前必须明确的一项。</p>}
                </ProfileStep>
              )}
              {profileStep === 1 && (
                <ProfileStep title="你的训练目标" desc="目标可以多选，但系统会先生成一个最清楚的本周主线。">
                  <ChipGrid values={goals} selected={selectedGoals} onToggle={(value) => toggleList(value, selectedGoals, setSelectedGoals)} />
                </ProfileStep>
              )}
              {profileStep === 2 && (
                <ProfileStep title="重点部位与风险" desc="保留原来的重点部位能力，但用于筛查和路径推荐，不让用户陷入复杂术语。">
                  <ChipGrid values={bodyParts} selected={selectedParts} onToggle={(value) => toggleList(value, selectedParts, setSelectedParts)} />
                  <section className="body-map-card">
                    <div className="body-map-body" aria-hidden="true">
                      <span />
                      <i />
                      <b />
                      <em />
                    </div>
                    <div>
                      <strong>动作前先看风险</strong>
                      <p>肩颈、腰腹、膝踝会优先进入恢复树或降级动作。</p>
                    </div>
                  </section>
                </ProfileStep>
              )}
              {profileStep === 3 && (
                <ProfileStep title="训练基础与条件" desc="不要问太多，先知道当前水平、器械和每次可训练时长。">
                  <Segment title="训练水平" values={levels} selected={selectedLevel} onSelect={setSelectedLevel} />
                  <Segment title="器械条件" values={equipments} selected={selectedEquipment} onSelect={setSelectedEquipment} />
                  <Segment title="每次时长" values={durations} selected={selectedDuration} onSelect={setSelectedDuration} />
                </ProfileStep>
              )}
              <footer className="onboarding-footer">
                <button className="secondary-btn" type="button" onClick={() => setProfileStep((step) => Math.max(0, step - 1))}>
                  上一步
                </button>
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => {
                    if (profileStep === 0 && !profileDone) return;
                    if (profileStep >= 3) finishProfile();
                    else setProfileStep((step) => step + 1);
                  }}
                >
                  {profileStep >= 3 ? "生成起点诊断" : "下一步"}
                </button>
              </footer>
            </div>
          )}

          {view === "diagnosis" && (
            <div className="content-stack diagnosis-page">
              <section className="white-card focus-card">
                <span className="card-kicker">AI 起点诊断</span>
                <h1>先给你一个能执行的答案</h1>
                <p>
                  目标：{selectedGoals.join("、") || "未选择"}；重点：{selectedParts.join("、") || "未选择"}；条件：
                  {selectedEquipment} / {selectedDuration}。
                </p>
              </section>
              <section className="white-card">
                <div className="card-head">
                  <span>推荐路径</span>
                  <strong>{scenario.level}</strong>
                </div>
                <div className="scenario-list">
                  {scenarios.map((item) => (
                    <button
                      key={item.key}
                      className={scenarioKey === item.key ? "active" : ""}
                      type="button"
                      onClick={() => applyScenario(item.key)}
                    >
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.subtitle}</span>
                      </div>
                      <small>{item.risk}风险</small>
                    </button>
                  ))}
                </div>
              </section>
              <section className="white-card">
                <div className="card-head">
                  <span>本周只做这 2 件事</span>
                  <strong>最小可行训练</strong>
                </div>
                <div className="task-checks">
                  <InfoLine icon={Target} title={node.title} text={node.mission} />
                  <InfoLine icon={BookOpen} title="今日知识卡" text="先学标准、常见错误和退阶动作" />
                </div>
              </section>
              <button className="primary-btn" type="button" onClick={() => goTab("today")}>
                进入今日训练
              </button>
            </div>
          )}

          {view === "today" && (
            <div className="today-page">
              <section className="dashboard-intro">
                <div>
                  <span>今天</span>
                  <h1>{isGuest ? "先逛逛也可以" : `${nickname || "训练者"}，今天练这个`}</h1>
                  <p>{scenario.level} / {ability.title} / {node.title}</p>
                </div>
                <button className="round-btn" type="button" onClick={() => goTab("mine")} aria-label="更多">
                  ···
                </button>
              </section>

              {isGuest && (
                <section className="guest-notice">
                  <strong>当前是游客浏览</strong>
                  <span>登录后可以保存资料、训练记录、能力树进度和教练沟通。</span>
                  <button type="button" onClick={() => setView("login")}>去登录</button>
                </section>
              )}

              <section className="daily-card">
                <div className="card-head">
                  <span>今日主任务</span>
                  <strong>{completedSets}/3 组</strong>
                </div>
                <div className="focus-panel">
                  <span>{node.mission}</span>
                  <h2>{node.title}</h2>
                  <p>{node.why}</p>
                  <button className="primary-btn" type="button" onClick={() => setView("execution")}>
                    开始今天训练
                    <Play size={17} />
                  </button>
                  <div className="inline-pills">
                    <button type="button" onClick={() => selectNode(node.id)}>动作标准</button>
                    <button type="button" onClick={() => setShowRisk(true)}>今天不舒服</button>
                    <button type="button" onClick={() => goTab("coach")}>找教练</button>
                  </div>
                </div>
              </section>

              {showRisk && (
                <section className="warning-card">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>先退阶，不硬顶</strong>
                    <span>{node.regression}</span>
                  </div>
                  <button type="button" onClick={() => goTab("coach")}>找人看</button>
                </section>
              )}

              <section className="white-card">
                <div className="card-head">
                  <span>本周路线</span>
                  <strong>{scenario.weekGoal}</strong>
                </div>
                <div className="week-road">
                  {["资料", "诊断", "今日", "执行", "复盘", "升级"].map((item, index) => (
                    <span key={item} className={index <= completedSets + 2 ? "done" : ""}>
                      {item}
                    </span>
                  ))}
                </div>
              </section>

              <section className="white-card content-card">
                <div className="card-head">
                  <span>今日知识</span>
                  <strong>高质量内容嵌入任务</strong>
                </div>
                <InfoLine icon={ShieldCheck} title="安全边界" text={node.safety} />
                <InfoLine icon={BookOpen} title="为什么练它" text={node.why} />
              </section>
            </div>
          )}

          {view === "ability" && (
            <div className="content-stack">
              <section className="white-card">
                <div className="card-head">
                  <span>能力树</span>
                  <strong>覆盖训练、体态、恢复、专项</strong>
                </div>
                <div className="ability-tabs">
                  {abilityMeta.map((item) => (
                    <button
                      key={item.key}
                      className={abilityKey === item.key ? "active" : ""}
                      type="button"
                      onClick={() => selectAbility(item.key)}
                    >
                      <strong>{item.short}</strong>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="tree-card">
                <span>{ability.title}</span>
                <h2>{ability.desc}</h2>
                <div className="node-rail">
                  {nodesForAbility.map((item) => {
                    const lit = litNodes.includes(item.id);
                    return (
                      <button key={item.id} className={`node-dot ${lit ? "completed" : item.status}`} type="button" onClick={() => selectNode(item.id)}>
                        {item.status === "locked" ? <Lock size={14} /> : lit ? <Check size={15} /> : item.level}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="node-list">
                {nodesForAbility.map((item) => {
                  const lit = litNodes.includes(item.id);
                  return (
                    <button key={item.id} className={`node-row ${lit ? "completed" : item.status}`} type="button" onClick={() => selectNode(item.id)}>
                      <span>{lit ? "已点亮" : statusText(item.status)}</span>
                      <div>
                        <strong>{item.level} · {item.title}</strong>
                        <small>{item.standard}</small>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </section>
            </div>
          )}

          {view === "node" && (
            <div className="content-stack">
              <section className="dark-card">
                <span>{ability.title} · {node.level}</span>
                <h1>{node.title}</h1>
                <p>{node.why}</p>
                <div className="status-pill">
                  <CircleDot size={15} />
                  {litNodes.includes(node.id) ? "已点亮" : statusText(node.status)}
                </div>
              </section>
              <section className="white-card info-list">
                <InfoLine icon={Trophy} title="通过标准" text={node.standard} />
                <InfoLine icon={RotateCcw} title="退阶动作" text={node.regression} />
                <InfoLine icon={Star} title="进阶方向" text={node.progression} />
                <InfoLine icon={ShieldCheck} title="安全边界" text={node.safety} />
                <InfoLine icon={BookOpen} title="内容承接" text={node.content} />
              </section>
              <section className="white-card">
                <div className="card-head">
                  <span>常见错误</span>
                  <strong>动作库变成节点标准</strong>
                </div>
                <div className="tag-row">
                  {node.mistakes.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </section>
              <div className="bottom-actions">
                <button className="primary-btn" type="button" onClick={() => setView("execution")}>
                  加入今日训练
                </button>
                <button className="secondary-btn" type="button" onClick={() => goTab("coach")}>
                  找教练看
                </button>
              </div>
            </div>
          )}

          {view === "execution" && (
            <div className="content-stack execution-page">
              <section className="video-card">
                <div className="body-lines" aria-hidden="true">
                  <span />
                  <i />
                  <b />
                  <em />
                </div>
                <strong>{node.title} 示范 / 上传点评位</strong>
                <p>承接动作库视频、训练上传、AI 标注和教练点评。</p>
              </section>
              <section className="white-card">
                <div className="card-head">
                  <span>训练执行</span>
                  <strong>{completedSets}/3</strong>
                </div>
                <div className="set-stack">
                  {[1, 2, 3].map((set) => (
                    <div className={`set-row ${completedSets >= set ? "done" : ""}`} key={set}>
                      <div>
                        <strong>第 {set} 组</strong>
                        <span>{node.mission}</span>
                      </div>
                      <button type="button" onClick={finishSet}>{completedSets >= set ? "完成" : "打卡"}</button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="white-card feedback">
                <label>
                  疼痛 {pain}/10
                  <input type="range" min="0" max="10" value={pain} onChange={(event) => setPain(Number(event.target.value))} />
                </label>
                <label>
                  RPE {rpe}/10
                  <input type="range" min="1" max="10" value={rpe} onChange={(event) => setRpe(Number(event.target.value))} />
                </label>
              </section>
              {completedSets >= 3 ? (
                <section className={`finish-card ${pain >= 5 || rpe >= 9 ? "risk" : ""}`}>
                  <Trophy size={24} />
                  <h2>{pain >= 5 || rpe >= 9 ? "完成，但建议退阶" : "今日完成，节点进度 +1"}</h2>
                  <p>
                    {pain >= 5 || rpe >= 9
                      ? "疼痛或强度偏高，下次降低难度，并建议找教练看动作。"
                      : "连续两次稳定完成后，会解锁下一个节点。"}
                  </p>
                  <button type="button" onClick={pain >= 5 || rpe >= 9 ? () => goTab("coach") : () => goTab("ability")}>
                    {pain >= 5 || rpe >= 9 ? "找人帮我看" : "查看点亮结果"}
                  </button>
                </section>
              ) : (
                <button className="primary-btn" type="button" onClick={finishSet}>
                  完成下一组
                </button>
              )}
            </div>
          )}

          {view === "coach" && (
            <div className="content-stack">
              <section className="dark-card">
                <UserRoundCheck size={28} />
                <h1>卡住时，再找合适的人帮你</h1>
                <p>教练发现不是首屏卖课，而是从动作失败、疼痛风险、平台期和视频点评自然进入。</p>
              </section>
              <section className="coach-match-list">
                {[
                  ["训练搭子", "怕练错、坚持困难、需要监督", "陪练打卡 + 每周轻反馈"],
                  ["进阶教练", "动作不标准、练了没效果、计划迷茫", "视频点评 + 计划调整"],
                  ["专业教练", "疼痛风险、伤病友好、专项周期", "风险筛查 + 深度指导"],
                ].map(([title, desc, service]) => (
                  <button key={title} type="button">
                    <UserRoundCheck size={22} />
                    <div>
                      <strong>{title}</strong>
                      <span>{desc}</span>
                      <small>{service}</small>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </section>
              <section className="service-actions">
                <button type="button">
                  <MessageCircle size={17} />
                  私信教练
                </button>
                <button type="button">
                  <Video size={17} />
                  上传视频点评
                </button>
              </section>
            </div>
          )}

          {view === "mine" && (
            <div className="content-stack">
              <section className="profile-card">
                <div className="avatar">{isGuest ? "游" : nickname ? nickname.slice(0, 1) : "CL"}</div>
                <div>
                  <h1>{isGuest ? "游客用户" : nickname || "未填写昵称"}</h1>
                  <p>{isGuest ? "登录后保存训练数据" : `${scenario.level} · 已点亮 ${litNodes.length} 个节点`}</p>
                </div>
              </section>
              {isGuest && (
                <section className="guest-notice">
                  <strong>你还没有登录</strong>
                  <span>登录后可保存资料、训练记录和教练沟通。</span>
                  <button type="button" onClick={() => setView("login")}>去登录</button>
                </section>
              )}
              <section className="stats-row">
                <div>
                  <strong>2</strong>
                  <span>本周训练</span>
                </div>
                <div>
                  <strong>{litNodes.length}</strong>
                  <span>点亮节点</span>
                </div>
                <div>
                  <strong>{pain >= 5 ? "中" : "低"}</strong>
                  <span>风险</span>
                </div>
              </section>
              <section className="menu-list">
                {[
                  ["训练记录", "历史完成度和复盘"],
                  ["我的计划", "教练计划 / 自建计划"],
                  ["我的动作库", "收藏、替换、动作标准"],
                  ["知识卡片", "节点内容、饮食原则、常见问题"],
                  ["工具箱", "计算器、街健、排行榜后置"],
                  ["好友与消息", "伙伴圈、私信、提醒"],
                  ["会员", "商业权益，不抢主线"],
                ].map(([title, desc]) => (
                  <button key={title} type="button">
                    <div>
                      <strong>{title}</strong>
                      <span>{desc}</span>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </section>
            </div>
          )}
        </section>

        {!["landing", "login", "register", "profile", "diagnosis"].includes(view) && (
          <nav className="tabbar" aria-label="底部导航">
            <TabButton active={activeTab === "today"} icon={Home} label="今日" onClick={() => goTab("today")} />
            <TabButton active={activeTab === "ability"} icon={Dumbbell} label="能力" onClick={() => goTab("ability")} />
            <TabButton active={activeTab === "coach"} icon={UserRoundCheck} label="教练" onClick={() => goTab("coach")} />
            <TabButton active={activeTab === "mine"} icon={Users} label="我的" onClick={() => goTab("mine")} />
          </nav>
        )}
      </section>
    </main>
  );
}

function viewTitle(view: ViewKey) {
  const map: Record<ViewKey, string> = {
    landing: "入口",
    login: "登录",
    register: "注册",
    profile: "资料完善",
    diagnosis: "起点诊断",
    today: "今日训练",
    ability: "能力树",
    node: "节点详情",
    execution: "训练执行",
    coach: "教练支持",
    mine: "我的",
  };
  return map[view];
}

function AuthShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <section className="login-hero">
        {onBack && (
          <button className="back-pill" type="button" onClick={onBack}>
            <ArrowLeft size={17} />
            返回
          </button>
        )}
        <div className="hero-mark">
          <HeartPulse size={36} />
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </section>
      {children}
    </div>
  );
}

function Agreement({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button className="agreement-row" type="button" onClick={onToggle}>
      <span className={checked ? "checked" : ""}>{checked && <Check size={13} />}</span>
      <small>我已阅读并同意《用户协议》和《隐私政策》</small>
    </button>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <strong>{title}</strong>
      <span>{desc}</span>
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-dots">
      {Array.from({ length: total }).map((_, index) => (
        <span key={index} className={index === current ? "active" : ""} />
      ))}
    </div>
  );
}

function ProfileStep({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <>
      <h1 className="onboarding-title">{title}</h1>
      <p className="onboarding-desc">{desc}</p>
      <div className="step-content">{children}</div>
    </>
  );
}

function ChipGrid({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="chip-grid">
      {values.map((value) => (
        <button key={value} className={selected.includes(value) ? "active" : ""} type="button" onClick={() => onToggle(value)}>
          {value}
        </button>
      ))}
    </div>
  );
}

function Segment({
  title,
  values,
  selected,
  onSelect,
}: {
  title: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <section className="segment">
      <span>{title}</span>
      <div>
        {values.map((value) => (
          <button key={value} className={selected === value ? "active" : ""} type="button" onClick={() => onSelect(value)}>
            {value}
          </button>
        ))}
      </div>
    </section>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      <Icon size={19} />
      <span>{label}</span>
    </button>
  );
}

function InfoLine({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="info-line">
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
