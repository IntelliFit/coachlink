// markdown-it.d.ts
// 类型定义文件，允许 TypeScript 正确识别 markdown-it 的导入

declare module 'markdown-it' {
  interface Options {
    html?: boolean;
    xhtmlOut?: boolean;
    breaks?: boolean;
    langPrefix?: string;
    linkify?: boolean;
    typographer?: boolean;
    quotes?: string;
    highlight?: (str: string, lang: string) => string;
  }

  interface MarkdownIt {
    render: (markdown: string) => string;
  }

  const MarkdownIt: {
    new (options?: Options): MarkdownIt;
  };

  export = MarkdownIt;
}
