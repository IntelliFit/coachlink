/**
 * 图标库配置
 * 
 * 本项目默认使用 Lucide React 作为图标组件库
 * 如需更换图标库，请修改此文件和相关组件
 */

// 默认图标库
export const ICON_LIBRARY = 'lucide-react' as const

// 图标库版本
export const ICON_LIBRARY_VERSION = 'latest' as const

// 备选图标库（如需要）
export const ICON_ALTERNATIVES = {
  nutui: '@nutui/icons-react-taro', // NutUI 官方图标（已安装）
  lucide: 'lucide-react', // Lucide React（当前使用）
} as const

/**
 * 常用图标名称映射（方便使用）
 * 这些是项目中常用的图标，可以直接导入使用
 */
export const COMMON_ICONS = {
  // 导航相关
  home: 'Home',
  search: 'Search',
  user: 'User',
  settings: 'Settings',
  menu: 'Menu',
  
  // 操作相关
  plus: 'Plus',
  minus: 'Minus',
  edit: 'Edit',
  delete: 'Trash2',
  save: 'Save',
  cancel: 'X',
  check: 'Check',
  
  // 状态相关
  loading: 'Loader2',
  success: 'CheckCircle',
  error: 'XCircle',
  warning: 'AlertCircle',
  info: 'Info',
  
  // 方向相关
  arrowLeft: 'ArrowLeft',
  arrowRight: 'ArrowRight',
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
  chevronLeft: 'ChevronLeft',
  chevronRight: 'ChevronRight',
  
  // 其他常用
  heart: 'Heart',
  star: 'Star',
  share: 'Share2',
  download: 'Download',
  upload: 'Upload',
  calendar: 'Calendar',
  clock: 'Clock',
  image: 'Image',
  video: 'Video',
} as const

/**
 * 注意：不要 export * from 'lucide-react'
 * 这会导致整个图标库被打包，显著增加包体积。
 * 请直接从 'lucide-react' 按需导入所需图标。
 * 使用方式：
 * import { Home, Search } from 'lucide-react'
 */
