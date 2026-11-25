#!/usr/bin/env python3
# Builds public/art/murals.webp + murals.json: the painted figures on the houses' black wall bands.
#   python3 tools/murals.py design/murals/murals.json
# The spec (design/murals/murals.json) lists source images (made from Dulor's photos, see CLAUDE.md "Nano Banana")
# and the boxes to cut from them, in source pixels: {"src": "dancers.png", "box": [x0, y0, x1, y1]}.
# Each cut: the dark background that touches its edges is repainted the band's own charcoal (#2c2e30, as drawn by
# houseWallTex in index.html) with the same grit, its edges fade out, and it is packed into rows of one atlas.
# The game reads cell rectangles in UV space (v up, as three.js flips images), each cell's width/height and its use:
# "wall" (house murals), "motif" (also one of the story's three wall motifs), "face" (a dialogue portrait: written as its
# own face-<name>.webp and listed under "faces", never on a wall or in the atlas).
import json, os, random, sys
from PIL import Image, ImageDraw

BAND = (0x2c, 0x2e, 0x30)
CELL_H = 300          # every cut is scaled to this height (a panel is about 1 m tall: ~300 px is plenty on a phone)
ATLAS_W = 1024
PAD = 6               # transparent gap between cells, so mip levels do not bleed one cell into the next
FEATHER = 0.07        # share of the width/height over which a cell's edges fade out


def cut(src_path, box, tol, raw=False, dots=()):
    """One cell: repaint the dark background connected to the cut's border (inner dark outlines are kept), scale,
    fade the edges. dots: [x, y, radius] in source pixels, painted out first (a forehead dot the image tool added:
    the women on the wall in Dulor's photos have none; see tools/days.py)."""
    im = Image.open(src_path).convert('RGB')
    for i, (dx, dy, dr) in enumerate(dots):
        from days import paint_out
        paint_out(im, dx, dy, dr, 'skin', 50 + i)
    im = im.crop(box)
    if raw:  # a portrait for the dialogue box: kept as painted, opaque, no fade
        return im.resize((round(im.width * CELL_H / im.height), CELL_H), Image.LANCZOS).convert('RGBA')
    w, h = im.size
    probe = im.copy()
    key = (255, 0, 255)
    # the painting's own background colour: the median of its four corners (grass or a figure touching an edge is
    # never a seed, so it is never repainted)
    corners = sorted(im.getpixel((x, y)) for x in (2, w - 3) for y in (2, h - 3))
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    near_bg = lambda p: all(abs(p[i] - bg[i]) < 24 for i in range(3)) and sum(p) < 3 * 90
    seeds = [(x, y) for x in range(0, w, 6) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 6) for x in (0, w - 1)]
    for s in seeds:
        p = probe.getpixel(s)
        if p != key and near_bg(p):
            ImageDraw.floodfill(probe, s, key, thresh=tol)  # thresh: summed difference over R, G, B from the seed
    px, pp = im.load(), probe.load()
    rnd = random.Random(7)
    for y in range(h):
        for x in range(w):
            if pp[x, y] == key:  # background: the band's charcoal with a little grit, like the wall around it
                n = rnd.randint(-5, 5)
                px[x, y] = (BAND[0] + n, BAND[1] + n, BAND[2] + n)
    im = im.resize((round(w * CELL_H / h), CELL_H), Image.LANCZOS)
    w, h = im.size
    alpha = Image.new('L', (w, h), 255)
    a = alpha.load()
    fx, fy = max(1, int(w * FEATHER)), max(1, int(h * FEATHER))
    for y in range(h):
        for x in range(w):
            k = min(1.0, x / fx, (w - 1 - x) / fx, y / fy, (h - 1 - y) / fy)
            a[x, y] = int(255 * max(0.0, k))
    im.putalpha(alpha)
    return im


def main(spec_path):
    spec = json.load(open(spec_path))
    base = os.path.dirname(spec_path)
    out_dir = spec.get('out', 'public/art')
    os.makedirs(out_dir, exist_ok=True)
    # portraits are shown in the HTML dialogue box, not drawn in 3D: each its own small file, kept off the GPU atlas
    faces = {}
    for c in spec['cuts']:
        if c.get('use') != 'face':
            continue
        im = cut(os.path.join(base, c['src']), c['box'], 0, raw=True, dots=c.get('dots', ())).convert('RGB')
        fn = 'face-' + c['name'].lower() + '.webp'
        im.save(os.path.join(out_dir, fn), 'WEBP', quality=84, method=6)
        faces[c['name']] = {'file': fn, 'aspect': round(im.width / im.height, 4)}
    wall_cuts = [c for c in spec['cuts'] if c.get('use') != 'face']
    cells = [cut(os.path.join(base, c['src']), c['box'], c.get('tol', 38)) for c in wall_cuts]
    # shelf packing
    x = y = row_h = 0
    places = []
    for im in cells:
        if x + im.width > ATLAS_W:
            x, y = 0, y + row_h + PAD
            row_h = 0
        places.append((x, y))
        x += im.width + PAD
        row_h = max(row_h, im.height)
    used_h = y + row_h
    atlas_h = -(-used_h // 16) * 16  # WebGL2 needs no power of two: no empty rows on the GPU
    atlas = Image.new('RGBA', (ATLAS_W, atlas_h), BAND + (0,))
    out_cells = []
    for im, (cx, cy), c in zip(cells, places, wall_cuts):
        atlas.paste(im, (cx, cy))
        out_cells.append({'u0': round(cx / ATLAS_W, 5), 'u1': round((cx + im.width) / ATLAS_W, 5),
                          'v0': round(1 - (cy + im.height) / atlas_h, 5), 'v1': round(1 - cy / atlas_h, 5),
                          'aspect': round(im.width / im.height, 4), 'name': c.get('name', c['src']),
                          'use': c.get('use', 'wall')})  # wall: house murals; motif: also the story's wall motifs; face: portraits only
    atlas.save(os.path.join(out_dir, 'murals.webp'), 'WEBP', quality=82, method=6)
    json.dump({'image': 'murals.webp', 'w': ATLAS_W, 'h': atlas_h, 'cells': out_cells, 'faces': faces},
              open(os.path.join(out_dir, 'murals.json'), 'w'), indent=1)
    print(f"{len(out_cells)} cells, atlas {ATLAS_W}x{atlas_h}, {os.path.getsize(os.path.join(out_dir, 'murals.webp')) // 1024} KB")


if __name__ == '__main__':
    main(sys.argv[1])
