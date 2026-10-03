#!/usr/bin/env python3
"""
Generates production-grade PWA PNG icons for GEMINI CITY:
- public/pwa-192x192.png (192x192)
- public/pwa-512x512.png (512x512)
- public/pwa-maskable-512x512.png (512x512 with 15% safe margin)
- public/apple-touch-icon.png (180x180)
- public/favicon.ico (32x32)
Uses only Python standard library (struct, zlib, math).
"""

import math
import os
import struct
import zlib

def encode_png(width, height, pixels):
    """
    Encodes RGBA pixel array into valid standard PNG byte stream.
    pixels: bytearray of size width * height * 4
    """
    raw_data = bytearray()
    row_bytes = width * 4
    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        start = y * row_bytes
        raw_data.extend(pixels[start:start + row_bytes])

    compressed = zlib.compress(bytes(raw_data), 9)

    def make_chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        crc = zlib.crc32(tag + data) & 0xffffffff
        return c + struct.pack('>I', crc)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return sig + make_chunk(b'IHDR', ihdr) + make_chunk(b'IDAT', compressed) + make_chunk(b'IEND', b'')

def render_gemini_city_icon(size, is_maskable=False):
    """
    Renders the Gemini City icon at specified dimensions.
    """
    pixels = bytearray(size * size * 4)

    # Scale factor relative to 512
    scale = size / 512.0
    safe_scale = 0.72 if is_maskable else 0.94

    cx = size / 2.0
    cy = size / 2.0

    # Palette
    c_bg_dark = (2, 6, 23, 255)       # #020617
    c_bg_mid = (15, 23, 42, 255)      # #0f172a
    c_sun_core = (254, 240, 138, 255) # #fef08a
    c_sun_mid = (245, 158, 11, 255)   # #f59e0b
    c_sun_outer = (217, 119, 6, 255)  # #d97706
    c_cyan = (56, 189, 248, 255)      # #38bdf8
    c_cyan_glow = (6, 182, 212, 180)  # #06b6d4
    c_gold = (251, 191, 36, 255)      # #fbbf24
    c_tower = (30, 41, 59, 255)       # #1e293b
    c_tower_edge = (51, 65, 85, 255)  # #334155
    c_white = (255, 255, 255, 255)

    def blend(c_dst, c_src):
        # Alpha blending
        sa = c_src[3] / 255.0
        if sa <= 0:
            return c_dst
        if sa >= 1.0:
            return c_src
        da = c_dst[3] / 255.0
        out_a = sa + da * (1.0 - sa)
        if out_a <= 0:
            return (0, 0, 0, 0)
        out_r = int((c_src[0] * sa + c_dst[0] * da * (1.0 - sa)) / out_a)
        out_g = int((c_src[1] * sa + c_dst[1] * da * (1.0 - sa)) / out_a)
        out_b = int((c_src[2] * sa + c_dst[2] * da * (1.0 - sa)) / out_a)
        return (out_r, out_g, out_b, int(out_a * 255))

    for y in range(size):
        ny = (y - cy) / (size / 2.0)
        for x in range(size):
            nx = (x - cx) / (size / 2.0)
            d = math.hypot(nx, ny)

            # 1. Base gradient
            t = (y / float(size))
            bg_r = int(c_bg_dark[0] * (1 - t) + c_bg_mid[0] * t)
            bg_g = int(c_bg_dark[1] * (1 - t) + c_bg_mid[1] * t)
            bg_b = int(c_bg_dark[2] * (1 - t) + c_bg_mid[2] * t)
            pix = (bg_r, bg_g, bg_b, 255)

            # If not maskable, round corners slightly
            if not is_maskable:
                # Rounded rect radius ~ 20%
                r_limit = 0.88
                qx = max(0, abs(nx) - r_limit)
                qy = max(0, abs(ny) - r_limit)
                corner_d = math.hypot(qx, qy)
                if corner_d > 0.11:
                    # Anti-aliased boundary
                    alpha = max(0.0, min(1.0, (0.12 - corner_d) / 0.01))
                    pix = (pix[0], pix[1], pix[2], int(alpha * 255))

            # Apply safe_scale to central artwork
            art_x = nx / safe_scale
            art_y = ny / safe_scale
            art_d = math.hypot(art_x, art_y)

            # 2. Outer Neon Ring
            ring_r = 0.82
            ring_dr = abs(art_d - ring_r)
            if ring_dr < 0.035:
                ring_alpha = max(0.0, 1.0 - (ring_dr / 0.035))
                # Gold at top, Cyan at bottom
                ring_col = c_gold if art_y < 0 else c_cyan
                pix = blend(pix, (ring_col[0], ring_col[1], ring_col[2], int(ring_alpha * 210)))

            # 3. Rising Sun over Horizon (Center at art_x=0, art_y=-0.08)
            sun_dx = art_x
            sun_dy = art_y - (-0.08)
            sun_d = math.hypot(sun_dx, sun_dy)
            sun_radius = 0.38
            if sun_d < sun_radius:
                st = sun_d / sun_radius
                if st < 0.4:
                    s_r = int(c_sun_core[0] * (1 - st*2.5) + c_sun_mid[0] * (st*2.5))
                    s_g = int(c_sun_core[1] * (1 - st*2.5) + c_sun_mid[1] * (st*2.5))
                    s_b = int(c_sun_core[2] * (1 - st*2.5) + c_sun_mid[2] * (st*2.5))
                else:
                    st2 = (st - 0.4) / 0.6
                    s_r = int(c_sun_mid[0] * (1 - st2) + c_sun_outer[0] * st2)
                    s_g = int(c_sun_mid[1] * (1 - st2) + c_sun_outer[1] * st2)
                    s_b = int(c_sun_mid[2] * (1 - st2) + c_sun_outer[2] * st2)
                sun_edge = max(0.0, min(1.0, (sun_radius - sun_d) / 0.015))
                pix = blend(pix, (s_r, s_g, s_b, int(sun_edge * 255)))

            # 4. Twin Gemini Spire Towers
            # Left Spire: art_x in [-0.36, -0.18], art_y in [-0.55, 0.32]
            # Right Spire: art_x in [0.18, 0.36], art_y in [-0.55, 0.32]
            for side in (-1, 1):
                tower_cx = side * 0.28
                tower_half_w = 0.075
                dx_t = abs(art_x - tower_cx)
                
                # Tower spire apex
                if -0.55 <= art_y <= 0.32 and dx_t <= tower_half_w:
                    # Spire needle at very top
                    if art_y < -0.42:
                        needle_w = 0.015 * (1.0 - (-0.42 - art_y) / 0.13)
                        if dx_t <= needle_w:
                            pix = blend(pix, c_cyan if side == -1 else c_gold)
                    else:
                        # Tower body
                        t_col = c_tower_edge if dx_t > (tower_half_w - 0.015) else c_tower
                        # Window strips
                        strip_y = (art_y + 0.42) % 0.09
                        if 0.025 <= strip_y <= 0.055 and dx_t < (tower_half_w - 0.02):
                            t_col = c_gold if (int((art_y + 0.42) / 0.09) % 2 == 0) else c_cyan
                        pix = blend(pix, t_col)

            # 5. Golden Sky-Bridge Connecting Towers (art_y in [-0.02, 0.04])
            if -0.02 <= art_y <= 0.04 and -0.28 <= art_x <= 0.28:
                bridge_col = c_gold if (-0.01 <= art_y <= 0.01) else c_tower
                pix = blend(pix, bridge_col)

            # 6. Central Cyber-Citadel Spire (art_x in [-0.10, 0.10])
            if -0.24 <= art_y <= 0.34:
                citadel_w = 0.10 * (1.0 - (art_y - (-0.24)) / 0.58 * 0.2)
                if abs(art_x) <= citadel_w:
                    cit_col = c_sun_mid if abs(art_x) < 0.02 else c_tower_edge
                    pix = blend(pix, cit_col)

            # 7. Golden Horizon Bridge Arch Arc (art_y ~ 0.28 - 0.10 * cos(art_x * 4))
            arch_center_y = 0.28 - 0.08 * math.cos(max(-1.5, min(1.5, art_x * 3.5)))
            if abs(art_x) <= 0.65 and abs(art_y - arch_center_y) < 0.022:
                arch_a = max(0.0, 1.0 - abs(art_y - arch_center_y) / 0.022)
                pix = blend(pix, (c_gold[0], c_gold[1], c_gold[2], int(arch_a * 255)))

            # 8. Modern "GC" Monogram Plaque at Bottom (art_y in [0.42, 0.64], art_x in [-0.34, 0.34])
            if 0.42 <= art_y <= 0.62 and abs(art_x) <= 0.34:
                # Plaque background
                pix = blend(pix, (2, 6, 23, 240))
                # Border
                if abs(art_x) >= 0.32 or art_y <= 0.435 or art_y >= 0.605:
                    pix = blend(pix, c_gold)
                else:
                    # Draw Stylized "G" on left, "C" on right
                    # "G" in art_x in [-0.24, -0.04], art_y in [0.46, 0.58]
                    # "C" in art_x in [0.04, 0.24], art_y in [0.46, 0.58]
                    gx = (art_x - (-0.14)) / 0.08
                    gy = (art_y - 0.52) / 0.06
                    gd = math.hypot(gx, gy)
                    # G outer circle
                    if 0.65 <= gd <= 1.0:
                        # G gap on upper-right
                        if not (gx > 0.15 and gy < -0.1):
                            pix = blend(pix, c_gold)
                    # G crossbar
                    if -0.15 <= gy <= 0.1 and 0.0 <= gx <= 0.95:
                        pix = blend(pix, c_gold)

                    # C in art_x in [0.06, 0.22]
                    cx_c = (art_x - 0.14) / 0.08
                    cy_c = (art_y - 0.52) / 0.06
                    cd = math.hypot(cx_c, cy_c)
                    if 0.65 <= cd <= 1.0:
                        # C open on right
                        if not (cx_c > 0.2):
                            pix = blend(pix, c_cyan)

            idx = (y * size + x) * 4
            pixels[idx] = pix[0]
            pixels[idx + 1] = pix[1]
            pixels[idx + 2] = pix[2]
            pixels[idx + 3] = pix[3]

    return encode_png(size, size, pixels)

