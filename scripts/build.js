const fs = require('fs');

// Start from an empty dist/ folder every time
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');

// Copy the application code and the dependency files
fs.cpSync('src', 'dist/src', { recursive: true });
fs.copyFileSync('package.json', 'dist/package.json');
fs.copyFileSync('package-lock.json', 'dist/package-lock.json');

// Record which commit and Jenkins build produced this package
const info = {
  commit: process.env.GIT_COMMIT || 'local',
  build: process.env.BUILD_NUMBER || 'local',
};
fs.writeFileSync('dist/build-info.json', JSON.stringify(info, null, 2));

console.log('Built into dist/ (commit ' + info.commit + ')');
