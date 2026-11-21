# Game Brief: Khuntau · Sohrai Day (story mode)

Format: the one-page brief from donchitos/claude-code-game-studios (`.claude/docs/templates/game-brief.md`),
used through its "bring a game you already have, then grow it one feature at a time" route.

## In your words
"add story to the game, more like GTA-VI i mean character can enter the mud house and drink Handi and other
things. make sure the game is playable on mobile phone as well my main market is mobile user. also plan properly.
i want the cow to be replaceable with bull and other cow. also character can beat the Tamak and must react to the
sound. and other sohrai activity. use free 3D models."

**Pitch:** Walk your own Santal village on Sohrai morning, drink handi at home, paint the wall, dress the bull,
beat the tamak until the whole village dances, then face the animal at the khunt.

**Genre:** small open-village story game (walk, talk, short activities) wrapped around the existing arena game.

**Controls:** phone first. Left thumb drags to walk, right thumb drags to look, one big button does whatever is
nearest (ENTER, DRINK, PAINT, BEAT…). Two drum pads during drumming. Keys: WASD, E, J/K for the drums.

**Question:** does a five-minute walk through Sohrai make people come back to the ring game, and share it?

**Hooks:** the tamak. Every hit you make is heard: the dance line steps on your beat, cattle lift their heads.

**Intent:** soft failure in the village (nothing can be lost); the real risk stays in the ring *(provisional)*.

## Look and references
- Look: the game's existing low-poly Sohrai look. Red earth, rice-paste white, lamp saffron. Mud house with a
  banded wall, thatch, a khatia, a chulha, handi pots. Every figure is a model, no emoji.
- References: GTA (walk anywhere, go indoors, one context button), *(guessed)* A Short Hike (small world, short tasks).
- View: 3D · Camera: third person behind the player, drag to turn, closer indoors.

## First minute
You wake inside the mud house. Mother says Johar and points at the handi. One tap: you drink. The door glows; you
step out into the village, the ring ahead, drums far off. A marker shows the wall that needs painting.

## Challenge
The village cannot be failed. Two things take skill: the tamak (hit 10 of 16 beats or the dancers stop) and the
ring finale (snatch 3 pitha with 3 lives, the same rules as the arena game).

## Core loop
- Follow the marker → do a 20–40 second Sohrai activity → the village changes (painted wall, dressed bull, dancers).
- Finish the day at the khunt → points, XP and a shirt → play the ring again, or roam and drum freely.

## Goal & fail state
- A sitting is complete when the five chapters are done and you have snatched 3 pitha in the ring.
- Only the ring can be lost (3 lives); you return to the village and can try again.

## Features
- [ ] Free walk around the village with a follow camera and house collisions
- [ ] Enter the mud house; drink handi, eat pitha, talk to mother
- [ ] Paint three Sohrai motifs on the house wall
- [ ] Cattle shed: choose the animal (3 bulls, 2 cows), oil the horns, garland it
- [ ] Tamak and tumdak: rhythm game; villagers dance on each hit, cattle react; free drumming afterwards
- [ ] Ring finale with the chosen animal; ending and reward
- [ ] Animal choice also on the home screen for the normal game

## Your systems
- story / chapters · in the slice
- enter the mud house · in the slice
- drink handi and "other things" (eat pitha, rest) · in the slice
- replaceable animal (bull, other bulls, cows) · in the slice
- beat the tamak, characters react to the sound · in the slice
- other Sohrai activities: wall painting, dressing the cattle, the dance line · in the slice
- other Sohrai activities: archery contest, house-to-house singing, fishing · later

## Avoid
- Paid assets. Models are Quaternius (CC0). Everything else is built in code.
- Anything that makes budget phones slower than the arena game already is.

## Out of scope
- A big map, vehicles, combat, money, inventory: this is one village, not GTA-size.
- Story mode with friends online (the ring stays the online mode).
- Voiced dialogue. Santali text for the story (English first, strings are in one table for translation).
- Day and night; Khuntau happens in the day.

## Build order
1. Tamak with reacting villagers (the hook, and the riskiest for feel on a phone).
2. Free walk + enter the mud house + handi.
3. Animal choice and the cattle shed.
4. Wall painting, chapters, markers, ring finale.
5. Home-screen entry, saving, offline cache, phone checks.

---
**Kill condition:** if budget phones drop below the arena game's frame rate in the village, cut dancers before anything else.

**Who it's for / what they feel:** Santal players on phones, and their friends: "that is my village, that is my festival."
