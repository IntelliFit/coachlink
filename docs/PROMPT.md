## 前端部分

当前是一个 App Route 模式的 nextjs 项目。使用 primereact 作为UI框架，使用 tailwindcss 作为 atom css 框架。黑白主题系统 primereact 已经实现好了，不需要额外实现，除非你认为 primereact 没有涵盖这部分的定义。
对于生成或者修改组件，请尽量使用 primereact 提供的组件完成。UI实现啀美观大方，UI组件之间保持一定的间距。如果你想要定义彩色，请尽量使用 tailwindcss 的 primary 类的 css class 定义彩色，这样可以尽量符合颜色系统。

所有前端发起的网络请求，请通过 `@/app/service` 来实现。你需要先检查这个文件夹中是否存在已经实现好的业务。业务和 `@/app/api` 中的服务是一一对应的。

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

如果前端出现了 supabase 势力进行数据库访问，你应该把这部分迁移到后端中，并在 @/app/service 中的相关函数写入对应的 API 访问并通过访问替代当前的前端直接询问 supabase
- 如果前端代码出现了 setError 或者 setMessage 的函数，则替换为 toast 函数来向用户发出提醒。
- loading 为 true 部分的组件替换为 primereact 的骨架屏。
- 所有改动都需要适配移动端。

---

## 后端部分

我现在有如下的一个 POST 函数代码

文件路径：src/app/api/coach/get-contents/route.ts

请根据我后续的要求，把最对应的其他请求转换为和上面的风格、代码依赖一致的 nextjs POST 代码，重点：
1. 使用 NextResponse 返回 JSON。（内容严格为 success,message,data）
2. 依赖统一：import supabase from '@/lib/supabaseClient' import { getServerSession } from '../../auth/[...nextauth]/auth'

除此之外，你还需要根据接口理解，在对应文件夹下生成对应的 entity 文件，并以 type 形式导入。