def create_ico(png_data):
    """
    Creates a basic single-image .ico file from PNG data.
    """
    header = struct.pack('<HHH', 0, 1, 1)  # reserved, type 1 (icon), 1 image
    w = 32
    h = 32
    entry = struct.pack(
        '<BBBBHHII',
        w,
        h,
        0,  # color palette
        0,  # reserved
        1,  # color planes
        32, # bits per pixel
        len(png_data),
        6 + 16 # offset to image data
    )
    return header + entry + png_data

def main():
    os.makedirs('public', exist_ok=True)

    print("Generating public/pwa-192x192.png...")
    png_192 = render_gemini_city_icon(192, is_maskable=False)
    with open('public/pwa-192x192.png', 'wb') as f:
        f.write(png_192)

    print("Generating public/pwa-512x512.png...")
    png_512 = render_gemini_city_icon(512, is_maskable=False)
    with open('public/pwa-512x512.png', 'wb') as f:
        f.write(png_512)

    print("Generating public/pwa-maskable-512x512.png...")
    png_maskable = render_gemini_city_icon(512, is_maskable=True)
    with open('public/pwa-maskable-512x512.png', 'wb') as f:
        f.write(png_maskable)

    print("Generating public/apple-touch-icon.png...")
    png_180 = render_gemini_city_icon(180, is_maskable=False)
    with open('public/apple-touch-icon.png', 'wb') as f:
        f.write(png_180)

    print("Generating public/favicon.ico...")
    png_32 = render_gemini_city_icon(32, is_maskable=False)
    ico_data = create_ico(png_32)
    with open('public/favicon.ico', 'wb') as f:
        f.write(ico_data)

    print("All PWA icons successfully generated!")

if __name__ == '__main__':
    main()
