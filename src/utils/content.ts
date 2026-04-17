import fs from 'fs';
import path from 'path';

export async function getDocContent(filename: string) {
    if (filename == null || typeof filename !== 'string' || !filename.trim()) {
        console.error('[getDocContent] invalid filename:', filename);
        return null;
    }
    try {
        // 在服务端组件中，直接读取文件系统比 fetch 更可靠且高效。
        // 但不同运行方式下（repo root / .next/standalone / 某些脚本 cwd）process.cwd() 可能不同，
        // 这里做多级回退，确保能稳定读到 public/docs 下的 markdown。
        const candidates = [
            process.cwd(),
            path.join(process.cwd(), '..'),
            path.join(process.cwd(), '../..'),
            path.join(process.cwd(), '../../..'),
        ];

        for (const base of candidates) {
            const filePath = path.join(base, 'public', 'docs', filename);
            if (!fs.existsSync(filePath)) continue;
            return fs.readFileSync(filePath, 'utf8');
        }

        return null;
    } catch (error) {
        console.error(`Error reading doc ${filename}:`, error);
        return null;
    }
}
