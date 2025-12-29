import fs from 'fs';
import path from 'path';

export async function getDocContent(filename: string) {
    try {
        // 在服务端组件中，直接读取文件系统比 fetch 更可靠且高效
        const filePath = path.join(process.cwd(), 'public', 'docs', filename);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return content;
    } catch (error) {
        console.error(`Error reading doc ${filename}:`, error);
        return null;
    }
}