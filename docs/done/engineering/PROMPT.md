## 前端部分

当前是一个 App Route 模式的 nextjs 项目。使用 primereact 作为UI框架，使用
tailwindcss 作为 atom css 框架。黑白主题系统 primereact
已经实现好了，不需要额外实现，除非你认为 primereact 没有涵盖这部分的定义。
对于生成或者修改组件，请尽量使用 primereact
提供的组件完成。UI实现要美观大方，UI组件之间保持一定的间距。如果你想要定义彩色，请尽量使用
tailwindcss 的 primary 类的 css class 定义彩色，这样可以尽量符合颜色系统。

背景颜色不能使用 `text-gray`，而是必须使用 `text-surface`。

所有前端发起的网络请求，请通过 `@/app/service`
来实现。你需要先检查这个文件夹中是否存在已经实现好的业务。业务和 `@/app/api`
中的服务是一一对应的。

每一个 service 成员函数需要严格遵守如下格式：

```typescript
async publishContent(reqData: PublishContentDto) {
    const res = await this.post<PublishContentResponseDto>('publish-content', reqData);
    if (res.data && res.data.success) {
        return res.data.data || null;
    }
}
```

鉴权通过 NextAuth 的 getSession() 方法获取用户信息
具体请看例子：src/app/service/coachService.ts

如果前端出现了 supabase 势力进行数据库访问，你应该把这部分迁移到后端中，并在
@/app/service 中的相关函数写入对应的 API 访问并通过访问替代当前的前端直接询问
supabase

- 如果前端代码出现了 setError 或者 setMessage 的函数，则替换为 toast
  函数来向用户发出提醒。
- loading 为 true 部分的组件替换为 primereact 的骨架屏。
- 所有改动都需要适配移动端。

---

## 后端部分

我现在有如下的一个 POST 函数代码

请根据我后续的要求，把最对应的其他请求转换为和上面的风格、代码依赖一致的 nextjs
POST 代码，重点：

1. 使用 NextResponse 返回 JSON。（内容严格为 success,message,data）
2. 依赖统一：import supabase from '@/lib/supabaseClient' import {
   getServerSession } from '../../auth/[...nextauth]/auth'
3. 接口里面应该尽量不要设置 userId，因为可以通过 getServerSession() 方法获取
   session，通过 session.user 或者 session.profile 来获取用户信息。

除此之外，你还需要根据接口理解，在对应文件夹下生成对应的 entity 文件，并以 type
形式导入。entity 文件往往以接口文件夹的名字设置如下两个接口：

```typescript
// 请求参数的接口类型
export interface GetUserProfileDto {}
// 返回参数的接口类型
export interface GetUserProfileResponseDto {}
```

然后你必须在 route.ts 文件中使用上面两个类型，一个事例如下：

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    UpdatePersonalRecordsDto,
    UpdatePersonalRecordsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    const {
        exercises,
    } = await req.json() as UpdatePersonalRecordsDto;

    // 更新个人记录
    // 具体的访问数据库的操作
    // ... code ...

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdatePersonalRecordsResponseDto>>({
        success: true,
        message: "个人记录更新成功",
        // UpdatePersonalRecordsResponseDto 反应的就是这个地方 data 的数据结构
        data: null,
    });
}
```

### 权限获取

你可以通过如下的代码获取身份信息

```typescript
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // session.user.id 为用户 ID (users表主键)
    // session.user.is_admin 为用户是否是管理员
    // session.user.is_coach 为用户是否是教练

    // ⚠️ 重点注意：
    // 如果你是教练，session.user.id 是 users 表的 ID，不是 coaches 表的 ID。
    // 如果你需要查询 coach_subscriptions 等关联了 coaches 表的表，
    // 你必须先用 session.user.id 去 coaches 表查询对应的 id：
    // SELECT id FROM coaches WHERE user_id = session.user.id
}
```

新建立表RLS一定要关闭。

---

## 高频复发 Bug 防线（开发前必看）

为避免同类问题反复出现，开始改动前请先快速阅读：

- `docs/done/engineering/高频复发Bug清单.md`
- `docs/done/engineering/代码检查清单.md`

尤其是前端列表/表单编辑场景，必须先统一“索引语义”：

- `dayIndex`（业务序号，通常从 1 开始）
- `arrayIndex`（数组下标，始终从 0 开始）

在同一条数据修改链路（新增/删除/更新）里，不允许混用这两种索引语义。

---

## 测试文件修改约定

- 非用户明确要求时，不要随意改动测试文件；细则见仓库根目录 `AGENTS.md`「测试文件修改边界」。

---

## Git 提交规范（Windows 环境必读）

### 中文 Commit 信息乱码问题

在 Windows PowerShell 中直接使用 `git commit -m "中文信息"` 会导致 GitHub 上显示乱码。

**❌ 错误方式：**
```powershell
git commit -m "feat: 新增功能"
# GitHub 显示为乱码：feat: 鏂板姛鑳�
```

**✅ 正确方式（使用文件）：**
```powershell
# 1. 先用编辑器/代码创建 UTF-8 编码的文件
# 文件内容：feat: 新增功能

# 2. 使用 -F 参数提交
git commit -F commit_msg.txt

# 3. 提交后删除临时文件
Remove-Item commit_msg.txt
```

**✅ 或者配置 Git 编码（一次性设置）：**
```powershell
git config --global i18n.commitEncoding utf-8
git config --global i18n.logOutputEncoding utf-8
```

### Commit 信息格式

遵循 Conventional Commits 规范：

```
<type>: <简短描述>

<详细描述（可选）>
```

常用 type：
- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 重构
- `chore`: 杂项（构建、配置等）
- `docs`: 文档
- `style`: 样式调整
- `perf`: 性能优化

### 分支管理规范

1. **开发流程**：先提交到 `dev`，测试通过后再合并到 `main`
2. **双向同步**：如果直接提交到了 `main`，需要双向合并保持同步：
   ```powershell
   # 1. main 合并到 dev
   git checkout dev
   git merge main -m "merge: 同步main到dev"
   git push origin dev
   
   # 2. dev 合并回 main（如果 dev 有独立提交）
   git checkout main
   git merge dev -m "merge: 同步dev到main"
   git push origin main
   ```

### CI / Node 版本（简记）

- 本项目含 **`isolated-vm` 等原生依赖**时，**Node 版本须与 `package.json` 的 `engines` 及 GitHub Actions / Dockerfile 对齐**（当前要求 **≥22**）；Alpine 构建需保证 builder 有编译链。详见 `docs/done/engineering/高频复发Bug清单.md` 第 18 条与 `代码检查清单.md` 中「CI / 构建环境」。