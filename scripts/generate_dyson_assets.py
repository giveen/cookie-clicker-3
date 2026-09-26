import math
import random
from PIL import Image, ImageDraw, ImageFilter

def make_dyson_store_icons():
    # 64x64 available icon and off (silhouette) icon
    size = (64, 64)
    img_on = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_on = ImageDraw.Draw(img_on)

    cx, cy = 32, 32

    # Outer corona glow
    for r in range(28, 12, -2):
        alpha = int(35 * (1.0 - (r - 12) / 16))
        draw_on.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 140, 20, alpha))

    # Swarm rings (elliptical orbits)
    draw_on.arc([cx - 26, cy - 14, cx + 26, cy + 14], 0, 360, fill=(80, 210, 255, 180), width=2)
    draw_on.arc([cx - 24, cy - 20, cx + 24, cy + 20], 30, 210, fill=(100, 230, 255, 140), width=1)
    draw_on.arc([cx - 20, cy - 24, cx + 20, cy + 24], 210, 390, fill=(100, 230, 255, 140), width=1)

    # Collector satellites on the rings
    for angle_deg in [20, 85, 150, 205, 275, 330]:
        rad = math.radians(angle_deg)
        sx = cx + int(24 * math.cos(rad))
        sy = cy + int(13 * math.sin(rad))
        draw_on.rectangle([sx - 2, sy - 2, sx + 2, sy + 2], fill=(240, 250, 255, 230))
        draw_on.point((sx, sy), fill=(255, 255, 180, 255))

    # Sun body
    for r in range(12, 0, -1):
        t = r / 12.0
        red = 255
        green = int(160 + 95 * (1.0 - t))
        blue = int(20 + 200 * (1.0 - t**2))
        draw_on.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, 255))

    # Solar flares / solar prominences
    flares = [
        (cx - 14, cy - 8, cx - 18, cy - 12),
        (cx + 13, cy + 7, cx + 18, cy + 10),
        (cx + 6, cy - 13, cx + 9, cy - 18),
        (cx - 8, cy + 13, cx - 12, cy + 17),
    ]
    for x1, y1, x2, y2 in flares:
        draw_on.line([x1, y1, x2, y2], fill=(255, 220, 80, 220), width=2)

    img_on.save("public/img/dysonswarm.webp", "WEBP")
    print("Saved public/img/dysonswarm.webp")

    # Blacked out silhouette icon: pure solid pitch black (#000000) silhouette
    # matching the exact alpha outline of the on icon, identical to CC2 locked building silhouettes
    alpha_channel = img_on.split()[3]
    # Threshold alpha to get crisp solid silhouette
    solid_alpha = alpha_channel.point(lambda p: 255 if p > 50 else 0)
    img_off = Image.new("RGBA", size, (0, 0, 0, 0))
    # Fill silhouette with pitch black
    black_layer = Image.new("RGBA", size, (0, 0, 0, 255))
    img_off.paste(black_layer, (0, 0), solid_alpha)

    img_off.save("public/img/dysonswarm_off.webp", "WEBP")
    print("Saved public/img/dysonswarm_off.webp")

