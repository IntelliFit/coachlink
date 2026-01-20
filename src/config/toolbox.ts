export type ToolboxLink = {
  /**
   * Stable id for analytics / future AB tests / sorting.
   */
  key: string;
  /**
   * Display name in the student avatar dropdown.
   */
  label: string;
  /**
   * Short description shown on the toolbox page.
   */
  description?: string;
  /**
   * External URL to open.
   */
  url: string;
  /**
   * PrimeIcons className (e.g. "pi pi-calculator").
   */
  icon?: string;
};

/**
 * Student-side "Toolbox" links shown under the avatar dropdown.
 *
 * Replace the placeholder URLs with your real tool URLs.
 */
export const STUDENT_TOOLBOX_LINKS: ToolboxLink[] = [
  {
    key: 'strength-calculator',
    label: '力量计算器（极限/做组/水平评估）',
    description: '算负重引体/臂屈伸/三大项/弯举的极限与做组重量，并判断你是菜鸡还是大神。',
    url: 'https://pullupindex.top/calculator/',
    icon: 'pi pi-calculator',
  },
  {
    key: 'bar-locations',
    label: '寻找单杠（地图）',
    description: '查看全国单杠位置分享，帮你快速找到附近训练场地，也可以上传你发现的点。',
    url: 'https://pullupindex.top/locations/',
    icon: 'pi pi-map',
  },
  {
    key: 'community-data',
    label: '社区数据（查看/提交）',
    description: '查看中国街举社区力量数据，并提交你的负重引体/臂屈伸数据参与共建。',
    url: 'https://pullupindex.top/data/',
    icon: 'pi pi-database',
  },
];

