# Khuntau

Free 3D browser game about Khuntau (Dangra Khuntau), the bull-post day of the Santal Sohrai festival.
Live at https://khuntau.dulalkisku0.workers.dev. Made by Dulor (Tumdah). Phone players are the main market.

## Working with Dulor
- Be a ruthless mentor: say plainly when something is weak, and why. Test before calling anything done.
- Be proactive: when a fix is clearly needed, make it instead of asking.
- Prefer the fastest approach. No paid tools or credits unless Dulor provides a key for that job.
- Phone first, always. Every change must work on a budget Android phone (test device: Galaxy A34) and on a laptop.
- Never write API keys into files, commits or chat. Ask Dulor for a key when a job needs one.
- After every update, merge the work branch into `main` and push `main`. Don't ask first.

## Commands
```
npm install                 # wrangler + puppeteer (downloads its own Chrome)
npx wrangler dev            # local game with the Worker, Durable Objects and API
npx wrangler deploy         # deploy to khuntau.dulalkisku0.workers.dev (needs `npx wrangler login` once)
node tests/serve.mjs        # static server for tests on 127.0.0.1:8791 (no /api; leaderboard calls 404, that is fine)
npm test                    # with serve.mjs running: story (EN + Hindi), ring, drum, walk, offline, draw calls, 429 messages
node tests/walk.mjs         # walking feel: holds the stick into people, fails on any stall over 1 s
npx wrangler dev --local --port 8787 --ip 127.0.0.1 &  then  npm run test:online   # rooms, board, tickets, abuse limits
```
Run tests from the repo root. Screenshots land in `tests/out/`; look at them, don't just trust "no errors".
`?fps` shows an on-screen meter (fps, worst frame, quality stage, draw calls) for checking real phones. `?debug` in the URL exposes `window.__k` (game, story, bull, player, setAnimal, houses, renderer, perf, …);
`__k.story.debug` has the story's state, save, drum/arch/fish/echo state and helpers. `?q=low` forces low quality.

## Layout
- `public/index.html`: the whole ring game (Three.js, self-hosted under `public/vendor/three/`). One big file.
- `public/story.js`: story mode "Sohrai Day", loaded with `import()` after the game boots. It receives what it
  needs from index.html as one object `C` (see `initStory(C)`); keep it that way instead of reaching into globals.
- `public/sw.js`: offline cache. `VERSION` must change on every deploy that changes files (it is a hash of
  `public/`; recompute it, see "Deploy checklist"). New files must be added to its precache list.
- `public/models/*.json`: Quaternius CC0 glTF models with embedded buffers (bull, cow, casual_male/female).
  Cow is loaded only when picked. Optimised with gltf-transform (resample, dedup, prune, quantize).
- `public/audio/`: Openverse sound effects and music. `public/fonts/`: self-hosted font subsets.
- `src/worker.js`: Cloudflare Worker. Durable Objects: `Room` (one per online room; knock/admit, handi pickup,
  score report) and `Board` (one global: daily leaderboard, saves/progress codes, push subscriptions, open-rooms
  list). Cron `30 12 * * *` (6 pm IST) sends evening push reminders. Scores need an HMAC ticket.
- `wrangler.jsonc`: `run_worker_first` for `/ws/*`, `/turn`, `/api/*`; migrations v1 Room, v2 Board.
- `design/story-brief.md`: the one-page plan for story mode (format from donchitos/claude-code-game-studios).
- `twa/`: Bubblewrap config and steps for the Play Store app (Trusted Web Activity).
- `promo/`: the video pipeline used for the trailers (see "Promo videos").

## Game facts
- Ring game: snatch pitha from the khunt (post) while the tied animal charges. 3 lives (diya lamps). Hide (Q) to
  provoke, roll (Space) to dodge, grab (E) at the post while the animal is stunned/recovering. Handi pot = +1 life.
  Golden pitha, slow motion, combo, bull fury, live rival chip. Daily board, streaks, missions, levels, shirts.
