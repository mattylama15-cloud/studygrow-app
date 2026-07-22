// Rebuild the StudyGrow web app and redeploy it to GitHub Pages.
// Usage:  node scripts/deploy-web.mjs
//
// Live URL: https://mattylama15-cloud.github.io/studygrow/
// Hosted from the separate git repo inside ./dist-web (remote: origin -> studygrow).
// `expo export` wipes dist-web each time, so we re-add the PWA extras after exporting.

import { execSync } from 'node:child_process';
import { writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist-web');
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });

const HEAD_TAGS = `<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="StudyGrow">
<link rel="apple-touch-icon" href="/studygrow/icon.png">
<link rel="manifest" href="/studygrow/manifest.json">
`;

const MANIFEST = {
  name: 'StudyGrow',
  short_name: 'StudyGrow',
  start_url: '/studygrow/',
  scope: '/studygrow/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F4F7F5',
  theme_color: '#16A34A',
  icons: [
    { src: '/studygrow/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/studygrow/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
  ],
};

console.log('▶ Exporting web build…');
run('npx expo export --platform web --output-dir dist-web');

console.log('▶ Adding PWA extras…');
copyFileSync(resolve(root, 'assets/icon.png'), resolve(dist, 'icon.png'));
writeFileSync(resolve(dist, '.nojekyll'), '');
writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(MANIFEST, null, 2));

const indexPath = resolve(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('apple-mobile-web-app-capable')) {
  html = html.replace('</head>', `${HEAD_TAGS}</head>`);
  writeFileSync(indexPath, html);
}

console.log('▶ Deploying to GitHub Pages…');
// expo export wipes dist-web (incl. .git) every run, so re-init the deploy repo
// here and force-push. History doesn't matter for a build artifact.
const REPO = 'https://github.com/mattylama15-cloud/studygrow.git';
const git = (args) => run(`git ${args}`, { cwd: dist });
git('init -b main');
git('config user.name "StudyGrow Deploy"');
git('config user.email "rozkapipkova@gmail.com"');
git('add -A');
git('commit -m "Update StudyGrow PWA"');
git(`remote add origin ${REPO}`);
git('push -f origin main');

console.log('\n✅ Deployed: https://mattylama15-cloud.github.io/studygrow/');
console.log('   (GitHub Pages takes ~1 min to refresh.)');
