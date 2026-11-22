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
CI: `.github/workflows/ci.yml` runs everything below on GitHub for each push (software WebGL; desktop profiles use
`q=low` there because a GPU-less runner renders full quality at 1-3 fps). Logs are public at
`https://api.github.com/repos/Kh3rwa1/khuntau/actions/runs`.

```
npm install                 # wrangler + puppeteer (downloads its own Chrome)
npx wrangler dev            # local game with the Worker, Durable Objects and API
npx wrangler deploy         # deploy to khuntau.dulalkisku0.workers.dev (cloud sessions: token is in the environment)
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
- `public/life.js`: village life (chickens that scatter, goats, birds, butterflies, cooking smoke, straw stacks, yard
  pots/cots/firewood), loaded after the villagers; one instanced or baked mesh per kind (~8 draw calls); scales with QUALITY.
- `public/story.js`: story mode "Sohrai Day", loaded with `import()` after the game boots. It receives what it
  needs from index.html as one object `C` (see `initStory(C)`); keep it that way instead of reaching into globals.
- `public/stats.html`: funnel of the anonymous step counts (visits, PLAY, rounds, shares, challenge opens, returns, load time).
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
- One game (since 21 Nov): home PLAY opens the village (`story.start()`); the khunt in the middle offers a normal scored round
  (RING) at any time, `game.villageRun`, with ticket, board, village credit, XP and Share; game over offers Back to village.
  The story's 3-pitha finale (chapter 4, START) still uses `game.storyRun`. "Quick round at the khunt" and challenge links
  (`?beat=`) go straight to the ring; online stays ring-only. Hindi covers village rounds (`L()` in index.html).
- Story mode (`story.js`), progress in `khuntau-story`, language in `khuntau-lang`:
  1. Wake in the mud house; drink handi (also eat pitha, rest, talk to Gogo). 2. Paint 3 wall motifs.
  3. Cattle shed: choose animal, oil horns, garland. 4. Tamak/tumdak rhythm game; dancers, Majhi and the animal
  react to every hit. 5. Ring finale: 3 pitha. Then a daily round: archery, fishing, singing at 3 houses
  (drum call-and-response), tamak; +15 XP each once a day.
  One context button (`#actBtn`, E on laptops) does whatever is nearest. Hindi for all story text (pause menu).
- The interior of the house lives under the ground at y = -40 and is shown only while inside.

## Deploy checklist
GitHub CI deploys: every push to `main` runs the full suite, and if it is green and the repo secret
`CLOUDFLARE_API_TOKEN` exists, it runs `wrangler deploy` and checks the live `sw.js` VERSION. So merging to `main`
means going live about 20 minutes later. Before merging:
1. Run `node tests/serve.mjs` + `npm test` (and `wrangler dev --local` + `npm run test:online` for Worker changes);
   look at the screenshots in `tests/out/`.
2. Recompute `VERSION` in `public/sw.js`:
   `python3 -c "import hashlib,os;h=hashlib.sha1();[h.update(open(os.path.join(r,f),'rb').read()) for r,_,fs in sorted(os.walk('public')) for f in sorted(fs) if f!='sw.js'];print(h.hexdigest()[:10])"`
