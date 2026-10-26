/**
 * 薄肌检测器「身材最像谁」的人物名单（男性）。运营配置，改名单、改描述只改这里。
 *
 * target 是三项档位：腹肌清晰度、肩腰比（倒三角）、上臂粗细。
 * 0 是线上用户的中位水平，每 ±1 约等于一个四分位距；取值为 -1.5 到 1.5、步长 0.5。
 * 档位是按公开形象估的风格定位，不是对本人照片的测量；每位人物的组合两两不同。
 */

export type BojiLookalikeGroup = 'lean' | 'athlete' | 'muscle';

export interface BojiLookalikeTarget {
  abs: number;
  vTaper: number;
  arms: number;
}

export interface BojiLookalike {
  key: string;
  name: string;
  group: BojiLookalikeGroup;
  /** 一句话身材描述，显示在名字下面 */
  tagline: string;
  target: BojiLookalikeTarget;
}

export const BOJI_LOOKALIKE_GROUP_LABELS: Record<BojiLookalikeGroup, string> = {
  lean: '精瘦线条型',
  athlete: '运动员型',
  muscle: '大肌肉型',
};

function p(key: string, name: string, group: BojiLookalikeGroup, tagline: string, abs: number, vTaper: number, arms: number): BojiLookalike {
  return { key, name, group, tagline, target: { abs, vTaper, arms } };
}

