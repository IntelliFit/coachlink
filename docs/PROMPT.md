## 前端部分

当前是一个 App Route 模式的 nextjs 项目。使用 primereact 作为UI框架，使用 tailwindcss 作为 atom css 框架。黑白主题系统 primereact 已经实现好了，不需要额外实现，除非你认为 primereact 没有涵盖这部分的定义。
对于生成或者修改组件，请尽量使用 primereact 提供的组件完成。UI实现啀美观大方，UI组件之间保持一定的间距。如果你想要定义彩色，请尽量使用 tailwindcss 的 primary 类的 css class 定义彩色，这样可以尽量符合颜色系统。

所有的网络请求，请通过当前业务文件夹下的 api.ts 来实现。你需要创建一个 XXXService 的类，并且是单例模式。这个类只有一个构造参数，baseUrl，代表当前业务的根路由，比如 /api/user
具体请看例子：src/app/dashboard/service/coachService.ts

---

## 后端部分

我现在有如下的一个 POST 函数代码

文件路径：src/app/api/coach/get-contents/route.ts

请根据我后续的要求，把最对应的其他请求转换为和上面的风格、代码依赖一致的 nextjs POST 代码，重点：
1. 使用 NextResponse 返回 JSON。（内容严格为 success,message,data）
2. 依赖统一：import supabase from '@/lib/supabaseClient' import { getServerSession } from '../../auth/[...nextauth]/auth'

除此之外，你还需要根据接口理解，在对应文件夹下生成对应的 entity 文件，并以 type 形式导入。