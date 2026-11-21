KHUNTAU ONLINE: deploy to your free Cloudflare account

1. Unzip this folder somewhere, e.g. ~/projects/khuntau-online
2. Open Terminal in that folder and run:

   npx wrangler login      (opens your browser; click Allow)
   npx wrangler deploy

3. Wrangler prints your game link, like:
   https://khuntau.<your-subdomain>.workers.dev

Share that link. Players tap "Create a room", then "Invite on WhatsApp".

Free plan is enough for a hobby game. Rooms run on Durable Objects
(free tier); a busy festival evening with a few rooms is well inside it.

Credits: bull, cow and villager models by Quaternius (CC0).

Audio:
- Intro and gameplay music: supplied by the game's owner.
- Sound effects found through Openverse (openverse.org), hosted on Freesound:
  Horse(snort)_2 by o_ciz (CC0), bull 6 (C) by confusion_music (CC BY 4.0,
  https://freesound.org/people/confusion_music/sounds/103428), R14-05 Horses Gallop By
  by craigsmith (CC0), Clothed Body Hit 2 by Flem0527 (CC0), Punch (2) by johnfolker (CC0),
  Whoosh #1 by Kinoton (CC0), Wood Knock Clean Close by Geoff-Bremner-Audio (CC0),
  Whip Crack by SciFiSounds (CC0), Sleigh bells hit by Selector (CC0),
  Crowd Cheer by user 781461 (CC0), Crowd Cheering by user 15857333 (CC0),
  High Five_01 by user 121053699 (CC0), Hand Clap 1 by ShirabeKirariChan (CC0).

Voice relay (so voice chat works across different networks):
1. dash.cloudflare.com -> Realtime -> TURN Server -> Create. Copy the Turn Token ID and the API Token.
2. In this folder run, pasting each value when asked:
     npx wrangler secret put TURN_KEY_ID
     npx wrangler secret put TURN_KEY_API_TOKEN
3. npx wrangler deploy

Offline play (v22)
- three.js (MIT, see public/vendor/three/LICENSE) and the fonts Rubik Dirt, Baloo 2 and Noto Sans Ol Chiki
  (SIL Open Font License, from Google Fonts) are now served from this site, so the game needs no other website.
- public/sw.js keeps a copy of the game on the phone after the first visit, so solo play works with no internet.
  Its VERSION line is a fingerprint of the files; it changes when the files change.

Story mode (v23): "Story: Sohrai Day" on the home screen. Walk the village, go into the mud house, drink handi,
paint the wall, choose and dress the animal (3 bulls, 2 cows), beat the tamak so the village dances, then win
3 pitha at the khunt. The code is in public/story.js; the one-page plan is in design/story-brief.md.
The animal for the normal game is changed from the home screen ("In the ring: ... Change").

v24: village activities with a daily round (archery, fishing, singing at three houses, tamak: +15 XP each, once a day),
Hindi for the story (Pause > हिन्दी), wider drum timing on touch, horns reset after the story.
v25: laptops get the big clickable action button (with an E badge) and a how-to-walk hint in story mode.
