import numpy as np
from PIL import Image
import os

COLS = 4
ROWS = 6
CELL_W = 512
CELL_H = 256
SHEET_W = COLS * CELL_W  # 2048
SHEET_H = ROWS * CELL_H  # 1536

print(f"Generating 24 Doctrine Worlds: {SHEET_W}x{SHEET_H} ({COLS}x{ROWS} grid)")

def fractal_noise(w, h, alpha=1.6, seed=42):
    rng = np.random.RandomState(seed)
    white = rng.normal(0, 1, (h, w)) + 1j * rng.normal(0, 1, (h, w))
    kx = np.fft.fftfreq(w)
    ky = np.fft.fftfreq(h)
    KX, KY = np.meshgrid(kx, ky)
    K = np.sqrt(KX**2 + KY**2)
    K[0, 0] = 1.0
    filtered = white / (K ** alpha)
    filtered[0, 0] = 0.0
    n = np.fft.ifft2(filtered).real
    res = (n - n.min()) / (n.max() - n.min())
    res.flags.writeable = False
    return res

def domain_warp(n_base, w, h, strength_x=30.0, strength_y=15.0, seed_x=101, seed_y=202):
    wx = (fractal_noise(w, h, alpha=1.8, seed=seed_x) - 0.5) * strength_x
    wy = (fractal_noise(w, h, alpha=1.8, seed=seed_y) - 0.5) * strength_y
    x_coords = np.arange(w)[None, :] + wx
    y_coords = np.arange(h)[:, None] + wy
    xi = np.mod(np.floor(x_coords).astype(np.int32), w)
    yi = np.mod(np.clip(np.floor(y_coords).astype(np.int32), 0, h - 1), h)
    res = np.array(n_base[yi, xi], copy=True)
    res.flags.writeable = False
    return res

def freeze(arr):
    a = np.array(arr, copy=True)
    a.flags.writeable = False
    return a

