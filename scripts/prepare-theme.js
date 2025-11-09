const fs = require('fs');
const path = require('path');

/**
 * 将 PrimeReact 主题文件夹复制到 ./public 下
 * @param {string} themeName - 主题颜色字符串 (例如: 'lara-light-indigo', 'lara-dark-indigo')
 * @param {string} [publicSubDir='themes'] - 在 public 目录下存放主题的子目录名，默认为 'themes'
 * @returns {boolean} - 成功返回 true，失败返回 false
 */
function copyPrimeReactTheme(themeName, publicSubDir = 'themes') {
    try {
        // 1. 路径构造
        const primeReactThemeSourcePath = path.join(process.cwd(), 'node_modules', 'primereact', 'resources', 'themes', themeName);
        const targetBaseDir = path.join(process.cwd(), 'public', publicSubDir);
        const themeTargetPath = path.join(targetBaseDir, themeName);

        // 2. 检查源主题目录是否存在
        if (!fs.existsSync(primeReactThemeSourcePath)) {
            console.error(`错误：在 '${primeReactThemeSourcePath}' 未找到主题 '${themeName}'。`);
            console.log('请检查主题名称是否正确，以及 node_modules/primereact 是否已安装。');
            return false;
        }

        // 3. 确保目标目录存在
        if (!fs.existsSync(targetBaseDir)) {
            fs.mkdirSync(targetBaseDir, { recursive: true });
            console.log(`目标目录 '${targetBaseDir}' 创建成功。`);
        }

        // 4. 执行复制
        copyFolderRecursiveSync(primeReactThemeSourcePath, themeTargetPath);
        console.log(`主题 '${themeName}' 已成功复制到 '${themeTargetPath}'。`);
        return true;

    } catch (error) {
        console.error(`复制主题 '${themeName}' 时发生错误:`, error);
        return false;
    }
}

/**
 * 递归同步复制文件夹
 * @param {string} source - 源文件夹路径
 * @param {string} target - 目标文件夹路径
 */
function copyFolderRecursiveSync(source, target) {
    // 检查目标目录是否存在，不存在则创建
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    // 读取源目录下的所有项目
    const items = fs.readdirSync(source);

    items.forEach(item => {
        const sourcePath = path.join(source, item);
        const targetPath = path.join(target, item);

        const stat = fs.statSync(sourcePath);

        if (stat.isDirectory()) {
            // 如果是目录，则递归复制
            copyFolderRecursiveSync(sourcePath, targetPath);
        } else {
            // 如果是文件，则直接复制
            fs.copyFileSync(sourcePath, targetPath);
        }
    });
}

// 使用示例
copyPrimeReactTheme('lara-light-amber', 'themes');
copyPrimeReactTheme('lara-dark-amber', 'themes');