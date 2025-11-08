import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';

interface MyDocumentProps extends DocumentInitialProps {
    theme: 'light' | 'dark';
}

export default function MyDocument({ theme }: MyDocumentProps) {
    
    const themeHref =
        theme === 'dark'
            ? '/themes/lara-dark-blue/theme.css'
            : '/themes/lara-light-blue/theme.css';

    return (
        <Html lang="zh">
            <Head>
                {/* SSR 阶段根据 cookie 输出正确主题 */}
                <link id="theme-link" rel="stylesheet" href={themeHref} />

                <link rel="icon" href="/favicon.ico" />
                <link rel="stylesheet" href="/primereact/resources/primereact.min.css" />
                <link rel="stylesheet" href="/primeicons/primeicons.css" />
            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}

MyDocument.getInitialProps = async (ctx: DocumentContext) => {    
    const initialProps = await Document.getInitialProps(ctx);

    const cookie = ctx.req?.headers.cookie ?? '';
    const match = cookie.match(/theme=(dark|light)/);
    const theme = match ? (match[1] as 'dark' | 'light') : 'light';

    return { ...initialProps, theme };
};
