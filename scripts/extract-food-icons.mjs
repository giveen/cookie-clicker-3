/**
 * scripts/extract-food-icons.mjs — build the Heavenly Pantry upgrade atlas.
 *
 * The dotoridev "Free - 500+ Pixel Food Icons" pack ships each themed batch as
 * a 1024x1024 sheet of ~20 hand-drawn sprites on a FLAT per-sheet background
 * color (no alpha, no grid). This script:
 *
 *   1. estimates each sheet's background from its 1px border,
 *   2. finds foreground connected components (8-connectivity, min area filter),
 *   3. crops each sprite, makes the fringe background transparent,
 *   4. downscales each crop NEAREST-NEIGHBOR into a 48x48 cell (pixel art keeps
 *      hard edges; no blending smears),
 *   5. packs every cell into public/img/foodIcons.png (a 12-wide 48px-grid
 *      atlas, same convention as img/icons.webp) and writes a manifest that
 *      maps each sprite to its [col,row] cell for the upgrade declarations.
 *
 * Re-run after dropping a new pack version into FOOD_DIR — cells append, so
 * manifest entries (and the upgrade ids that reference them) stay stable.
 *
 * Usage: node scripts/extract-food-icons.mjs [foodDir]
 * Needs: python3 + Pillow + numpy (atlas composition is done in Python for
 * speed; this wrapper just shells out — see extract_food_icons.py).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const foodDir = resolve(root, process.argv[2] || '../Downloads/Free_Pixel_Food_Pack_updated');

if (!existsSync(foodDir)) {
	console.error(`food pack directory not found: ${foodDir}`);
	console.error('usage: node scripts/extract-food-icons.mjs [path/to/pack]');
	process.exit(1);
}

execFileSync('python3', [resolve(root, 'scripts/extract_food_icons.py'), foodDir], {
	stdio: 'inherit',
	cwd: root,
});
