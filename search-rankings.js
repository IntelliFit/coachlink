const fs = require('fs');
const path = require('path');

function findFiles(dir, pattern, callback) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
            findFiles(fullPath, pattern, callback);
        } else if (pattern.test(file)) {
            callback(fullPath);
        }
    }
}

const results = [];
findFiles('D:/files/coachlink/src', /ranking|排行/i, (file) => {
    results.push(file);
});

console.log('Files with ranking in name:');
results.forEach(f => console.log(f));

// Also search for video-related files
const videoResults = [];
findFiles('D:/files/coachlink/src', /video|视频/i, (file) => {
    if (file.includes('Rank') || file.includes('rank')) {
        videoResults.push(file);
    }
});

console.log('\nVideo files in ranking context:');
videoResults.forEach(f => console.log(f));