export const BOJI_LOOKALIKES: BojiLookalike[] = [
  // 精瘦线条：手臂偏细到中等
  p('bruce_lee', '李小龙', 'lean', '低围度、高线条，精瘦格斗型', 1.5, 0.5, -1),
  p('brad_pitt', '布拉德·皮特', 'lean', '《搏击俱乐部》时期，腹肌清楚、整体精瘦', 1.5, -0.5, -1),
  p('bai_jingting', '白敬亭', 'lean', '宽肩窄腰，穿衣显瘦脱衣有肉', -0.5, 1, -1),
  p('tom_holland', '汤姆·赫兰德', 'lean', '灵活精干，体操运动感', 0.5, -0.5, 0),
  p('beckham', '贝克汉姆', 'lean', '流线型足球运动员身材，围度适中', 0.5, 0, -1),
  p('jackson_wang', '王嘉尔', 'lean', '偏精壮，舞台感强', 0.5, 0.5, 0),
  p('jackson_yee', '易烊千玺', 'lean', '清瘦挺拔，少年感的薄肌', 0, -0.5, -1.5),
  p('wang_yibo', '王一博', 'lean', '舞者体型，线条利落', 0.5, 0, -1.5),
  p('conor_mcgregor', '康纳·麦格雷戈', 'lean', '轻量级格斗家，干练有棱角', 1, 0, -0.5),
  p('donnie_yen', '甄子丹', 'lean', '功夫片里的紧实线条', 1, -1, -0.5),
  p('keanu_reeves', '基努·里维斯', 'lean', '修长松弛，耐看型身材', -0.5, -0.5, -0.5),
  p('su_bingtian', '苏炳添', 'lean', '短跑运动员的紧凑爆发型', 0.5, 0.5, -0.5),
  p('liu_xiang', '刘翔', 'lean', '跨栏运动员的修长比例', 0, 0, -0.5),
  p('timothee_chalamet', '提莫西·查拉梅', 'lean', '纤长少年感，衣架子身材', -1, -0.5, -1.5),
  p('federer', '费德勒', 'lean', '网球运动员的修长匀称', -1.5, -0.5, -0.5),
  p('messi', '梅西', 'lean', '矮小精悍，重心低、爆发强', -1, -1, -1),
  p('tony_leung', '梁朝伟', 'lean', '斯文清瘦，气质型', -1.5, -1, -1),
  p('hu_bing', '胡兵', 'lean', '模特出身，比例匀称', 0, 0, 0),

  // 运动员和动作明星
  p('usain_bolt', '尤塞恩·博尔特', 'athlete', '修长爆发，短跑运动员风格', -0.5, 0.5, -1),
  p('cristiano_ronaldo', 'C罗', 'athlete', '腹部线条和全身肌肉都很均衡', 1.5, 1, 0.5),
  p('michael_phelps', '迈克尔·菲尔普斯', 'athlete', '肩背发达，游泳运动员倒三角', -0.5, 1.5, 0),
  p('sun_yang', '孙杨', 'athlete', '长臂宽肩，典型自由泳体型', -1, 1.5, -0.5),
  p('eddie_peng', '彭于晏', 'athlete', '《激战》时期的精壮格斗身材', 1, 0.5, 0.5),
  p('wu_lei', '吴磊', 'athlete', '青年运动型，紧致偏精瘦', -1, -1, -1.5),
  p('mike_tyson', '迈克·泰森', 'athlete', '厚实有力的拳击体型', -1, 0.5, 1.5),
  p('nadal', '纳达尔', 'athlete', '红土之王，手臂粗壮', 0, 0, 1),
  p('neymar', '内马尔', 'athlete', '灵巧型前锋，偏瘦有线条', 0, -1, -1),
  p('lebron_james', '勒布朗·詹姆斯', 'athlete', '高大厚实，篮球场上的坦克', -0.5, 1, 1),
  p('michael_b_jordan', '迈克尔·B·乔丹', 'athlete', '《奎迪》拳击手，腹肌和肩线都清楚', 1, 1, 0.5),
  p('jake_gyllenhaal', '杰克·吉伦哈尔', 'athlete', '《绝世拳王》里的干练拳手', 1, 0, 0),
  p('zac_efron', '扎克·埃夫隆', 'athlete', '《海滩救护队》，腹肌刻得很深', 1.5, 0.5, 0.5),
  p('wu_jing', '吴京', 'athlete', '武打出身，结实耐打', 0, 0.5, 0.5),
  p('zhang_jin', '张晋', 'athlete', '武术冠军体型，紧实灵活', 1, -0.5, 0),
  p('zou_kai', '邹凯', 'athlete', '体操冠军，上肢力量惊人', 0.5, 1, 1.5),
  p('tyson_fury', '泰森·富里', 'athlete', '重量级拳王的大骨架', -1.5, 0.5, 1),
  p('luka_doncic', '卢卡·东契奇', 'athlete', '壮实型球星，靠力量和节奏', -1.5, -1, 0),
  p('ma_long', '马龙', 'athlete', '乒乓球冠军的均衡体型', -1, 0, 0),

  // 国内运动员和武打演员（2026-10-26 补充）
  p('ning_zetao', '宁泽涛', 'athlete', '游泳名将，腹肌和肩线都很漂亮', 1, 0.5, 0),
  p('zhang_jike', '张继科', 'athlete', '乒乓球大满贯，精干紧实', 0.5, 0, 0),
  p('lin_dan', '林丹', 'athlete', '羽毛球超级全满贯，匀称有爆发力', 0.5, -0.5, -0.5),
  p('li_ning', '李宁', 'athlete', '体操王子，挺拔的倒三角', 0, 1, 0),
  p('li_xiaopeng', '李小鹏', 'athlete', '体操冠军，上肢发达', 0.5, 0, 1),
  p('zou_shiming', '邹市明', 'athlete', '奥运拳击冠军，轻量级的紧实', 0.5, -0.5, 0.5),
  p('yi_jianlian', '易建联', 'athlete', '高大舒展的篮球体型', -0.5, 0.5, 0.5),
  p('wu_lei_football', '武磊', 'athlete', '前锋的灵活结实', 0, -0.5, 0),
  p('yao_ming', '姚明', 'athlete', '大骨架的篮球巨人', -0.5, -0.5, 0),
  p('jet_li', '李连杰', 'athlete', '武术冠军出身，灵巧紧凑', 0.5, 0, -0.5),
  p('jackie_chan', '成龙', 'athlete', '动作片里的耐打体型', -0.5, 0, 0),
  p('vincent_zhao', '赵文卓', 'athlete', '挺拔的武打小生', 0, 0.5, -0.5),
  p('sammo_hung', '洪金宝', 'athlete', '身手敏捷的大块头', -1, 0, 0.5),
  p('daniel_wu', '吴彦祖', 'athlete', '常年自律的紧实线条', 1, 0, 0.5),

  // 大肌肉和健身圈
  p('chris_heria', 'Chris Heria', 'muscle', '街头健身，腹肌明显、上肢发达', 1, 0.5, 1.5),
  p('david_laid', 'David Laid', 'muscle', '健身审美型，宽肩窄腰', 0.5, 1.5, 0.5),
  p('cbum', 'CBum', 'muscle', '古典健美，极强的 X 型比例', 0, 1.5, 1),
  p('ronnie_coleman', '罗尼·库尔曼', 'muscle', '巨兽级健美体型', -1, 1, 1.5),
  p('arnold', '阿诺·施瓦辛格', 'muscle', '经典健美，胸臂发达', 0.5, 1.5, 1.5),
  p('henry_cavill', '亨利·卡维尔', 'muscle', '超级英雄电影里的厚实肌肉', 0, 0.5, 1),
  p('chris_hemsworth', '克里斯·海姆斯沃斯', 'muscle', '胸肩臂突出的大肌肉电影体型', 0, 0, 1.5),
  p('dwayne_johnson', '道恩·强森', 'muscle', '巨石般的厚度和围度', -0.5, 0.5, 1.5),
  p('chris_evans', '克里斯·埃文斯', 'muscle', '美国队长式的饱满上半身', 0.5, 1, 1),
  p('hugh_jackman', '休·杰克曼', 'muscle', '金刚狼时期，干且壮', 1, 0.5, 1),
  p('jason_statham', '杰森·斯坦森', 'muscle', '硬汉动作片的紧实肌肉', 0.5, 0, 0.5),
  p('mark_wahlberg', '马克·沃尔伯格', 'muscle', '自律型硬汉，肩臂结实', 0.5, 0.5, 1),
  p('stallone', '史泰龙', 'muscle', '《第一滴血》式的爆炸手臂', 0.5, 0.5, 1.5),
  p('jeff_seid', 'Jeff Seid', 'muscle', '健美比赛里的高线条型', 1.5, 1, 1),
  p('frank_zane', '弗兰克·赞恩', 'muscle', '古典健美的完美比例', 1.5, 1.5, 0.5),
  p('wu_yan', '吴龑', 'muscle', '中国职业健美选手，全面饱满', 1, 1, 1),
  p('tom_hardy', '汤姆·哈迪', 'muscle', '粗犷的力量型身材', -1, 0, 1),
  p('frank_medrano', 'Frank Medrano', 'muscle', '纯素街健，干到见筋', 1.5, 0, 0.5),
  p('hannibal_for_king', 'Hannibal for King', 'muscle', '街健元老，宽背厚肩', 0, 1, 0.5),
  p('huang_jingyu', '黄景瑜', 'muscle', '军人气质，肩宽背厚', 0, 0.5, 0),
];