- Online: up to several players per room, voice chat (whistle SFX, ducking), "Playing now" open-rooms list with
  ask-to-join and host accept.
- Animals: brown/white/black bull, red/white cow (`ANIMALS` in index.html). Choice saved in `khuntau-animal`.
- Performance: characters merged into one vertex-coloured skinned mesh each; static scenery baked; cheap mode
  (Lambert, blob shadows) and staged auto-quality saved in `khuntau-perf`; off-screen crowd culled.
- Story mode (`story.js`), progress in `khuntau-story`, language in `khuntau-lang`:
  1. Wake in the mud house; drink handi (also eat pitha, rest, talk to Gogo). 2. Paint 3 wall motifs.
  3. Cattle shed: choose animal, oil horns, garland. 4. Tamak/tumdak rhythm game; dancers, Majhi and the animal
  react to every hit. 5. Ring finale: 3 pitha. Then a daily round: archery, fishing, singing at 3 houses
  (drum call-and-response), tamak; +15 XP each once a day.
  One context button (`#actBtn`, E on laptops) does whatever is nearest. Hindi for all story text (pause menu).
- The interior of the house lives under the ground at y = -40 and is shown only while inside.

## Deploy checklist
1. Run `node tests/serve.mjs` and `npm test`; look at the screenshots in `tests/out/`.
2. Recompute `VERSION` in `public/sw.js`:
   `python3 -c "import hashlib,os;h=hashlib.sha1();[h.update(open(os.path.join(r,f),'rb').read()) for r,_,fs in sorted(os.walk('public')) for f in sorted(fs) if f!='sw.js'];print(h.hexdigest()[:10])"`
3. `npx wrangler deploy`, then check the live site (e.g. `curl -s <site>/story.js | head -1`).
4. The page and story.js are network-first, so phones get new code on the next load; models, audio and fonts
   refresh when the new service worker installs (a full close and reopen makes that immediate).

## Status board (A to Z audit, Nov 2026)
Every row ends as **fixed + test** or **blocked + what Dulor must do**. Keep it current.

