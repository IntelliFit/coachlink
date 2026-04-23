const fs = require('fs');
const path = require('path');

function findFiles(dir, patterns, callback) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
            findFiles(fullPath, patterns, callback);
        } else if (patterns.some(p => p.test(file))) {
            callback(fullPath);
        }
    }
}

const results = [];
findFiles('D:/files/coachlink/src', [
    /baidu/i,
    /百度/i,
    /BMap/i
], (file) => {
    results.push(file);
});

console.log('Files with baidu/map references:');
results.forEach(f => console.log(f));

// Search content
const contentResults = [];
function searchContent(dir, patterns, callback) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
            searchContent(fullPath, patterns, callback);
        } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (patterns.some(p => p.test(content))) {
                    callback(fullPath);
                }
            } catch (e) {}
        }
    }
}

searchContent('D:/files/coachlink/src', [
    /百度地图/i,
    /baidu.*map/i,
    /BMap/i,
    /api\.map\.baidu/i
], (file) => {
    contentResults.push(file);
});

console.log('\nFiles with baidu map in content:');
[...new Set(contentResults)].forEach(f => console.log(f));
