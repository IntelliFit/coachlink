/**
 * 薄肌检测器女性档「身材最像谁」的人物名单。运营配置，改名单、改描述只改这里。
 *
 * target 是三项档位：马甲线清晰度、腰臀曲线（腰臀比越小档位越高）、肩腰比。
 * 0 是参考中位水平，每 ±1 约等于一个四分位距；取值为 -1.5 到 1.5、步长 0.5。
 * 档位是按公开形象估的风格定位，不是对本人照片的测量；每位人物的组合两两不同。
 * 名单里放了几位清瘦型男明星（曲线档 -1.5），身材偏直线条的女生也有人可匹配。
 * 2026-10-26 首版，待运营确认。
 */

export type BojiFemaleLookalikeGroup = 'lean' | 'athlete' | 'curvy';

export interface BojiFemaleLookalikeTarget {
  abs: number;
  curve: number;
  vTaper: number;
}

export interface BojiFemaleLookalike {
  key: string;
  name: string;
  group: BojiFemaleLookalikeGroup;
  /** 一句话身材描述，显示在名字下面 */
  tagline: string;
  target: BojiFemaleLookalikeTarget;
}

export const BOJI_FEMALE_LOOKALIKE_GROUP_LABELS: Record<BojiFemaleLookalikeGroup, string> = {
  lean: '精瘦线条型',
  athlete: '运动员型',
  curvy: '曲线型',
};

function p(
  key: string,
  name: string,
  group: BojiFemaleLookalikeGroup,
  tagline: string,
  abs: number,
  curve: number,
  vTaper: number,
): BojiFemaleLookalike {
  return { key, name, group, tagline, target: { abs, curve, vTaper } };
}

export const BOJI_FEMALE_LOOKALIKES: BojiFemaleLookalike[] = [
  // 精瘦线条：马甲线清楚或纤细修长
  p('pamela_reif', '帕梅拉', 'lean', '马甲线清楚、整体紧致的健身博主身材', 1, 0, 0),
  p('chloe_ting', 'Chloe Ting', 'lean', '居家训练练出来的紧致腰腹', 0.5, 0, -0.5),
  p('wang_wanfei', '王婉霏', 'lean', '跳操练出的匀称线条', 1, 0.5, 0),
  p('jin_chen', '金晨', 'lean', '马甲线出名，紧实又有力量感', 1, 0.5, 0.5),
  p('victoria_song', '宋茜', 'lean', '舞者出身，腰腹线条利落', 0.5, 0, 0.5),
  p('joe_chen', '张钧甯', 'lean', '常年健身，腹部线条清楚', 1.5, 0, 0.5),
  p('ni_ni', '倪妮', 'lean', '直角肩、高挑修长', 0, 0, 1),
  p('liu_wen', '刘雯', 'lean', '超模身材，修长平直', -0.5, -1, 0),
  p('liu_yifei', '刘亦菲', 'lean', '纤细匀称，古典身材', -1, 0, -1),
  p('lin_chiling', '林志玲', 'lean', '高挑纤细，腰身柔和', -1, 0.5, -0.5),
  p('chris_lee', '李宇春', 'lean', '中性清瘦，线条干净', -0.5, -1.5, 0.5),

  // 运动员和动作明星
  p('eileen_gu', '谷爱凌', 'athlete', '滑雪运动员的力量型紧实身材', 0, -0.5, 0.5),
  p('zhu_ting', '朱婷', 'athlete', '排球运动员的修长匀称身材', -0.5, -1, 1),
  p('simone_biles', '西蒙·拜尔斯', 'athlete', '体操运动员，腹部线条极其清楚', 1.5, -0.5, 1.5),
  p('serena_williams', '小威廉姆斯', 'athlete', '网球运动员的力量型身材', 0.5, 1, 1.5),
  p('li_na', '李娜', 'athlete', '网球运动员的结实匀称', 0, -0.5, 1),
  p('zheng_qinwen', '郑钦文', 'athlete', '网球新星，高挑有力', 0, 0, 0.5),
  p('zhang_weili', '张伟丽', 'athlete', 'UFC 冠军的紧实爆发型', 1.5, -0.5, 1),
  p('gong_lijiao', '巩立姣', 'athlete', '铅球运动员的力量型身材', -1.5, -0.5, 1),
  p('gal_gadot', '盖尔·加朵', 'athlete', '《神奇女侠》里修长有力的身材', 0.5, 0.5, 0.5),
  p('michelle_yeoh', '杨紫琼', 'athlete', '动作片里的紧致干练', 0.5, -0.5, 0),
  p('ronda_rousey', '朗达·罗西', 'athlete', '格斗选手的结实线条', 1, -1, 1),

  // 曲线型
  p('scarlett_johansson', '斯嘉丽·约翰逊', 'curvy', '《黑寡妇》里紧致又有曲线', 0, 1.5, 0),
  p('beyonce', '碧昂丝', 'curvy', '舞台上有力量感的曲线身材', -0.5, 1.5, 0.5),
  p('kim_kardashian', '金·卡戴珊', 'curvy', '曲线非常明显的沙漏型', -1, 1.5, -0.5),
  p('jennifer_lopez', '詹妮弗·洛佩兹', 'curvy', '常年跳舞健身的紧致沙漏型', 0.5, 1.5, 0),
  p('dilraba', '迪丽热巴', 'curvy', '腰细、曲线柔和', 0, 1, 0),
  p('gulnazar', '古力娜扎', 'curvy', '纤细中带曲线', -0.5, 1, -0.5),
  p('angelina_jolie', '安吉丽娜·朱莉', 'curvy', '《古墓丽影》里的修长曲线', -0.5, 0.5, 0),

  // 清瘦型男明星：腰臀曲线最平直的一端
  p('jackson_yee', '易烊千玺', 'lean', '清瘦挺拔的少年感薄肌（男明星）', 0, -1.5, -0.5),
  p('wang_yibo', '王一博', 'lean', '舞者体型，线条利落（男明星）', 0.5, -1.5, 0),
  p('eddie_peng', '彭于晏', 'athlete', '精壮格斗身材，腹肌清楚（男明星）', 1.5, -1.5, 1),
  p('tony_leung', '梁朝伟', 'lean', '斯文清瘦，气质型（男明星）', -1.5, -1.5, -1),
];
