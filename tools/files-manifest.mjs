// node tools/files-manifest.mjs [dir] [--check]
// Writes <dir>/files.json (default public/): every game file with its SHA-256, and `v`, a short hash of the whole list.
// The Android app compares this with what it holds and downloads only the files that changed (over-the-air updates).
// Run it before computing the sw.js VERSION (ship does). --check exits 1 if the file on disk is stale.
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const args = process.argv.slice(2), check = args.includes('--check'), dir = args.find(a => !a.startsWith('--')) || 'public';
const skip = rel => rel === 'sw.js' || rel === 'files.json' || rel.startsWith('.well-known/');
const files = {};
(function walk(d) { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else { const rel = path.relative(dir, p).split(path.sep).join('/'); if (!skip(rel)) files[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } } })(dir);
const v = crypto.createHash('sha256').update(Object.entries(files).map(([k, h]) => k + ':' + h).join('\n')).digest('hex').slice(0, 10);
const text = JSON.stringify({ v, files }, null, 1) + '\n', out = path.join(dir, 'files.json');
if (check) { const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''; if (cur !== text) { console.error('FAIL ' + out + ' is stale: run node tools/files-manifest.mjs'); process.exit(1); } console.log('ok   ' + out + ' matches the files (' + Object.keys(files).length + ' files, v ' + v + ')'); }
else { fs.writeFileSync(out, text); console.log(out, Object.keys(files).length, 'files, v', v); }