def generate_all_worlds():
    sheet = np.zeros((SHEET_H, SHEET_W, 3), dtype=np.uint8)
    
    # Precompute coordinate grids
    lon = np.linspace(0, 2 * np.pi, CELL_W, endpoint=False)
    lat = np.linspace(-np.pi / 2, np.pi / 2, CELL_H)
    LON, LAT = np.meshgrid(lon, lat)
    
    for idx in range(24):
        col = idx % COLS
        row = idx // COLS
        print(f"Generating World {idx+1}/24 (col={col}, row={row})...")
        
        base_seed = idx * 100 + 42
        
        # ── ROW 0: GLUTTON WORLDS (Click Path) ──
        if idx == 0:
            # 0: Cookie Dough Magma
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.7, seed=base_seed), CELL_W, CELL_H, 40, 20, base_seed+1, base_seed+2)
            lava = t < 0.45
            lt = freeze(np.clip(t / 0.45, 0, 1))
            ct = freeze(np.clip((t - 0.45) / 0.55, 0, 1))
            r = np.where(lava, 255.0, 190.0 - ct * 90.0)
            g = np.where(lava, 220.0 - lt * 160.0, 130.0 - ct * 70.0)
            b = np.where(lava, 40.0 - lt * 35.0, 70.0 - ct * 40.0)
            chips = (fractal_noise(CELL_W, CELL_H, alpha=1.2, seed=base_seed+9) > 0.82) & (~lava)
            r[chips], g[chips], b[chips] = 40.0, 22.0, 15.0
            
        elif idx == 1:
            # 1: Caramel Ocean & Sugar Wafer Continents
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.65, seed=base_seed), CELL_W, CELL_H, 35, 18, base_seed+1, base_seed+2)
            sea = t < 0.50
            st = freeze(np.clip(t / 0.50, 0, 1))
            wt = freeze(np.clip((t - 0.50) / 0.50, 0, 1))
            r = np.where(sea, 240.0 - st * 70.0, 230.0 - wt * 50.0)
            g = np.where(sea, 140.0 - st * 55.0, 190.0 - wt * 55.0)
            b = np.where(sea, 25.0 + st * 20.0, 140.0 - wt * 60.0)
            
        elif idx == 2:
            # 2: Cacao Caldera & Molten Fudge
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.75, seed=base_seed), CELL_W, CELL_H, 30, 15, base_seed+1, base_seed+2)
            fudge = t < 0.40
            ft = freeze(np.clip(t / 0.40, 0, 1))
            bt = freeze(np.clip((t - 0.40) / 0.60, 0, 1))
            r = np.where(fudge, 255.0 - ft * 80.0, 75.0 - bt * 35.0)
            g = np.where(fudge, 90.0 - ft * 65.0, 42.0 - bt * 20.0)
            b = np.where(fudge, 20.0, 32.0 - bt * 18.0)
            
        elif idx == 3:
            # 3: Spiced Gingerbread Faults & Royal Icing
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.7, seed=base_seed), CELL_W, CELL_H, 25, 15, base_seed+1, base_seed+2)
            icing = t > 0.68
            it = freeze(np.clip((t - 0.68) / 0.32, 0, 1))
            gt = freeze(np.clip(t / 0.68, 0, 1))
            r = np.where(icing, 245.0 + it * 10.0, 160.0 + gt * 40.0)
            g = np.where(icing, 240.0 + it * 15.0, 85.0 + gt * 30.0)
            b = np.where(icing, 248.0 + it * 7.0, 45.0 + gt * 20.0)

        # ── ROW 1: IDLER WORLDS (Production Path) ──
        elif idx == 4:
            # 4: Condensed Milk Glaciers
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.6, seed=base_seed), CELL_W, CELL_H, 40, 20, base_seed+1, base_seed+2)
            ice = t > 0.52
            r = np.where(ice, 230.0 + (t - 0.52) * 50.0, 160.0 + t * 50.0)
            g = np.where(ice, 240.0 + (t - 0.52) * 30.0, 200.0 + t * 40.0)
            b = np.where(ice, 255.0, 240.0 + t * 15.0)
            
        elif idx == 5:
            # 5: Mint Chip Polar World
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.65, seed=base_seed), CELL_W, CELL_H, 30, 15, base_seed+1, base_seed+2)
            r = 70.0 + t * 60.0
            g = 200.0 + t * 45.0
            b = 150.0 + t * 50.0
            chips = (fractal_noise(CELL_W, CELL_H, alpha=1.1, seed=base_seed+7) > 0.84)
            r[chips], g[chips], b[chips] = 38.0, 24.0, 18.0
            
        elif idx == 6:
            # 6: Sapphire Gas Giant (Banded Jovian Belts)
            bands = np.sin(LAT * 14.0) * 0.35 + np.sin(LAT * 28.0) * 0.15
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.9, seed=base_seed), CELL_W, CELL_H, 60, 8, base_seed+1, base_seed+2)
            mix = freeze(np.clip(t + bands, 0, 1))
            r = 25.0 + mix * 95.0
            g = 85.0 + mix * 120.0
            b = 175.0 + mix * 80.0
            
        elif idx == 7:
            # 7: Aurora Starlight Giant
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.8, seed=base_seed), CELL_W, CELL_H, 45, 15, base_seed+1, base_seed+2)
            r = 15.0 + t * 40.0
            g = 25.0 + t * 65.0
            b = 95.0 + t * 110.0
            aurora_mask = (np.abs(LAT) > (np.pi * 0.28)) & (fractal_noise(CELL_W, CELL_H, alpha=1.5, seed=base_seed+5) > 0.45)
            r[aurora_mask], g[aurora_mask], b[aurora_mask] = 40.0, 255.0, 220.0

        # ── ROW 2: FATEBINDER WORLDS (Golden Cookie & Wrath) ──
        elif idx == 8:
            # 8: Amethyst Arcane Nexus
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.7, seed=base_seed), CELL_W, CELL_H, 35, 20, base_seed+1, base_seed+2)
            r = 95.0 + t * 80.0
            g = 20.0 + t * 40.0
            b = 160.0 + t * 90.0
            veins = np.abs(t - 0.50) < 0.04
            r[veins], g[veins], b[veins] = 255.0, 215.0, 50.0
            
        elif idx == 9:
            # 9: Wrath Flesh Hivemind
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.65, seed=base_seed), CELL_W, CELL_H, 40, 20, base_seed+1, base_seed+2)
            pores = t < 0.26
            wrath_veins = (t > 0.48) & (t < 0.54)
            r = 175.0 + t * 65.0
            g = 40.0 + t * 35.0
            b = 45.0 + t * 35.0
            r[pores], g[pores], b[pores] = 38.0, 8.0, 12.0
            r[wrath_veins], g[wrath_veins], b[wrath_veins] = 255.0, 95.0, 30.0
            
        elif idx == 10:
            # 10: Cosmic Singularity Gravity Well
            spiral = np.sin(LON * 3.0 + LAT * 4.0) * 0.25
            t = freeze(np.clip(domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.8, seed=base_seed), CELL_W, CELL_H, 50, 30, base_seed+1, base_seed+2) + spiral, 0, 1))
            r = 30.0 + t * 120.0
            g = 10.0 + t * 35.0
            b = 60.0 + t * 180.0
            
        elif idx == 11:
            # 11: Bipolar Fate (Half Lucky Gold, Half Eldritch Wrath)
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.7, seed=base_seed), CELL_W, CELL_H, 30, 20, base_seed+1, base_seed+2)
            gold_mask = np.cos(LON) > 0.0
            r = np.where(gold_mask, 220.0 + t * 35.0, 150.0 + t * 65.0)
            g = np.where(gold_mask, 160.0 + t * 45.0, 20.0 + t * 25.0)
            b = np.where(gold_mask, 25.0 + t * 40.0, 30.0 + t * 25.0)

        # ── ROW 3: REBUILDER WORLDS (Economy Path) ──
        elif idx == 12:
            # 12: Terraformed Cookie Biome
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.65, seed=base_seed), CELL_W, CELL_H, 35, 18, base_seed+1, base_seed+2)
            choc_sea = t < 0.48
            r = np.where(choc_sea, 65.0 + t * 40.0, 40.0 + t * 50.0)
            g = np.where(choc_sea, 38.0 + t * 25.0, 160.0 + t * 70.0)
            b = np.where(choc_sea, 25.0 + t * 18.0, 75.0 + t * 40.0)
            
        elif idx == 13:
            # 13: Emerald Sugar Cane Canopy
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.7, seed=base_seed), CELL_W, CELL_H, 35, 20, base_seed+1, base_seed+2)
            sugar_peaks = t > 0.72
            r = 20.0 + t * 50.0
            g = 130.0 + t * 105.0
            b = 65.0 + t * 55.0
            r[sugar_peaks], g[sugar_peaks], b[sugar_peaks] = 240.0, 255.0, 245.0
            
        elif idx == 14:
            # 14: Golden Honeycomb Lattice
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.8, seed=base_seed), CELL_W, CELL_H, 20, 10, base_seed+1, base_seed+2)
            hex_grid = (np.abs(np.sin(LON * 18.0) * np.sin(LAT * 14.0)) < 0.12)
            r = 225.0 + t * 30.0
            g = 150.0 + t * 45.0
            b = 20.0 + t * 40.0
            r[hex_grid], g[hex_grid], b[hex_grid] = 160.0, 95.0, 10.0
            
        elif idx == 15:
            # 15: Architectural Blueprint Sphere
            t = fractal_noise(CELL_W, CELL_H, alpha=2.0, seed=base_seed)
            grid_lines = (np.abs(np.sin(LON * 12.0)) < 0.06) | (np.abs(np.sin(LAT * 8.0)) < 0.06)
            r = 12.0 + t * 25.0
            g = 30.0 + t * 40.0
            b = 85.0 + t * 65.0
            r[grid_lines], g[grid_lines], b[grid_lines] = 60.0, 220.0, 255.0

        # ── ROW 4: MOONS & ASTEROIDS ──
        elif idx == 16:
            # 16: Phobos Crumb Moon (Cratered chocolate-chip asteroid)
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.5, seed=base_seed), CELL_W, CELL_H, 25, 15, base_seed+1, base_seed+2)
            craters = fractal_noise(CELL_W, CELL_H, alpha=1.4, seed=base_seed+8)
            crater_rims = (np.abs(craters - 0.5) < 0.04)
            r = 120.0 + t * 45.0
            g = 90.0 + t * 35.0
            b = 68.0 + t * 30.0
            r[crater_rims] += 45.0
            g[crater_rims] += 45.0
            b[crater_rims] += 45.0
            
        elif idx == 17:
            # 17: Deimos Powdered Sugar Satellite
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.7, seed=base_seed), CELL_W, CELL_H, 20, 10, base_seed+1, base_seed+2)
            r = 205.0 + t * 45.0
            g = 200.0 + t * 48.0
            b = 215.0 + t * 38.0
            
        elif idx == 18:
            # 18: Molten Butterscotch Moon
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.75, seed=base_seed), CELL_W, CELL_H, 35, 18, base_seed+1, base_seed+2)
            r = 235.0 + t * 20.0
            g = 160.0 + t * 50.0
            b = 40.0 + t * 60.0
            
        elif idx == 19:
            # 19: Deep Void Singularity
            t = fractal_noise(CELL_W, CELL_H, alpha=1.8, seed=base_seed)
            equator_ring = np.abs(LAT) < 0.12
            r = 18.0 + t * 25.0
            g = 10.0 + t * 20.0
            b = 30.0 + t * 45.0
            r[equator_ring], g[equator_ring], b[equator_ring] = 210.0, 75.0, 255.0

        # ── ROW 5: SPECIAL & EXOTIC WORLDS ──
        elif idx == 20:
            # 20: Golden Sun Core
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.65, seed=base_seed), CELL_W, CELL_H, 40, 20, base_seed+1, base_seed+2)
            r = np.full_like(t, 255.0)
            g = 190.0 + t * 65.0
            b = 30.0 + t * 80.0
            
        elif idx == 21:
            # 21: Prismatic Crystal Geode
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.6, seed=base_seed), CELL_W, CELL_H, 35, 20, base_seed+1, base_seed+2)
            r = 130.0 + np.sin(t * 8.0) * 85.0 + 40.0
            g = 130.0 + np.sin(t * 8.0 + 2.0) * 85.0 + 40.0
            b = 160.0 + np.sin(t * 8.0 + 4.0) * 80.0 + 15.0
            
        elif idx == 22:
            # 22: Blast Furnace Forge
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.7, seed=base_seed), CELL_W, CELL_H, 35, 18, base_seed+1, base_seed+2)
            r = np.full_like(t, 255.0)
            g = 100.0 + t * 130.0
            b = 15.0 + t * 45.0
            
        elif idx == 23:
            # 23: Celestial Transcendence Nexus
            t = domain_warp(fractal_noise(CELL_W, CELL_H, alpha=1.75, seed=base_seed), CELL_W, CELL_H, 40, 20, base_seed+1, base_seed+2)
            leylines = np.abs(np.sin(LON * 6.0 + LAT * 4.0)) < 0.08
            r = 160.0 + t * 75.0
            g = 170.0 + t * 75.0
            b = 230.0 + t * 25.0
            r[leylines], g[leylines], b[leylines] = 60.0, 255.0, 230.0

        # Stack channels
        print(f'WORLD {idx}: r={r.mean():.1f}, g={g.mean():.1f}, b={b.mean():.1f}')
        rgb = np.stack([r, g, b], axis=-1)

        # Paste cell into master sheet
        y_start = row * CELL_H
        y_end = y_start + CELL_H
        x_start = col * CELL_W
        x_end = x_start + CELL_W
        sheet[y_start:y_end, x_start:x_end] = np.clip(rgb, 0, 255).astype(np.uint8)
        
    out_path = 'public/img/doctrineWorlds.webp'
    im_sheet = Image.fromarray(sheet)
    im_sheet.save(out_path, 'WEBP', quality=92)
    print(f"Saved master spritesheet to {out_path} ({os.path.getsize(out_path)} bytes)")

    brain_dir = '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f'
    preview = im_sheet.resize((1024, 768), Image.Resampling.LANCZOS)
    preview.save(f'{brain_dir}/doctrine_worlds_spritesheet_preview.png')
    print("Saved preview to brain directory!")

if __name__ == '__main__':
    generate_all_worlds()
