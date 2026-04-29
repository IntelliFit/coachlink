# 书籍笔记系统

## 目标

把“给一本本地书籍文件 -> 生成知识库书籍笔记工作目录 -> 补写解读内容 -> 导入知识库”变成固定流程。

## 目录结构

- 发布内容工作目录：`src/content/knowledgeBooks/workspaces/<slug>/`
- 本地临时素材：`temp_dir/knowledge-book-workspaces/<slug>/`

说明：

- `src/content/...` 里只放可发布的解读内容和元信息
- `temp_dir/...` 里才放从原书抽取出来的原始文本和章节探测结果
- 原始全文不应进入可发布目录或直接入库

## 第一步：从本地书籍文件生成工作目录

```bash
npx tsx scripts/scaffold-knowledge-book.ts --source "D:\path\book.docx" --slug my-book --title "书名" --authors "作者1,作者2"
```

生成结果：

- `src/content/knowledgeBooks/workspaces/my-book/book.json`
- `src/content/knowledgeBooks/workspaces/my-book/notes/*.md`
- `src/content/knowledgeBooks/workspaces/my-book/README.md`
- `temp_dir/knowledge-book-workspaces/my-book/source.txt`
- `temp_dir/knowledge-book-workspaces/my-book/outline.md`

## 第二步：自动生成初稿（可选）

如果已经准备好了 DeepSeek API key，可以先批量生成一轮“总览 + 章节解读”初稿：

```bash
npx tsx scripts/generate-knowledge-book-drafts.ts my-book --api-key "你的 DeepSeek Key" --model deepseek-v4-flash --max-notes 3
```

常用参数：

- `--notes overview,chapter-01,chapter-02`：只生成指定文章
- `--max-notes 3`：限制本次最多生成几篇，适合先小范围验证
- `--overwrite`：覆盖已经生成过的正文
- `--model deepseek-v4-flash` / `deepseek-v4-pro`：切换模型

生成结果：

- 回写对应的 `notes/*.md`
- 更新 `book.json` 里的标题、摘要、图片提示词
- 在 `temp_dir/knowledge-book-workspaces/<slug>/generation-log.json` 记录本次生成日志

补充说明：

- 生成脚本读取的是 `temp_dir/.../source.txt` 本地原书抽取文本，不会把原书全文写回可发布目录
- 每篇文章末尾会自动追加统一尾注：`本书仅为阅读笔记，如果侵权请联系平台，我们会删除相关的内容。`
- 生成的是“可编辑初稿”，建议人工快速过一遍标题层级、章节取舍和图片提示词

## 第三步：补写 / 精修内容

优先编辑：

1. `notes/00-overview.md`
2. `notes/01.md`, `notes/02.md` ...
3. `book.json` 里的标题、摘要、图片提示词

推荐写法：

- 总览先讲整本书的主线、阅读路径、适合谁看
- 分篇统一写成“这一章解决什么、通俗解释、关键逻辑、常见误区、怎么落地”
- 图片只保留提示词，不直接存图

## 第四步：导入知识库

```bash
npx tsx scripts/import-knowledge-book-notes.ts my-book --apply
```

支持两种 slug：

- 整本书：`my-book`
- 单篇文章：`overview` / `chapter-01` 这类 note slug

## 当前能力

- 支持读取 `.docx` / `.txt` / `.md`
- 自动探测章节标题并生成多篇文章骨架
- 导入脚本会自动识别 `workspaces/` 下的新书，不需要再手工改注册表

## 当前边界

- 自动章节探测只是初稿，复杂目录仍建议人工清理 `book.json`
- 内容解读仍需要 AI/人工补写，系统负责把文件结构、导入链路和版权边界固定下来
