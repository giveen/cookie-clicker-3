#!/usr/bin/env python3
"""Build public/img/foodIcons.png + scripts/foodIcons.manifest.json.

Companion to extract-food-icons.mjs (which validates args); this does the work:

  1. for each PNG in the pack dir, estimate the flat background color from the
     1px border (median -- robust against a few border-touching sprites),
  2. threshold |px-bg| > TOLERANCE into a foreground mask,
  3. find 8-connected components >= MIN_AREA px (drops specks/antialias dust),
  4. split oversized components on their quietest internal gap (touching
     dishes), then drop slivers and still-merged blobs,
  5. crop each sprite, make the background fringe transparent,
  6. NEAREST-NEIGHBOR fit into a 48x48 cell (pixel art keeps hard edges),
  7. pack cells into a 12-wide atlas at public/img/foodIcons.png and write the
     manifest mapping "<sheetFile>#<idx>" -> {cell:[col,row],w,h}.

One pass builds everything in memory; nothing is re-scanned, so the second
write can't drift from the first. Deterministic: sheets sorted by name, sprites
sorted top-to-bottom left-to-right. Cells APPEND: re-running with a bigger pack
keeps earlier manifest entries (and the upgrade declarations using them) stable.

Usage: python3 scripts/extract_food_icons.py <foodPackDir>
"""
import json
import os
import sys

import numpy as np
from PIL import Image

TOLERANCE = 42          # |px-bg|_1 above this = foreground
MIN_AREA = 220          # connected-component min area in px
CELL = 48               # atlas cell size (matches CC3's 48px icon grid)
ATLAS_COLS = 12
PAD = 2                 # transparent margin kept around each sprite crop
SPLIT_MAX_RATIO = 2.4   # a bbox wider/taller than this x median gets split
MIN_KEEP = 40           # sprites smaller than this in either axis are slivers
MAX_KEEP_RATIO = 2.6    # sprites bigger than this x median are still-merged blobs
MIN_SHEET_SPRITES = 8   # fewer kept sprites than this = not a sprite grid
                        # (banner sheets, textured backgrounds) -> skip sheet


def bg_color(arr):
    border = np.concatenate([
        arr[0, :, :], arr[-1, :, :], arr[:, 0, :], arr[:, -1, :]
    ]).astype(int)
    return np.median(border, axis=0)


def mask_of(arr, bg):
    return (np.abs(arr.astype(int) - bg).sum(axis=2) > TOLERANCE)


def components(mask):
    """8-connected components of mask. Returns [(x0,y0,x1,y1,area)]."""
    from collections import deque
    H, W = mask.shape
    lab = np.zeros((H, W), dtype=np.int32)
    out = []
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys, xs):
        if lab[sy, sx]:
            continue
        q = deque([(sy, sx)])
        lab[sy, sx] = 1
        x0 = x1 = sx; y0 = y1 = sy; area = 0
        while q:
            y, x = q.popleft()
            area += 1
            if x < x0: x0 = x
            if x > x1: x1 = x
            if y < y0: y0 = y
            if y > y1: y1 = y
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = 1
                        q.append((ny, nx))
        out.append((x0, y0, x1 + 1, y1 + 1, area))
    return [b for b in out if b[4] >= MIN_AREA]


def quietest_cut(proj, margin=30):
    """Best interior cut index of a 1-D coverage profile: a zero gap if one
    exists, else the quietest interior column/row."""
    interior = proj[margin:-margin]
    zeros = np.nonzero(interior <= 2)[0]
    if len(zeros):
        # first zero run's middle
        run_start = zeros[0]
        run_end = run_start
        for z in zeros:
            if z <= run_end + 2:
                run_end = z
            else:
                break
        return margin + (run_start + run_end) // 2
    return margin + int(np.argmin(interior))


def split_box(mask, box, med):
    """Recursively cut an oversized component bbox on quiet gaps."""
    x0, y0, x1, y1, _ = box
    w, h = x1 - x0, y1 - y0
    if w > SPLIT_MAX_RATIO * med and w >= 120:
        sub = mask[y0:y1, x0:x1]
        cut = quietest_cut(sub.sum(axis=0))
        return split_box(mask, (x0, y0, x0 + cut, y1, 0), med) + \
               split_box(mask, (x0 + cut, y0, x1, y1, 0), med)
    if h > SPLIT_MAX_RATIO * med and h >= 120:
        sub = mask[y0:y1, x0:x1]
        cut = quietest_cut(sub.sum(axis=1))
        return split_box(mask, (x0, y0, x1, y0 + cut, 0), med) + \
               split_box(mask, (x0, y0 + cut, x1, y1, 0), med)
    return [box]


