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
    /map/i,
    /location/i,
    /geo/i,
    /地图/i,
    /位置/i,
    /地理/i,
    /baidu/i,
    /百度/i
], (file) => {
    results.push(file);
});

console.log('Files related to map/location:');
results.forEach(f => console.log(f));