| Area | State | Proof / what's needed |
|---|---|---|
| Walking snags on people | fixed | `tests/walk.mjs` (5 routes, no stall > 1 s) |
| Archery target unreadable on phone | fixed | screenshots at 390x780 and 1280x720 |
| Tests only logged, never failed | fixed | `tests/check.mjs`; every test exits 1 on a failed check |
| Door test walked into the back wall | fixed | `story2.mjs` walks yard to door, asserts inside |
| Free drumming after the story | works (test was wrong) | `story1.mjs` free-play check |
| Ring hint covered the HIDE button on phones | fixed | portrait only (landscape keeps it off the post): `net-guest-3-play.jpg`, `l-h-ring.jpg`; online rounds reset ring button labels to English |
| Draw calls | cut + guarded | garland was 22 meshes (22 calls) on the animal everywhere; merged to 2. Ring 66→46, akhra 107→88, edge 83→63. `tests/calls.mjs` budgets tightened (60/40/105/80) |
| Online rooms, board, tickets | fixed + tested | `tests/online.mjs` (33 checks) and `tests/online-ui.mjs` (two phones: list, ask, accept, start, play); per-IP limits on restore/save/push, room reports throttled |
| Offline / service worker | fixed + tested | `tests/offline.mjs`: boots, story, cow with the server really down; story.js now network-first so a deploy can't pair a new page with old story code |
| Ring game end to end | tested | `tests/ring.mjs`: grab, refill, bait+hit, roll dodge, handi, game over, score on the board, play again |
| Drum timing | fixed + tested | `tests/drum.mjs` (incl. real pad pointerdown path; clicks proven heard on the beat within 2.2 ms with a 120 ms speaker lag): clicks booked on the audio clock minus speaker delay; taps use the touch time; late taps no longer marked Miss before they land; oldest open note gets the tap; each phone learns its offset (`khuntau-drumlag`) |
| Busy server (429) on shared mobile IPs | fixed + tested | per-IP limits roomy for carrier NAT (30 new saves/min); keep-progress and reminders say 'try again in a minute' instead of blank/false errors; `tests/busy.mjs` |
| Hindi coverage | fixed + tested | `HI=1` runs of story1/story3 fail on any English word on screen; the ring finale's own lines and buttons now go through the story's translator; the singing objective key never matched |
| In-game credits text, banana leaves | fixed | Credits name Dulor's music and three.js/fonts; leaves rebuilt (YXZ lean, lit), `arch-p-1aim.jpg` |
| Deploy | ready, needs one secret | `.github/workflows/ci.yml` tests every push and deploys `main` when green. Dulor: add repo secret `CLOUDFLARE_API_TOKEN` (Workers edit; plus `CLOUDFLARE_ACCOUNT_ID` if the token sees several accounts) |
| Slow-phone safety net | tested | `tests/slowphone.mjs`: CPU throttled 6x, auto quality on: steps itself down, remembers it, story still walks |
| Real-phone feel on the A34 | needs Dulor's phone | open `https://khuntau.dulalkisku0.workers.dev/?fps` on the A34 after the next deploy: read the meter in the village and at the akhra (green 45+, yellow 28+, red below), play the drum chart twice and say early/late/fine |
| Santali story text | blocked | needs a Santali speaker to write/check; never machine-invent it |
| Customs order and details | blocked | Dulor to correct anything wrong for his village |
| Story mode multiplayer | design choice | single-player by design; the ring is the online mode |
| Play Store (TWA, `com.tumdah.khuntau`) | ready to build, needs Dulor's account | manifest has id, description, maskable icon; Chrome says installable (`offline.mjs`). `twa/twa-manifest.json` + `twa/README.md` (build, signing, assetlinks). Dulor: Play developer account type + creation date (personal accounts after Nov 2023 need a 12-tester, 14-day closed test), then build once on the Mac |
| Archery was a timing bar with a picture glued on | rebuilt | drag-to-aim: crosshair follows the drag (thumb never covers the target), held-bow sway that grows if you hold too long, release to shoot, arrow lands where you aimed; arrow keys + Space on laptops. `story3.mjs` aims with real pointer drags; `drag-*.jpg` at 1280x720 and 780x390 |

## Promo videos (`promo/`)
Rendered by filming the game in headless Chrome with a virtual clock, then compositing with a 2D canvas.
- `promo/trailer/`: `server.mjs` (static server on 8790 for `promo/trailer/game/`; the trailer copy of the game
  is not included, copy `public/` into `promo/trailer/game/` first), `boot.mjs`, `capture.mjs` (shots → clips),
  `shots.js`/`shots2.js` storyboards, `overlay.js` (kinetic type, Ol Chiki and Devanagari aware), `look.js`,
  `day.js`/`night.js`, caption maps `*_map.js`, `comp.js`/`comp.mjs` (real-footage compositor), `music/sohrai.mp3`.
- `promo/real/`: `mix.py` (music map + SFX + commentary, sidechain ducking, loudnorm -14; `EN=1` for English),
  ElevenLabs commentary in `vo/` (Hindi, voice "Raju") and `vo_en/` (English, British football commentator),
  ElevenLabs comedy SFX in `sfx/`.
- Finished videos (already delivered to Dulor, not in this repo): Launch Trailer (EN, Santali, Hindi), Night
  Trailer Hindi, Hindi Cinematic (day), Real vs Game promo (Hindi, English).
- Dulor's video rules: story-based and viral-worthy; captions are textured kinetic typography, never plain fonts;
  never silent; no ending credit note; Khuntau happens in the day, never at night; BGM/SFX from Openverse when
  reachable; voice via Sarvam AI by default (Bodhan and ElevenLabs were used when Dulor gave those keys).
- Scripts were moved from a Linux sandbox; paths were made relative but have not been re-run on the Mac.
  Expect small fixes (Chrome flags, ffmpeg availability) the first time.
