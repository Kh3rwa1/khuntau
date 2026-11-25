// Builds Hul's own site into hul/dist: the page plus only the shared files it loads from Sohrai's public/.
// node tools/hul-build.mjs   (then: npx wrangler deploy --config hul/wrangler.jsonc, or serve hul/dist for tests)
import fs from 'fs'; import path from 'path';
const out = 'hul/dist', pub = 'public';
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const page = fs.readFileSync('hul/index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), page);
fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><meta charset="utf-8"><title>Hul</title><p style="font-family:sans-serif">Not here. <a href="/">Play Hul</a></p>');
// every absolute file the page names, plus the sounds it builds from a list and the font files fonts.css points at
const files = new Set(page.match(/["'](\/(?:vendor|models|fonts|audio)\/[^"'?#]+|\/icon-192\.png)["']/g).map(s => s.slice(1, -1)));
for (const f of [...files]) if (f.endsWith('/')) files.delete(f); // import-map folder prefixes
for (const m of page.matchAll(/url\((\/[^)'"]+)\)/g)) files.add(m[1]); // CSS url(...) in the page itself
const snd = page.match(/SND = \[([^\]]*)\]/); if (!snd) throw new Error('SND list not found in hul/index.html');
for (const n of snd[1].match(/'([^']+)'/g).map(s => s.slice(1, -1))) files.add('/audio/' + n + '.mp3');
for (const f of [...files]) if (f.endsWith('.css')) for (const m of fs.readFileSync(pub + f, 'utf8').matchAll(/url\((\/[^)]+)\)/g)) files.add(m[1]);
// three.js addons import each other: copy the whole vendor folder (small)
const walk = d => fs.readdirSync(d).flatMap(n => { const p = path.join(d, n); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
for (const p of walk(path.join(pub, 'vendor'))) files.add('/' + path.relative(pub, p).split(path.sep).join('/'));
let bytes = 0;
for (const f of [...files].sort()) { const src = path.join(pub, f); if (!fs.existsSync(src)) throw new Error('missing ' + src); const dst = path.join(out, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); bytes += fs.statSync(src).size; }
console.log(`hul/dist: index.html + ${files.size} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