3. Merge to `main` and push; watch the run at `https://api.github.com/repos/Kh3rwa1/khuntau/actions/runs`.
Fallback from the Mac: `npx wrangler deploy`, then `curl -s <site>/sw.js | head -5` to check VERSION.
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
| Draw calls | cut + guarded | garland was 22 meshes (22 calls) on the animal everywhere; merged to 2. Ring 66→46, akhra 107→88, edge 83→63. `tests/calls.mjs` budgets tightened (58/38/92/68, gohal 52, pond 64, Nov 22) and the ring is also measured at the peak of a charge |
| Online rooms, board, tickets | fixed + tested | `tests/online.mjs` (33 checks) and `tests/online-ui.mjs` (two phones: list, ask, accept, start, play); per-IP limits on restore/save/push, room reports throttled |
| Offline / service worker | fixed + tested | `tests/offline.mjs`: boots, story, cow with the server really down; story.js now network-first so a deploy can't pair a new page with old story code |
| Ring game end to end | tested | `tests/ring.mjs`: grab, refill, bait+hit, roll dodge, handi, game over, score on the board, play again |
| Drum timing | fixed + tested | `tests/drum.mjs` (incl. real pad pointerdown path; clicks proven heard on the beat within 2.2 ms with a 120 ms speaker lag): clicks booked on the audio clock minus speaker delay; taps use the touch time; late taps no longer marked Miss before they land; oldest open note gets the tap; each phone learns its offset (`khuntau-drumlag`) |
| Busy server (429) on shared mobile IPs | fixed + tested | per-IP limits roomy for carrier NAT (30 new saves/min); keep-progress and reminders say 'try again in a minute' instead of blank/false errors; `tests/busy.mjs` |
| Hindi coverage | fixed + tested | `HI=1` runs of story1/story3 fail on any English word on screen; the ring finale's own lines and buttons now go through the story's translator; the singing objective key never matched |
| In-game credits text, banana leaves | fixed | Credits name Dulor's music and three.js/fonts; leaves rebuilt (YXZ lean, lit), `arch-p-1aim.jpg` |
| Deploy | live | Deployed 21 Nov from the cloud session (sw VERSION d8a2a98c4a, live files match the repo byte for byte, live phone smoke test clean). Cloud sessions have `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` and `api.cloudflare.com` allowed: `npx wrangler deploy` works here. CI (`.github/workflows/ci.yml`) also deploys green `main` when the repo secret is set |
| Slow-phone safety net | tested | `tests/slowphone.mjs`: CPU throttled 6x, auto quality on: steps itself down, remembers it, story still walks |
| Real-phone feel on the A34 | needs Dulor's phone | open `https://khuntau.dulalkisku0.workers.dev/?fps` on the A34 after the next deploy: read the meter in the village and at the akhra (green 45+, yellow 28+, red below); play the drum chart twice and say early/late/fine; try archery and say if the crosshair moves too fast/slow for your drag and if the sway feels fair |
| Santali story text | plumbing ready, needs a Santali speaker | `design/santali-strings.csv` (183 lines, English + Hindi, empty Santali column); `node tools/santali-import.mjs` puts it in the game; the language button offers Santali once text exists, in Ol Chiki font; `tests/santali.mjs` proves the path with marker text. Never machine-translate it |
| Customs order and details | needs Dulor | `design/customs-check.md`: 10 questions, one per custom shown; answer OK / wrong / in my village |
| Story mode multiplayer | design choice | single-player by design; the ring is the online mode |
| Play Store (TWA, `com.tumdah.khuntau`) | ready to build, needs Dulor's account | manifest has id, description, maskable icon; Chrome says installable (`offline.mjs`). `twa/twa-manifest.json` + `twa/README.md` (build, signing, assetlinks). Dulor: Play developer account type + creation date (personal accounts after Nov 2023 need a 12-tester, 14-day closed test), then build once on the Mac |
| Know what players do | built + tested | anonymous step counts (no ids/cookies): `track()` in index.html, `/api/ev` + `/api/stats` in the Worker (whitelisted names, per-IP limit), funnel page `/stats.html`. `online.mjs` + `ring.mjs` (against wrangler) prove the game reports its steps |
| First load on a phone | faster + measured (live: fast 3G 9.2 s -> 7.4 s to PLAY, 1456 -> 826 KB before PLAY; slow 4G 5.1 -> 5.0 s, CPU-bound) | PLAY waits only for bull + player models (villagers load after); offline copy (~7 MB) downloads after the game is up instead of during boot; 300 KB title font subset to 200 KB and loaded after PLAY. Local uncompressed fast-3G: 27.9 s -> 20.3 s to PLAY. Live before: 9.2 s fast 3G, 5.1 s slow 4G |
| Village vs village | built + tested | choose district + village (home line, or asked after a first scoring round); spelling variants merge (NFKC key per district), existing villages suggested; a change counts from the next day; village score = its 10 best players' daily bests (solo and room scores); shown only with 3+ players; `HIDDEN_VILLAGES` in worker.js hides a name (add its key, deploy); Villages tab on the board, rank on the home line, share text names your village and the one right above. `online.mjs` (rules) + `village.mjs` (phone/laptop/landscape) |
| District list | needs Dulor | Jharkhand's 24 plus WB/Odisha/Bihar/Assam districts with Santal villages, and 'Other district'. Dulor: check the list (`DISTRICTS` in index.html and worker.js) and say which are missing or wrong; is village + district the right unit, or block? |
| Story and ring were two separate games | merged | one PLAY into the village; khunt rounds scored from the first visit; Back to village; Enter on home = PLAY. `tests/merged.mjs` (new player: village, khunt round, board, back, quest intact; challenge link straight to ring; Hindi round) |
| Village felt empty | detail added | `life.js`: chickens peck in the front yards and scatter from you and the bull, goats graze, birds circle, butterflies (not on budget phones), cooking smoke over the roofs, straw stacks, clay pots, rope cots, firewood. No downloads; ~8 draw calls (ring 46->54, all views inside budgets). Customs-specific decorations wait for Dulor |
| Ring and bull felt plain; resting didn't lie you down | detail added | REST: sit, lie on the khatia (head on pillow, breathing), get up. Ring: bull breath puffs and pawing dust in the windup, fading hoof prints along charges, post shudders on a bonk, marigold petals on a snatch, brass bell on the garland swings. Effect pools hidden when idle (ring 57/60 calls). `merged.mjs` (rest) + `ring.mjs` (breath, prints, petals) |
| Village people looked the same and stood still | detail added | spectators turn to watch the bull (whole body, within 60 deg of their spot), flinch when he winds up or slams the post, groan when you are hit. Accessories folded into each person's skinned mesh (no extra draw calls): women bead necklaces + bangles, men a gamchha round the neck with ends down the chest, colours per person (`ACC`/`accessories()` in index.html). Fixed an old bug: every man built after the player (villagers, drummers, Majhi) wore a copy of the player's colours. `ring.mjs`: crowd flinch/watch, accessories move with the body |
| Houses were boxes with a cone | detail added | raised mud plinth + door step, wooden door frame with a half-open plank door, barred side windows, two-tier thatch with a top knot, rafter ends under the eave; every third house a clay-tile roof. Walls of all 9 houses merged into one draw (tiling moved into UVs); plinth/wood/doorways/windows share one vertex-coloured material. Ring 58/60, yard 30/40, akhra 96/105 (no worse than before) |
| Bull needed more life | detail added | `bullDetail()` after its animation: tail swish (lazy / agitated in windup / up in a charge), head shake after a bonk, eye whites redden with fury, hooves and legs gather dust over a round, vermilion mark on the forehead once decorated (bull only; folded into its skinned mesh and fitted to the head surface). Bones and colours only: no draw calls. `ring.mjs` checks vermilion, eyes, dust, tail bounded |
| Village needed everyday life | detail added | worn dirt paths from the ring to every door (with rocks), a hand pump with a bucket (gap 2.5), a bullock cart (gap 7.5), a clothesline of drying cloths (gap 5.5), fenced kitchen gardens behind houses 1/3/6/8, four big trees inside the village edge. All in the houses' shared vertex-coloured mesh or the tree meshes: no extra draw calls (ring 57/60), ~7.5k triangles. `villageProps` (index.html) gives the story's collision and the animals' wandering their footprint. Gaps 1.5/3.5/4.5/6.5 are taken by archery/gohal/pond/akhra |
| Ring details cost a draw call per diya/dust puff | batched + detail added | 30 diya flames and the dust/spark pools were one `THREE.Sprite` (one draw) each: a charge peaked at 76 calls on phones. Now `billboards()` (one InstancedMesh per pool, per-instance alpha): ring 51 quiet / 52 at a charge peak, akhra 88->79, edge 63->58. Added: teardrop diya flames that flicker, lean in the breeze and gutter when you run or roll past; clay cups with spouts; jute rope that sags with its slack, lies in the dust near the post, goes straight when pulled and twangs when it snaps tight; post merged into one mesh (6 draws -> 1) with rope wraps + frayed tail, horn gouges, mud-stained foot, packed-earth mound; dirt remembers the bull (dark churned track at rope's end with hoof pocks, pale scuffed patch round the post, rope-swept arcs). Budget phones' 6 spectators now stand in an arc on the far side instead of spread round 360 degrees (the camera saw 1-2). twang fires on crossing to taut while closing fast (frame-rate independent; rope length 6.7 checked for bull 6.93 and cow 6.87). Thinned crowds keep the centre slots. `calls.mjs` (peak run must see a snatch, a charge, dust and sparks live; batching), `ring.mjs` (rope slack/taut, never through the ground, twang at 120 Hz, thinned crowd in view). CI's red 'accessories move' check was stale bone matrices on a runner that drew no frame: the probe now refreshes the whole character (reproduced by freezing the render loop) |
| Gogo looked like a man (all women wore T-shirt + trousers) | fixed + test | Gogo is the mother ("gogo" = mother in Santali; `customs-check.md` said grandmother by mistake, corrected; her Hindi verbs were already feminine). Women (woman + worker models) wear a sari folded into their skinned mesh, no draw calls: skirt fitted by rays from the hip axis against the body's own vertices, tight at the hips (hands hang there in Idle), lower skirt follows the thighs, extra room front/back for a striding knee; border band; pallu across the chest over the left shoulder. Colours from each woman's own palette (Gogo cream/red); women past the 4 looks get their own sari colour so nobody dresses like Gogo; online players' sari border = player colour. Worker women lost the hard hat. Weak spot: a knee notch can show mid-stride in Walk/Run. `merged.mjs` (sari parts, colours, no hats, no sari on men, waist-to-ankle skirt). Dulor: question 11 (sari, pallu, colours, Gogo's age) |
| Akhra was a dirt disc and two drums | detail added | painted floor from real positions: broom strokes, a worn band with footprints exactly under the dancers' line (r 15.4), a trodden patch at the drummer's spot; dust where dancers' feet land on each beat; water pot + brass lota beside the tamak, spare sticks, elders' log bench and a rope cot at the sides, a big shade tree beside it (off the note lanes). Props + the tumdak cradle in one vertex-coloured draw: akhra stays 79/92. Not added (customs, ask first): an earth platform round the tree, sandals at the edge. `drum.mjs` (dust on the beat, props solid), `walk.mjs` (no stalls) |
| Gohal was four poles, a box trough and a beige disc | detail added | straw-bedded floor trampled to mud with hoof marks where the animal stands; woven bamboo wattle back wall behind the rails; hollowed log trough with green fodder on two blocks; clay water basin; hay heaped from 90 loose straws (spheres read as boulders); tether peg with its rope coiled at the foot; rake leaning on the back post. Posts, rails and all props in one vertex-coloured draw (was two): gohal view 45 calls, new budget 52 in `calls.mjs`. No beams/rafters/fringe: the roof fades whenever you are close, so they only ever showed as bars across the view. Picker camera moved between the posts: the front post used to stand right in front of the animal's head while choosing (`p-08-pick.jpg`) |
| Pond was a blue disc, and you fished with an empty hand | detail added | bamboo rod in the right hand, aimed out over the water each frame (raised to cast, lowered to the float, trembling on a bite, jerked up on a catch; fixed to the fist it pointed at the ground) and a line with a little sag from its tip to the float; water deep in the middle, shallow and green at the edge with a sky sheen and drifting wavelets; ripple rings on cast, bite and catch, from rising fish and behind the ducks (one instanced draw, hidden when still); three ducks paddling round (one instanced draw); lily pads with lotus (two rings of petals), reed clumps with cattails kept off the camera side, stones, a washing stone with a clay pot, a wet dark bank. Static parts one draw (replaced 7 reed meshes): pond view 56 -> 58 calls, budget 64 in `calls.mjs`. Bank/water/wavelet depth offsets made small: a big one buried the lily pads at low camera angles. `story3.mjs` (rod raised over the water, line tip-to-float, ripples, ducks move) |
| Archery: a pistol pose and no bow; target, arrows and leaves cost 31 draws | detail added + batched | a long bamboo bow (1.8 m, cloth grip) held up in the raised hand, a little toward the camera and canted (behind the body it was invisible), string drawn back while you drag, an arrow on the string that leaves from the bow; the shooting clip is frozen with the arm raised between arrows. Target: banana trunk with sheath stripes, rope lashings, an earth mound, old arrow holes off the face, cut sheath stubs, drooping torn leaves; hits throw banana fibre; misses stick in the ground past the target instead of vanishing. Lane worn into the grass, spare arrows stuck in the ground at the line, marker pegs. Target (6 draws) and leaves (5) are one mesh each; the 5 arrows (20 draws) + the nocked one are one instanced mesh: akhra view 79 -> 74, pond 58 -> 52. `story3.mjs` (bow held with an arrow on the string, arrows stay where they went, bow put away) |
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