def make_background():
    w, h = 512, 288
    img = Image.new("RGBA", (w, h), (4, 3, 10, 255))
    draw = ImageDraw.Draw(img)

    random.seed(42)
    for _ in range(250):
        sx = random.randint(0, w - 1)
        sy = random.randint(0, h - 1)
        b = random.randint(120, 255)
        a = random.randint(100, 220)
        draw.point((sx, sy), fill=(b, int(b * 0.95), int(b * 1.1), a))

    for r in range(180, 0, -5):
        alpha = int(18 * (1.0 - r / 180.0))
        draw.ellipse([w // 2 - r * 1.8, h - r // 2, w // 2 + r * 1.8, h + r * 1.5], fill=(255, 130, 20, alpha))
        draw.ellipse([w // 2 - r * 1.2, h - r // 3, w // 2 + r * 1.2, h + r], fill=(255, 210, 60, int(alpha * 1.3)))

    for y_center, x_rad, y_rad in [(h + 40, 320, 120), (h + 80, 420, 160), (h + 10, 260, 90)]:
        draw.arc([w // 2 - x_rad, y_center - y_rad, w // 2 + x_rad, y_center + y_rad], 180, 360, fill=(60, 160, 230, 35), width=2)

    img = img.filter(ImageFilter.SMOOTH)
    img.save("public/img/dysonswarmBackground.webp", "WEBP")
    print("Saved public/img/dysonswarmBackground.webp")

def make_sheet():
    w, h = 384, 320
    cell_w, cell_h = 128, 160
    sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    def draw_cell(col, row, type_idx):
        cell_img = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell_img)
        cx, cy = cell_w // 2, cell_h // 2 + 10

        if type_idx == 0:
            d.polygon([(cx - 50, cy - 20), (cx - 15, cy - 10), (cx - 15, cy + 10), (cx - 50, cy + 20)], fill=(30, 120, 200, 230), outline=(100, 220, 255, 255))
            d.polygon([(cx + 50, cy - 20), (cx + 15, cy - 10), (cx + 15, cy + 10), (cx + 50, cy + 20)], fill=(30, 120, 200, 230), outline=(100, 220, 255, 255))
            d.line([(cx - 32, cy - 15), (cx - 32, cy + 15)], fill=(120, 230, 255, 200), width=1)
            d.line([(cx + 32, cy - 15), (cx + 32, cy + 15)], fill=(120, 230, 255, 200), width=1)
            d.rectangle([cx - 14, cy - 24, cx + 14, cy + 24], fill=(70, 75, 95, 255), outline=(190, 200, 230, 255), width=2)
            d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(255, 215, 0, 255), outline=(255, 255, 200, 255))
            d.line([(cx, cy - 24), (cx, cy - 42)], fill=(200, 210, 240, 255), width=2)
            d.ellipse([cx - 3, cy - 45, cx + 3, cy - 39], fill=(255, 100, 40, 255))

        elif type_idx == 1:
            d.line([(cx, cy - 45), (cx, cy + 45)], fill=(220, 220, 240, 255), width=4)
            for y_off in [-25, -5, 15, 35]:
                d.ellipse([cx - 22, cy + y_off - 6, cx + 22, cy + y_off + 6], outline=(255, 140, 20, 240), width=2)
            d.polygon([(cx - 18, cy + 40), (cx + 18, cy + 40), (cx, cy + 60)], fill=(255, 90, 20, 240))
            d.line([(cx, cy - 35), (cx, cy + 40)], fill=(255, 240, 100, 255), width=2)

        elif type_idx == 2:
            d.polygon([(cx, cy - 45), (cx + 38, cy), (cx, cy + 45), (cx - 38, cy)], fill=(40, 160, 230, 180), outline=(180, 240, 255, 255), width=2)
            d.line([(cx - 38, cy), (cx + 38, cy)], fill=(220, 230, 255, 255), width=2)
            d.line([(cx, cy - 45), (cx, cy + 45)], fill=(220, 230, 255, 255), width=2)
            d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 200, 40, 255), outline=(255, 255, 255, 255))

        elif type_idx == 3:
            d.polygon([(cx, cy - 35), (cx + 32, cy - 18), (cx + 32, cy + 18), (cx, cy + 35), (cx - 32, cy + 18), (cx - 32, cy - 18)], outline=(120, 210, 255, 240), width=2)
            d.polygon([(cx, cy - 20), (cx + 18, cy - 10), (cx + 18, cy + 10), (cx, cy + 20), (cx - 18, cy + 10), (cx - 18, cy - 10)], fill=(30, 100, 180, 220), outline=(200, 240, 255, 255))
            d.line([(cx, cy), (cx, cy - 50)], fill=(255, 255, 180, 255), width=3)
            d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(255, 255, 255, 255))

        elif type_idx == 4:
            d.ellipse([cx - 35, cy - 22, cx + 35, cy + 22], fill=(45, 50, 70, 255), outline=(180, 190, 220, 255), width=3)
            d.ellipse([cx - 24, cy - 13, cx + 24, cy + 13], fill=(255, 80, 20, 240), outline=(255, 210, 40, 255), width=2)
            d.ellipse([cx - 10, cy - 6, cx + 10, cy + 6], fill=(20, 20, 30, 255), outline=(140, 180, 240, 255))
            for dx, dy in [(-36, -20), (36, -20), (-36, 20), (36, 20)]:
                d.line([(cx, cy), (cx + dx, cy + dy)], fill=(160, 180, 210, 255), width=2)

        elif type_idx == 5:
            pts = []
            for a in [90, 210, 330]:
                rad = math.radians(a)
                pts.append((cx + int(36 * math.cos(rad)), cy - int(36 * math.sin(rad))))
            d.polygon(pts, outline=(80, 220, 255, 240), width=2)
            for px, py in pts:
                d.ellipse([px - 8, py - 8, px + 8, py + 8], fill=(50, 70, 100, 255), outline=(160, 230, 255, 255), width=2)
                d.point((px, py), fill=(255, 255, 200, 255))
            d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(255, 170, 30, 255), outline=(255, 255, 220, 255), width=2)

        sheet.paste(cell_img, (col * cell_w, row * cell_h), cell_img)

    idx = 0
    for r in range(2):
        for c in range(3):
            draw_cell(c, r, idx)
            idx += 1

    sheet.save("public/img/dysonswarm_sheet.webp", "WEBP")
    print("Saved public/img/dysonswarm_sheet.webp")

