/**
 * 开发环境测试账号，仅用于本地/开发环境快速登录
 * 生产构建时不会暴露（通过 NODE_ENV 判断）
 */
export interface DevUser {
  name: string;
  phone: string;
  password: string;
}

export const DEV_USERS: DevUser[] = [
  { name: "教练(枭马葛助理)", phone: "18115072586", password: "123456" },
  { name: "学员(沈妈妈)", phone: "13921064643", password: "123456" },
  { name: "管理员(小马哥)", phone: "13915850621", password: "123456" },
  { name: "教练(刘三乐)", phone: "17633133621", password: "123456" },
];
