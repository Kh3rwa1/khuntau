// Pushes the store listing to Google Play through the Android Publisher API.
//   PLAY_SERVICE_ACCOUNT_JSON='<the service account key file contents>' node tools/play-listing.mjs
//   DRY=1 node tools/play-listing.mjs      checks the text and images, sends nothing
// Text comes from twa/store-listing.md (the six code blocks: EN name/short/full, HI name/short/full), images from the
// repo. The service account needs "Edit store listing, pricing & distribution" on the app in Play Console.
// Also sets the Data safety form from twa/data-safety.csv (NO_SAFETY=1 skips it).
// Never commit the key. Content rating and target audience are console forms; the API cannot set them.
import fs from 'fs'; import crypto from 'crypto';
const PKG = 'com.skyward.ascent', API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + PKG;
const UP = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/' + PKG;
const blocks = [...fs.readFileSync('twa/store-listing.md', 'utf8').matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1]);
if (blocks.length !== 6) throw new Error('expected 6 text blocks in twa/store-listing.md, found ' + blocks.length);
const listings = { 'en-US': blocks.slice(0, 3), 'hi-IN': blocks.slice(3) };
for (const [l, [t, s, f]] of Object.entries(listings)) { if (t.length > 30 || s.length > 80 || f.length > 4000) throw new Error(l + ': text over Play limits'); console.log(l, 'title', t.length, 'short', s.length, 'full', f.length); }
const S = 'design/brand/store/';
const images = { icon: ['public/icon-512.png'], featureGraphic: ['design/brand/play-feature-1024x500.png'],
  phoneScreenshots: ['7-ring', '8-bull', '2-yard', '4-akhra', '6-fields', '1-home'].map(n => S + n + '.png') };
for (const fsList of Object.values(images)) for (const f of fsList) if (!fs.existsSync(f)) throw new Error('missing ' + f);
if (!fs.existsSync('twa/data-safety.csv')) throw new Error('missing twa/data-safety.csv');
if (process.env.DRY) { console.log('dry run: text and images are fine, nothing sent'); process.exit(0); }
const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON; if (!raw) throw new Error('set PLAY_SERVICE_ACCOUNT_JSON to the service account key (file contents)');
const key = JSON.parse(raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8'));
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 });
const jwt = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
if (!tok.access_token) throw new Error('no access token: ' + (tok.error_description || tok.error));
const call = async (method, url, body, type = 'application/json') => { const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + tok.access_token, ...(body ? { 'content-type': type } : {}) }, body: body && type === 'application/json' ? JSON.stringify(body) : body });
  const t = await r.text(); if (!r.ok) throw new Error(method + ' ' + url.replace(/^.*applications\//, '') + ' -> ' + r.status + ' ' + t.slice(0, 400)); return t ? JSON.parse(t) : {}; };
if (!process.env.NO_SAFETY) { await call('POST', API + '/dataSafety', { safetyLabels: fs.readFileSync('twa/data-safety.csv', 'utf8') }); console.log('data safety form set from twa/data-safety.csv'); }
const edit = await call('POST', API + '/edits', {}); const E = '/edits/' + edit.id;
for (const [lang, [title, shortDescription, fullDescription]] of Object.entries(listings)) {
  await call('PUT', API + E + '/listings/' + lang, { language: lang, title, shortDescription, fullDescription }); console.log('text set', lang);
  for (const [type, files] of Object.entries(images)) { await call('DELETE', API + E + '/listings/' + lang + '/' + type);
    for (const f of files) await call('POST', UP + E + '/listings/' + lang + '/' + type + '?uploadType=media', fs.readFileSync(f), 'image/png'); console.log('images set', lang, type, files.length); } }
try { await call('POST', API + E + ':commit'); console.log('committed: sent to Google for review'); }
catch (e) { if (!/changesNotSentForReview/.test(e.message)) throw e; await call('POST', API + E + ':commit?changesNotSentForReview=true'); console.log('committed as a draft: open Play Console > Publishing overview and send the changes for review'); }