def make_upgrade_icons():
    sheet_w, sheet_h = 480, 48
    img = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    def draw_upgrade(idx, title):
        cell = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        cx, cy = 24, 24

        d.rectangle([2, 2, 45, 45], fill=(16, 20, 34, 230), outline=(50, 70, 110, 255), width=1)

        if idx == 0:
            d.polygon([(cx, 8), (40, 38), (8, 38)], fill=(40, 140, 220, 220), outline=(160, 230, 255, 255), width=1)
            d.line([(cx, 8), (cx, 38)], fill=(200, 240, 255, 255), width=1)
        elif idx == 1:
            d.arc([8, 14, 40, 42], 180, 360, fill=(255, 140, 20, 255), width=3)
            d.ellipse([14, 28, 34, 48], fill=(255, 60, 10, 255))
        elif idx == 2:
            d.ellipse([12, 14, 36, 38], fill=(120, 125, 135, 255), outline=(180, 185, 195, 255))
            d.line([(6, 8), (20, 22)], fill=(255, 50, 50, 255), width=2)
            d.line([(42, 8), (28, 22)], fill=(255, 50, 50, 255), width=2)
        elif idx == 3:
            d.polygon([(cx, 10), (38, 24), (cx, 38), (10, 24)], outline=(100, 220, 255, 255), width=2)
            d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 220, 50, 255))
        elif idx == 4:
            for a in range(0, 360, 45):
                rad = math.radians(a)
                x2 = cx + int(15 * math.cos(rad))
                y2 = cy + int(15 * math.sin(rad))
                d.line([(cx, cy), (x2, y2)], fill=(255, 190, 40, 255), width=2)
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 255, 200, 255))
        elif idx == 5:
            d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], outline=(255, 160, 30, 200), width=1)
            d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], outline=(255, 220, 50, 220), width=1)
            d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(255, 250, 150, 255))
        elif idx == 6:
            d.ellipse([8, 8, 40, 40], outline=(60, 160, 240, 240), width=1)
            d.line([(8, cy), (40, cy)], fill=(60, 160, 240, 200), width=1)
            d.line([(cx, 8), (cx, 40)], fill=(60, 160, 240, 200), width=1)
            for nx, ny in [(14, 16), (34, 16), (14, 32), (34, 32), (cx, cy)]:
                d.ellipse([nx - 2, ny - 2, nx + 2, ny + 2], fill=(255, 220, 50, 255))
        elif idx == 7:
            d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(255, 80, 20, 255))
            for ax, ay, r in [(10, 16, 3), (36, 12, 4), (38, 32, 3), (12, 34, 4), (24, 40, 3)]:
                d.ellipse([ax - r, ay - r, ax + r, ay + r], fill=(130, 110, 95, 255), outline=(190, 170, 150, 255))
        elif idx == 8:
            d.ellipse([10, 18, 32, 40], fill=(70, 130, 190, 255), outline=(150, 200, 240, 255))
            d.arc([22, 8, 42, 28], 120, 300, fill=(240, 240, 255, 255), width=2)
            d.line([(32, 18), (38, 12)], fill=(255, 220, 50, 255), width=1)
        elif idx == 9:
            d.polygon([(cx, 6), (42, 15), (42, 33), (cx, 42), (6, 33), (6, 15)], fill=(30, 35, 50, 240), outline=(255, 215, 0, 255), width=2)
            d.line([(cx, 6), (cx, 42)], fill=(255, 180, 20, 200), width=1)
            d.line([(6, 15), (42, 33)], fill=(255, 180, 20, 200), width=1)
            d.line([(6, 33), (42, 15)], fill=(255, 180, 20, 200), width=1)
            d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(255, 255, 220, 255))

        img.paste(cell, (idx * 48, 0), cell)

    upgrades_list = [
        "Photonic Sails", "Coronal Siphons", "Mercury Stripmine Array",
        "Lagrange Harvesters", "Solar Flare Converters", "Photosphere Resonators",
        "Heliospheric Grid", "Asteroid Belt Smelters", "Kuiper Belt Transceivers",
        "Full Star Enclosure"
    ]
    for i, name in enumerate(upgrades_list):
        draw_upgrade(i, name)

    img.save("public/img/dysonswarm_upgrades.webp", "WEBP")
    print("Saved public/img/dysonswarm_upgrades.webp")

if __name__ == "__main__":
    make_dyson_store_icons()
    make_background()
    make_sheet()
    make_upgrade_icons()
    print("All Dyson Swarm assets generated successfully.")
