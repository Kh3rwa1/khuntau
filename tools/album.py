#!/usr/bin/env python3
# Builds the album's paintings (public/album.js) from design/album/:
#   python3 tools/album.py design/album/album.json
#   public/art/finds.webp     the ten things to find in the village, one square stamp each, in a grid read by position
#                             (the order of "finds" in the spec = the order of SIGHTS in public/story.js)
#   public/art/complete.webp  the keepsake for keeping all five festival days (4:5, like art/day1-5.webp)
# Each stamp: the cut's dark background is repainted the wall band's own charcoal (as tools/murals.py does), then it is
# set in the middle of a charcoal square, so no stamp shows the edge of its cut.
import json, os, random, sys
from PIL import Image, ImageDraw

BAND = (0x2c, 0x2e, 0x30)
MARGIN = 0.07  # empty wall round a stamp, as a share of the cell


def grit(size, seed):
    im = Image.new('RGB', size, BAND)
    px, rnd = im.load(), random.Random(seed)
    for y in range(size[1]):
        for x in range(size[0]):
            n = rnd.randint(-4, 4)
            px[x, y] = (BAND[0] + n, BAND[1] + n, BAND[2] + n)
    return im


def stamp(src_path, box, cell, seed, tol=40, fade=None):
    im = Image.open(src_path).convert('RGB').crop(box)
    w, h = im.size
    probe, key = im.copy(), (255, 0, 255)
    corners = sorted(im.getpixel((x, y)) for x in (2, w - 3) for y in (2, h - 3))
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    near = lambda p: all(abs(p[i] - bg[i]) < 26 for i in range(3)) and sum(p) < 3 * 95
    for s in [(x, y) for x in range(0, w, 5) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 5) for x in (0, w - 1)]:
        p = probe.getpixel(s)
        if p != key and near(p):
            ImageDraw.floodfill(probe, s, key, thresh=tol)
    mask = Image.new('L', (w, h), 255)  # 255 = painting, 0 = background
    mp, pp = mask.load(), probe.load()
    for y in range(h):
        for x in range(w):
            if pp[x, y] == key:
                mp[x, y] = 0
    if fade:  # a scene that runs to the edge of its cut (a field, a table): those edges fade into the wall, [left, top, right, bottom] as shares
        mp = mask.load()
        for y in range(h):
            for x in range(w):
                f = min(x / (fade[0] * w) if fade[0] else 1, y / (fade[1] * h) if fade[1] else 1, (w - 1 - x) / (fade[2] * w) if fade[2] else 1, (h - 1 - y) / (fade[3] * h) if fade[3] else 1, 1)
                if f < 1:
                    mp[x, y] = int(mp[x, y] * f * f * (3 - 2 * f))
    k = cell * (1 - 2 * MARGIN) / max(w, h)
    size = (max(1, round(w * k)), max(1, round(h * k)))
    im, mask = im.resize(size, Image.LANCZOS), mask.resize(size, Image.LANCZOS)
    out = grit((cell, cell), seed)
    out.paste(im, ((cell - size[0]) // 2, (cell - size[1]) // 2), mask)
    return out, mask.histogram()[128:].__len__() and sum(mask.histogram()[129:]) / (size[0] * size[1])


def main(spec_path):
    spec, base, out_dir = json.load(open(spec_path)), os.path.dirname(spec_path), 'public/art'
    cell, cols, finds = spec['cell'], spec['cols'], spec['finds']
    rows = -(-len(finds) // cols)
    atlas = grit((cell * cols, cell * rows), 1)
    for i, f in enumerate(finds):
        im, cover = stamp(os.path.join(base, f['src']), f['box'], cell, 10 + i, f.get('tol', 40), f.get('fade'))
        atlas.paste(im, ((i % cols) * cell, (i // cols) * cell))
        print(f"  {f['id']:9s} {f['src']} {f['box']}  painted {cover:.0%} of its cut")
    atlas.save(os.path.join(out_dir, 'finds.webp'), 'WEBP', quality=84, method=6)
    print(f"finds.webp {atlas.size[0]}x{atlas.size[1]}, {len(finds)} stamps, {os.path.getsize(os.path.join(out_dir, 'finds.webp')) // 1024} KB")
    c = spec['complete']
    im = Image.open(os.path.join(base, c['src'])).convert('RGB')
    # the plain wall above and below the scene is left for words: paint out the few white dots there (small light
    # specks on the dark wall read as stars, and no day of Sohrai is shown at night)
    px = im.load()
    for x0, y0, x1, y1 in c.get('plain', []):
        for y in range(y0, min(y1, im.height)):
            for x in range(x0, min(x1, im.width)):
                p = px[x, y]
                if sum(p) > 3 * 78 and max(p) - min(p) < 40:  # light and grey: a dot, not the wall, the thatch or the earth
                    for d in range(1, 30):  # the nearest wall colour to the left or right
                        q = px[max(0, x - d), y]
                        if sum(q) <= 3 * 62:
                            px[x, y] = q
                            break
                        q = px[min(im.width - 1, x + d), y]
                        if sum(q) <= 3 * 62:
                            px[x, y] = q
                            break
    w, h = im.size
    th = round(w / 0.8)  # 4:5
    if th <= h:
        im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    else:
        tw = round(h * 0.8)
        im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h))
    im = im.resize((864, 1080), Image.LANCZOS)
    im.save(os.path.join(out_dir, 'complete.webp'), 'WEBP', quality=84, method=6)
    print(f"complete.webp {im.size[0]}x{im.size[1]}, {os.path.getsize(os.path.join(out_dir, 'complete.webp')) // 1024} KB")


if __name__ == '__main__':
    main(sys.argv[1])
