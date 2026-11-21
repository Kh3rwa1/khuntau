// Puts a Santali speaker's translations into the game. Fill the "santali (Ol Chiki)" column of
// design/santali-strings.csv (leave a cell empty to keep English there), then run:  node tools/santali-import.mjs
// It rewrites the block between SANTALI:BEGIN and SANTALI:END in public/story.js. Then run the tests and deploy.
import fs from 'fs';
const [CSV = 'design/santali-strings.csv', STORY = 'public/story.js'] = process.argv.slice(2);
const csv = fs.readFileSync(CSV, 'utf8');
const rows = []; { let row = [], cell = '', q = false;
  for (let i = 0; i < csv.length; i++) { const c = csv[i];
    if (q) { if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); } }
const T = {}, UI = {}; let n = 0;
for (const [where, en, , sat] of rows.slice(1)) {
  if (!sat || !sat.trim()) continue; n++;
  const m = /^dialogue\.(\w+)\.(\d+)$/.exec(where);
  if (m) { (T[m[1]] ||= [])[+m[2]] = sat.trim(); } else UI[en] = sat.trim();
}
// dialogue lines are [speaker, text] pairs; any untranslated cell falls back to English for that whole entry
const en = fs.readFileSync(STORY, 'utf8'), tEN = en.slice(en.indexOf('const T_EN = {'), en.indexOf('const T_HI = {'));
const T_SAT = {};
for (const [k, flat] of Object.entries(T)) {
  const src = (new RegExp(`^\\s{4}${k}:\\s*(\\[.*\\]),?\\s*$`, 'm').exec(tEN) || [])[1]; if (!src) continue;
  const enFlat = [...src.matchAll(/'((?:[^'\\]|\\.)+)'/g)].map(x => x[1]);
  if (enFlat.some((_, i) => !flat[i])) { console.log(`  ${k}: not every line translated, stays English`); continue; }
  T_SAT[k] = k === 'obj' ? flat : flat.reduce((a, t, i) => (i % 2 ? a[a.length - 1].push(t) : a.push([t]), a), []);
}
const block = `/* SANTALI:BEGIN */\n  const T_SAT = ${JSON.stringify(T_SAT)};\n  const SAT = ${JSON.stringify(UI)};\n  /* SANTALI:END */`;
const out = en.replace(/\/\* SANTALI:BEGIN \*\/[\s\S]*?\/\* SANTALI:END \*\//, block);
fs.writeFileSync(STORY, out);
console.log(`${n} Santali cells imported (${Object.keys(T_SAT).length} dialogue entries, ${Object.keys(UI).length} UI lines).`);
