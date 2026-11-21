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
npm test                    # with serve.mjs running: story playthroughs at phone and laptop sizes
node tests/walk.mjs         # walking feel: holds the stick into people, fails on any stall over 1 s
```
Run tests from the repo root. Screenshots land in `tests/out/`; look at them, don't just trust "no errors".
`?debug` in the URL exposes `window.__k` (game, story, bull, player, setAnimal, houses, renderer, perf, …);
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
4. Phones that played before need a full close and reopen to pick up the new service worker.

## Known weak points (open)
- Real-phone feel is unverified: frame rate in the village and touch drum timing on the Galaxy A34.
- Archery target is thin and far; hits are hard to see on a small screen.
- Story is English and Hindi only; Santali text not done (needs a Santali speaker to check).
- Customs: the order and details of activities are a best guess; only horn oiling/vermilion and wall painting are
  documented in sources found so far. Dulor should correct anything wrong for his village.
- Story mode is single-player only; the ring stays the online mode.
- Play Store: plan is a TWA built with Bubblewrap, package `com.tumdah.khuntau`; waiting on Dulor's developer
  account type (personal/organisation) and creation date.

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
