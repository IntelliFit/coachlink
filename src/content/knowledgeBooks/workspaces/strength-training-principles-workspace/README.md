# 力量训练原理

这个目录是书籍笔记的工作目录。目标不是搬运原书，而是产出可发布到知识库的“解读型笔记”。

## 你要填的文件

- `book.json`：整本书的元信息和每篇文章索引
- `notes/00-overview.md`：整本书总览
- `notes/*.md`：各章节 / 主题分篇

## 建议流程

1. 先看本地临时素材目录：`D:\files\coachlink\temp_dir\knowledge-book-workspaces\strength-training-principles-workspace`
2. 先写总览，再逐篇补章节
3. 每篇都讲成“通俗解释 + 关键逻辑 + 常见误区 + 落地做法”
4. 图片不用真的生成，只要把提示词写进 `book.json`

## 本地临时素材

- 原书抽取文本：`D:\files\coachlink\temp_dir\knowledge-book-workspaces\strength-training-principles-workspace\source.txt`
- 自动章节探测：`D:\files\coachlink\temp_dir\knowledge-book-workspaces\strength-training-principles-workspace\outline.md`

这些文件只用于本地整理，不应该作为可发布内容提交或入库。

## 导入命令

```bash
npx tsx scripts/import-knowledge-book-notes.ts strength-training-principles-workspace --apply
```
