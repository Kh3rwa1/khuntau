#!/usr/bin/env python3
# Builds the festival day paintings the game shows (public/art/day1-5.webp, 4:5) from design/days/d1-5.jpg, and the
# score card's painting (public/art/card.webp) from design/murals/card.jpg.
#   python3 tools/days.py
# The image tool gave four women a forehead dot (a bindi). The women painted on the Santal house wall in Dulor's
# photos have none, so the dots are painted out here, at build time: the sources stay as they were made.
import os, random
from PIL import Image

DOTS = {  # (x, y, radius, how): 'skin' on a forehead, 'edge' where the dot sits on the outline of a face in profile
    'd1.jpg': [(263, 515, 5, 'edge')],   # the woman painting the wall
    'd2.jpg': [(373, 486, 5, 'skin')],   # the woman drawing the alpana
    'd3.jpg': [(781, 578, 4, 'skin')],   # the elder woman watching
    'd5.jpg': [(659, 384, 4, 'skin')],   # the woman with the basket of fish
}
CARD_DOTS = [(45, 670, 3, 'skin'), (871, 491, 3, 'skin'), (858, 570, 3, 'skin'), (858, 655, 3, 'skin')]  # four women watching the Khuntau


def paint_out(im, x, y, r, how, seed):
    px, rnd = im.load(), random.Random(seed)
    if how == 'edge':
        # each column is filled from the pixel just above the disc to the pixel just below, so the face's outline and
        # the wall behind it carry on through the dot
        for i in range(x - r, x + r + 1):
            h = int(round((r * r - (i - x) ** 2) ** 0.5))
            y0, y1 = y - h - 2, y + h + 2
            a, b = px[i, y0], px[i, y1]
            for j in range(y0 + 1, y1):
                k, n = (j - y0) / (y1 - y0), rnd.randint(-1, 1)
                px[i, j] = tuple(int(round(a[c] * (1 - k) + b[c] * k)) + n for c in range(3))
        return
    # the skin round it: the ring just outside the disc, counting only warm, light pixels (not hair, outline, wrinkle
    # lines or the wall), so the patch is the forehead's own colour
    ring = [px[i, j] for j in range(y - r - 6, y + r + 7) for i in range(x - r - 6, x + r + 7)
            if r + 2 <= ((i - x) ** 2 + (j - y) ** 2) ** 0.5 <= r + 6]
    warm = [c for c in ring if c[0] - c[2] > 55 and c[0] > 130]
    warm.sort(key=sum)
    warm = warm[len(warm) // 3:] or ring  # the lighter two thirds: shading lines out
    skin = tuple(sum(c[k] for c in warm) // len(warm) for k in range(3))
    for j in range(y - r - 2, y + r + 3):
        for i in range(x - r - 2, x + r + 3):
            d = ((i - x) ** 2 + (j - y) ** 2) ** 0.5
            k = 1.0 if d <= r else max(0.0, 1 - (d - r) / 1.6)
            if k <= 0:
                continue
            n, p = rnd.randint(-1, 1), px[i, j]
            px[i, j] = tuple(int(round(p[c] * (1 - k) + (skin[c] + n) * k)) for c in range(3))


def main():
    for n in range(1, 6):
        name = f'd{n}.jpg'
        im = Image.open(os.path.join('design/days', name)).convert('RGB')
        for i, (x, y, r, how) in enumerate(DOTS.get(name, [])):
            paint_out(im, x, y, r, how, n * 10 + i)
        w, h = im.size
        th = round(w / 0.8)
        im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
        out = f'public/art/day{n}.webp'
        im.save(out, 'WEBP', quality=78, method=6)
        print(f"{out} {im.size[0]}x{im.size[1]} {os.path.getsize(out) // 1024} KB, {len(DOTS.get(name, []))} dot(s) painted out")
    im = Image.open('design/murals/card.jpg').convert('RGB')
    for i, (x, y, r, how) in enumerate(CARD_DOTS):
        paint_out(im, x, y, r, how, 90 + i)
    im.save('public/art/card.webp', 'WEBP', quality=80, method=6)
    print(f"public/art/card.webp {im.size[0]}x{im.size[1]} {os.path.getsize('public/art/card.webp') // 1024} KB, {len(CARD_DOTS)} dot(s) painted out")


if __name__ == '__main__':
    main()
