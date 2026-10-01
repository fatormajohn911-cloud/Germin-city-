import * as THREE from 'three';

/**
 * High-definition procedural PBR textures (albedo, foliage, bark, ocean caustics, architecture, and sky env)
 * rendered on HTML5 Canvas so the 3D world has rich, realistic surface detail with zero external network dependencies.
 */

export function createSkyEnvTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1d4ed8'); // Zenith deep azure sky
  grad.addColorStop(0.38, '#60a5fa'); // Mid sky bright blue
  grad.addColorStop(0.49, '#fef3c7'); // Warm sunlit horizon glow
  grad.addColorStop(0.53, '#38bdf8'); // Coastal turquoise horizon bounce
  grad.addColorStop(0.75, '#0284c7'); // Deep sea reflection
  grad.addColorStop(1.0, '#3f8a3a'); // Lush island ground bounce
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Soft sunlit cloud bands near horizon
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * 512;
    const y = 70 + (i % 4) * 12;
    const rg = ctx.createRadialGradient(x, y, 2, x, y, 42);
    rg.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    rg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 42, y - 42, 84, 84);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Rich sunlit emerald & meadow-green base (bright, natural, never dark/black)
  const baseGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
  baseGrad.addColorStop(0, '#4d9c46');
  baseGrad.addColorStop(0.5, '#55a84c');
  baseGrad.addColorStop(1, '#489442');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Rolling sunlit turf variations, lush clover patches & warm meadow highlights
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = 24 + Math.random() * 76;
    const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
    grad.addColorStop(
      0,
      i % 4 === 0
        ? 'rgba(116, 198, 92, 0.34)' // Sunlit spring grass highlight
        : i % 4 === 1
        ? 'rgba(62, 132, 58, 0.32)' // Deep lush clover shade
        : i % 4 === 2
        ? 'rgba(142, 212, 102, 0.28)' // Golden-green meadow patch
        : 'rgba(82, 160, 72, 0.30)'
    );
    grad.addColorStop(1, 'rgba(85, 168, 76, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle organic lawn mowing / wind-swept meadow waves
  for (let y = 0; y < 1024; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? 'rgba(255, 255, 235, 0.045)' : 'rgba(22, 101, 52, 0.045)';
    ctx.fillRect(0, y, 1024, 32);
  }

  // Crisp multi-toned individual grass blades & clover leaves
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const len = 4 + Math.random() * 8;
    const tilt = (Math.random() - 0.5) * 3.6;
    ctx.strokeStyle =
      i % 5 === 0
        ? 'rgba(134, 218, 108, 0.55)'
        : i % 5 === 1
        ? 'rgba(46, 112, 48, 0.45)'
        : i % 5 === 2
        ? 'rgba(163, 230, 120, 0.48)'
        : i % 5 === 3
        ? 'rgba(64, 142, 60, 0.48)'
        : 'rgba(102, 184, 86, 0.5)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + tilt * 0.5, y - len * 0.5, x + tilt, y - len);
    ctx.stroke();
  }

  // Tiny delicate meadow wildflowers (daisy white, buttercup gold, clover pink)
  for (let i = 0; i < 480; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(254, 249, 195, 0.78)' // Daisy cream
        : i % 3 === 1
        ? 'rgba(253, 224, 71, 0.75)' // Buttercup yellow
        : 'rgba(251, 207, 232, 0.72)'; // Blossom pink
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + (i % 2) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNeoCityGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Sleek pearl-slate & botanical eco-plaza stone base (bright, clean, and futuristic)
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 1024, 1024);

  const tile = 128;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = c * tile;
      const y = r * tile;
      const isGardenTile = (r + c) % 4 === 0;

      if (isGardenTile) {
        // Lush bioluminescent emerald eco-turf courtyard square
        const turfGrad = ctx.createRadialGradient(
          x + tile / 2,
          y + tile / 2,
          8,
          x + tile / 2,
          y + tile / 2,
          tile * 0.65
        );
        turfGrad.addColorStop(0, '#10b981');
        turfGrad.addColorStop(0.7, '#059669');
        turfGrad.addColorStop(1, '#047857');
        ctx.fillStyle = turfGrad;
        ctx.fillRect(x + 8, y + 8, tile - 16, tile - 16);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 7, y + 7, tile - 14, tile - 14);
      } else {
        // Architectural brushed limestone-titanium paver tile
        ctx.fillStyle = (r + c) % 2 === 0 ? '#64748b' : '#526277';
        ctx.fillRect(x + 3, y + 3, tile - 6, tile - 6);

        // Subtle stone bevel highlight
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 4, tile - 8, tile - 8);
      }
    }
  }

  // Subtle glowing cyan & gold circuit/water channels along tile seams
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.36)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 1024; i += 256) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWaterNormalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Rich tropical-coastal turquoise to sapphire ocean & river base
  const oceanGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
  oceanGrad.addColorStop(0, '#0284c7');
  oceanGrad.addColorStop(0.35, '#0ea5e9');
  oceanGrad.addColorStop(0.65, '#06b6d4');
  oceanGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Rolling ocean swells and deep aquamarine troughs
  for (let i = 0; i < 560; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const rx = 28 + Math.random() * 88;
    const ry = 8 + Math.random() * 22;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, rx);
    grad.addColorStop(
      0,
      i % 3 === 0
        ? 'rgba(186, 230, 253, 0.38)' // Sunlit wave crest
        : i % 3 === 1
        ? 'rgba(3, 105, 161, 0.34)' // Deep sapphire trough
        : 'rgba(34, 211, 238, 0.32)' // Turquoise lagoon shimmer
    );
    grad.addColorStop(0.6, 'rgba(14, 165, 233, 0.12)');
    grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // Interwoven crystalline caustic network & sparkling whitecap ripples
  for (let i = 0; i < 1100; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const w = 20 + Math.random() * 54;
    ctx.strokeStyle =
      i % 4 === 0
        ? 'rgba(240, 249, 255, 0.52)' // Whitecap foam glint
        : i % 4 === 1
        ? 'rgba(125, 211, 252, 0.40)' // Sky reflection ripple
        : i % 4 === 2
        ? 'rgba(103, 232, 249, 0.36)' // Aqua caustic filament
        : 'rgba(7, 89, 133, 0.26)';
    ctx.lineWidth = i % 4 === 0 ? 1.9 : 1.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.5, y - 6 + Math.random() * 12, x + w, y);
    ctx.stroke();
  }

  // Sun-glint diamond sparkles on water surface
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + (i % 2) * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm golden sunlit beach sand
  ctx.fillStyle = '#ebd0a4';
  ctx.fillRect(0, 0, 512, 512);

  // Soft wind-rippled coastal dune bands
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = y % 28 === 0 ? 'rgba(255, 251, 235, 0.22)' : 'rgba(194, 154, 104, 0.16)';
    ctx.fillRect(0, y, 512, 7);
  }

  // Fine quartz, coral & shell sand grains
  for (let i = 0; i < 8500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(255, 252, 240, 0.42)'
        : i % 3 === 1
        ? 'rgba(180, 138, 86, 0.28)'
        : 'rgba(230, 198, 148, 0.34)';
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCliffRockTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm coastal granite & limestone cliff rock
  ctx.fillStyle = '#788696';
  ctx.fillRect(0, 0, 512, 512);

  // Horizontal geological rock strata layers
  for (let y = 0; y < 512; y += 20) {
    ctx.fillStyle = y % 40 === 0 ? 'rgba(71, 85, 105, 0.34)' : 'rgba(203, 213, 225, 0.24)';
    ctx.fillRect(0, y, 512, 10 + (y % 7));
  }

  // Craggy granite blocks & coastal moss accents
  for (let i = 0; i < 680; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 12 + Math.random() * 38;
    const h = 8 + Math.random() * 22;
    ctx.fillStyle =
      i % 7 === 0
        ? 'rgba(74, 124, 68, 0.22)' // Coastal lichen/moss patch
        : i % 2 === 0
        ? 'rgba(51, 65, 85, 0.24)'
        : 'rgba(226, 232, 240, 0.20)';
    ctx.fillRect(x, y, w, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 4);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWoodPlankTexture(baseHex = '#a15c27'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  const planks = 12;
  const ph = 512 / planks;
  for (let p = 0; p < planks; p++) {
    const y = p * ph;
    ctx.fillStyle = p % 2 === 0 ? 'rgba(255,248,231,0.07)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, 512, ph);

    // Rich wood grain streaks
    for (let g = 0; g < 22; g++) {
      ctx.strokeStyle = g % 2 === 0 ? 'rgba(69,26,3,0.14)' : 'rgba(254,243,199,0.07)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const gy = y + 3 + Math.random() * (ph - 6);
      ctx.moveTo(0, gy);
      ctx.lineTo(512, gy + (Math.random() - 0.5) * 3);
      ctx.stroke();
    }

    // Plank seam
    ctx.strokeStyle = 'rgba(41, 21, 7, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Realistic slate-charcoal asphalt roadway pavement with subtle lane wear gradient
  const roadGrad = ctx.createLinearGradient(0, 0, 512, 0);
  roadGrad.addColorStop(0.0, '#334155');
  roadGrad.addColorStop(0.22, '#3b495e');
  roadGrad.addColorStop(0.5, '#334155');
  roadGrad.addColorStop(0.78, '#3b495e');
  roadGrad.addColorStop(1.0, '#334155');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt roller compaction bands & weathered micro-tar seams
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? 'rgba(15, 23, 42, 0.10)' : 'rgba(226, 232, 240, 0.04)';
    ctx.fillRect(0, y, 512, 32);
  }
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.lineWidth = 1.4;
  for (let s = 0; s < 14; s++) {
    const sx = 32 + Math.random() * 448;
    const sy = Math.random() * 512;
    const len = 35 + Math.random() * 90;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + (Math.random() - 0.5) * 14, sy + len * 0.5, sx + (Math.random() - 0.5) * 8, sy + len);
    ctx.stroke();
  }

  // High-density crushed granite & basalt aggregate pebble grain
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 42 + Math.floor(Math.random() * 58);
    ctx.fillStyle =
      i % 7 === 0
        ? 'rgba(226, 232, 240, 0.25)' // Quartz mineral glint
        : `rgb(${v}, ${v + 5}, ${v + 12})`;
    const sz = i % 5 === 0 ? 2.0 : 1.4;
    ctx.fillRect(x, y, sz, sz);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTireTreadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep vulcanized carbon-black rubber base
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 512, 512);

  // Circumferential drainage channels (vertical bands across UV)
  const channels = [96, 192, 320, 416];
  channels.forEach((cx) => {
    ctx.fillStyle = '#030712';
    ctx.fillRect(cx - 8, 0, 16, 512);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - 11, 0, 3, 512);
    ctx.fillRect(cx + 8, 0, 3, 512);
  });

  // Heavy-duty lateral chevron tread blocks & siping grooves
  const rows = 24;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    // Raised rubber tread lug highlight
    ctx.fillStyle = r % 2 === 0 ? '#1e293b' : '#172033';
    ctx.fillRect(12, y + 3, 72, rowH - 6);
    ctx.fillRect(108, y + 2, 72, rowH - 5);
    ctx.fillRect(204, y + 2, 104, rowH - 5);
    ctx.fillRect(332, y + 2, 72, rowH - 5);
    ctx.fillRect(428, y + 3, 72, rowH - 6);

    // Diagonal siping groove cuts
    ctx.strokeStyle = '#030712';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(16, y + rowH * 0.2);
    ctx.lineTo(84, y + rowH * 0.8);
    ctx.moveTo(496, y + rowH * 0.2);
    ctx.lineTo(428, y + rowH * 0.8);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPaverTexture(
  baseHex = '#dbe4ef',
  mortarHex = '#94a3b8'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW / 2);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;

      // Natural warm/cool travertine stone tone variation per paver
      const tone = (r * 3 + c * 5) % 3;
      ctx.fillStyle =
        tone === 0
          ? 'rgba(255,255,255,0.12)'
          : tone === 1
          ? 'rgba(254,243,199,0.10)'
          : 'rgba(15,23,42,0.06)';
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      ctx.strokeStyle = mortarHex;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, colW, rowH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFacadeTexture(
  wallHex: string,
  style: 'brick' | 'stucco' | 'siding' = 'stucco'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle sunlit top highlight & warm foundation ambient occlusion
  const aoGrad = ctx.createLinearGradient(0, 0, 0, 512);
  aoGrad.addColorStop(0, 'rgba(255,255,255,0.16)');
  aoGrad.addColorStop(0.8, 'rgba(0,0,0,0)');
  aoGrad.addColorStop(1, 'rgba(15,23,42,0.18)');
  ctx.fillStyle = aoGrad;
  ctx.fillRect(0, 0, 512, 512);

  if (style === 'brick') {
    const rows = 20;
    const cols = 10;
    const rh = 512 / rows;
    const cw = 512 / cols;
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.42)'; // Clean lime mortar joints
    ctx.lineWidth = 2.2;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw / 2);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle =
          (r + c) % 3 === 0
            ? 'rgba(154, 52, 18, 0.14)'
            : (r + c) % 3 === 1
            ? 'rgba(255,255,255,0.09)'
            : 'rgba(180, 83, 9, 0.10)';
        ctx.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
        ctx.strokeRect(c * cw + off, r * rh, cw, rh);
      }
    }
  } else if (style === 'siding') {
    const planks = 22;
    const ph = 512 / planks;
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = p % 2 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, p * ph, 512, ph);
      // Crisp clapboard lap shadow & top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, p * ph, 512, 2);
      ctx.fillStyle = 'rgba(15,23,42,0.16)';
      ctx.fillRect(0, (p + 1) * ph - 2.5, 512, 2.5);
    }
  } else {
    // Architectural cut-stone ashlar courses & fine Mediterranean stucco plaster
    const courses = 8;
    const ch = 512 / courses;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.26)';
    ctx.lineWidth = 1.6;
    for (let r = 0; r < courses; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ch);
      ctx.lineTo(512, r * ch);
      ctx.stroke();
    }
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.04)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRoofTileTexture(roofHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = roofHex;
  ctx.fillRect(0, 0, 512, 512);

  const rows = 16;
  const cols = 12;
  const rh = 512 / rows;
  const cw = 512 / cols;

  for (let r = 0; r < rows; r++) {
    // Terracotta / slate tile course shadow & sunlit ridge highlight
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, r * rh + rh - 5, 512, 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(0, r * rh, 512, 3);

    const off = (r % 2) * (cw / 2);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.26)';
    ctx.lineWidth = 2.2;
    for (let c = -1; c <= cols; c++) {
      // Subtle kiln-baked color variation per tile
      ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 6);

      ctx.beginPath();
      ctx.arc(c * cw + off + cw / 2, r * rh + rh / 2, cw / 2, 0, Math.PI);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGlassCurtainWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Reflective sapphire-sky glass curtain wall gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 512, 512);
  skyGrad.addColorStop(0, '#1e3a8a');
  skyGrad.addColorStop(0.5, '#0284c7');
  skyGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 512, 512);

  const rows = 16;
  const cols = 8;
  const rh = 512 / rows;
  const cw = 512 / cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      const y = r * rh;
      const isLit = (r * 7 + c * 3) % 5 === 0 || (r + c) % 4 === 0;
      ctx.fillStyle = isLit
        ? (r + c) % 2 === 0
          ? 'rgba(186, 230, 253, 0.55)'
          : 'rgba(254, 240, 138, 0.48)'
        : 'rgba(56, 189, 248, 0.18)';
      ctx.fillRect(x + 4, y + 4, cw - 8, rh - 8);

      // Brushed aluminum window mullion frame
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cw - 2, rh - 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTreeBarkTexture(baseHex = '#6b4423'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 512);

  // Vertical organic bark ridges and crevices
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const h = 28 + Math.random() * 90;
    ctx.strokeStyle =
      i % 3 === 0
        ? 'rgba(41, 22, 8, 0.45)'
        : i % 3 === 1
        ? 'rgba(146, 100, 58, 0.32)'
        : 'rgba(92, 60, 32, 0.35)';
    ctx.lineWidth = 2 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 10, y + h * 0.5, x, y + h);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFoliageTexture(
  species: 'pine' | 'oak' | 'sakura'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (species === 'pine') {
    // Rich evergreen spruce/fir needle base (🎄)
    ctx.fillStyle = '#0f6e43';
    ctx.fillRect(0, 0, 512, 512);

    // Layered pine bough fans and sunlit needle clusters
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 6 + Math.random() * 14;
      ctx.strokeStyle =
        i % 4 === 0
          ? 'rgba(52, 211, 153, 0.48)' // Fresh spring needle tips
          : i % 4 === 1
          ? 'rgba(6, 78, 59, 0.52)' // Deep bough shadow
          : i % 4 === 2
          ? 'rgba(16, 185, 129, 0.45)' // Emerald pine needles
          : 'rgba(110, 231, 183, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * r * 1.4, y + r);
      ctx.stroke();
    }
  } else if (species === 'oak') {
    // Sunlit broadleaf forest canopy
    ctx.fillStyle = '#228b3b';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const rx = 6 + Math.random() * 14;
      const ry = 4 + Math.random() * 9;
      ctx.fillStyle =
        i % 4 === 0
          ? 'rgba(74, 222, 128, 0.45)'
          : i % 4 === 1
          ? 'rgba(21, 128, 61, 0.48)'
          : i % 4 === 2
          ? 'rgba(134, 239, 172, 0.35)'
          : 'rgba(22, 101, 52, 0.42)';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Blooming Sakura cherry blossom canopy
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 950; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 5 + Math.random() * 11;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(253, 242, 248, 0.58)'
          : i % 3 === 1
          ? 'rgba(249, 168, 212, 0.52)'
          : 'rgba(236, 72, 153, 0.42)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createContactAOShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 120);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.20)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}