def sprite_tile(arr, bg, box):
    """Crop a sprite to a transparent 48x48 RGBA tile (nearest-neighbor)."""
    x0, y0, x1, y1, _ = box
    crop = arr[y0:y1, x0:x1].astype(int)
    dist = np.abs(crop - bg).sum(axis=2)
    alpha = np.clip((dist - TOLERANCE / 2) * 8, 0, 255).astype(np.uint8)
    rgba = np.dstack([crop.astype(np.uint8), alpha])
    im = Image.fromarray(rgba, 'RGBA')
    max_side = CELL - 2 * PAD
    w, h = im.size
    scale = min(max_side / w, max_side / h, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.NEAREST)
    side = max(im.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2))
    cellim = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cellim.paste(sq, ((CELL - side) // 2, (CELL - side) // 2))
    return cellim


def sheet_tiles(path):
    """All kept boxes of one sheet, in row-major order."""
    arr = np.array(Image.open(path).convert('RGB'))
    bg = bg_color(arr)
    boxes = components(mask_of(arr, bg))
    if not boxes:
        return arr, bg, []
    med = float(np.median([(b[2] - b[0] + b[3] - b[1]) / 2 for b in boxes]))
    out = []
    for b in boxes:
        for s in split_box(mask_of(arr, bg), b, med):
            w, h = s[2] - s[0], s[3] - s[1]
            if w < MIN_KEEP or h < MIN_KEEP:
                continue  # sliver
            if w > MAX_KEEP_RATIO * med or h > MAX_KEEP_RATIO * med:
                continue  # still-merged blob
            out.append(s)
    out.sort(key=lambda b: (b[1] // 60, b[0]))
    return arr, bg, out


def main():
    food_dir = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_png = os.path.join(root, 'public', 'img', 'foodIcons.png')
    out_manifest = os.path.join(root, 'scripts', 'foodIcons.manifest.json')

    files = sorted(f for f in os.listdir(food_dir) if f.lower().endswith('.png'))
    if not files:
        print('no PNG sheets found in', food_dir)
        sys.exit(1)

    # segment every sheet ONCE, in deterministic order
    sheets = {}  # fname -> (arr, bg, kept_boxes)
    tiles = []   # (key, box)
    for fname in files:
        arr, bg, kept = sheet_tiles(os.path.join(food_dir, fname))
        if len(kept) < MIN_SHEET_SPRITES:
            print(f'skipping {fname}: only {len(kept)} sprites found (not a sprite grid)')
            continue
        sheets[fname] = (arr, bg, kept)
        for idx, b in enumerate(kept):
            tiles.append((f'{fname}#{idx}', b))

    # append-only: keep existing manifest entries verbatim
    manifest = []
    if os.path.exists(out_manifest):
        with open(out_manifest) as fh:
            manifest = json.load(fh)
    known = {e['key'] for e in manifest}
    new = [(k, b) for k, b in tiles if k not in known]
    next_index = len(manifest)

    # compose the atlas in memory: reuse old cells, append the new ones
    entries = list(manifest)
    pending = []
    for key, box in new:
        fname, _ = key.split('#')
        arr, bg, _ = sheets[fname]
        pending.append(sprite_tile(arr, bg, box))
        entries.append({
            'key': key,
            'cell': [next_index % ATLAS_COLS, next_index // ATLAS_COLS],
            'index': next_index,
            'w': int(box[2] - box[0]), 'h': int(box[3] - box[1]),
        })
        next_index += 1

    rows = (next_index + ATLAS_COLS - 1) // ATLAS_COLS
    atlas = Image.new('RGBA', (ATLAS_COLS * CELL, max(rows, 1) * CELL), (0, 0, 0, 0))
    for e in manifest:  # old cells first
        col, row = e['cell']
        fname, idx = e['key'].split('#')
        arr, bg, kept = sheets[fname]
        if int(idx) < len(kept):
            atlas.paste(sprite_tile(arr, bg, kept[int(idx)]), (col * CELL, row * CELL))
        else:
            atlas.paste(Image.new('RGBA', (CELL, CELL), (255, 0, 255, 255)), (col * CELL, row * CELL))
    for tile, e in zip(pending, entries[len(manifest):]):  # then new ones
        col, row = e['cell']
        atlas.paste(tile, (col * CELL, row * CELL))

    atlas.save(out_png)
    with open(out_manifest, 'w') as fh:
        json.dump(entries, fh, indent=1)
    print(f'{len(entries)} icons ({len(new)} new) -> {out_png} ({atlas.size[0]}x{atlas.size[1]})')


if __name__ == '__main__':
    main()
