# WhatsApp status posters

Four posters, 1080x1920 (9:16), each in English and Hindi: `out/sohrai-<n>-<name>-<en|hi>.jpg`.

| Poster | Says | Picture |
|---|---|---|
| 1 Khuntau | Can you snatch the pitha? | the Khuntau painted on a wall (`public/art/card.webp`) |
| 2 Five days | Five days. One festival. | the five day paintings, each with its name in Ol Chiki |
| 3 Village | Play for your village | the family with their bull (`public/art/complete.webp`) |
| 4 Johar | Sohrai Johar! | the Sarpa enej on the village road (`public/art/day4.webp`) |

Every picture is one the game already carries, made from Dulor's photos of a painted Santal house. The frame is that
house's wall as the game draws it. Words are set by `gen.mjs`, never by an image tool. Ol Chiki only for the names Dulor
has confirmed (the title and the five days); a Santali line needs a Santali speaker to write it.

The top 190 px and the bottom 160 px carry nothing that must be read: WhatsApp lays the sender's name and the reply
field there.

## How to post
A link inside a picture cannot be tapped. Put the link in the caption. This one counts who comes through it
(`open.wa` in `/api/stats`):

    https://khuntau.dulalkisku0.workers.dev/?src=wa

| Poster | English caption | Hindi caption |
|---|---|---|
| 1 | The bull is tied. The pitha is on the post. Can you snatch it? Play Sohrai free: LINK | बैल बँधा है, पीठा खूँटे पर है। छीन सकते हो? सोहराय मुफ़्त खेलो: LINK |
| 2 | Sohrai has five days. Keep all five in your own village: LINK | सोहराय के पाँच दिन, अपने गाँव में मनाओ: LINK |
| 3 | Play for your village. Which village leads today? LINK | अपने गाँव के लिए खेलो। आज कौन सा गाँव सबसे आगे है? LINK |
| 4 | Sohrai Johar! Play the Sohrai game, free: LINK | सोहराय जोहार! सोहराय का खेल मुफ़्त खेलो: LINK |

One a day does more than four at once.

## To change or redo them
    node tests/serve.mjs &            # the game's fonts and paintings
    node promo/posters/gen.mjs

The words are in `POSTERS` at the top of `gen.mjs`. `fonts/baloo-2-devanagari.woff2` is Baloo 2's Devanagari cut
(SIL Open Font License), used only here: the game leaves Hindi to the phone's own font.
