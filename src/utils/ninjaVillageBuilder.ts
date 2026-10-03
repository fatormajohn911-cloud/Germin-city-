import * as THREE from 'three';
import { BuildingId } from '../types/game';

export interface NinjaVillageBuildResult {
  group: THREE.Group;
  buildingPickMeshes: { id: BuildingId; meshes: THREE.Object3D[] }[];
  updateAnimations: (elapsedTime: number, isNight: boolean) => void;
}

function createTextBannerTexture(
  title: string,
  subtitle: string,
  bgColor: string,
  textColor: string,
  borderColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 42px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, subtitle ? 60 : 80);

  if (subtitle) {
    ctx.font = 'bold 24px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = borderColor;
    ctx.fillText(subtitle, canvas.width / 2, 114);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createKanjiDiscTexture(
  kanji: string,
  bgHex: string,
  fgHex: string,
  ringHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fillStyle = bgHex;
  ctx.fill();

  ctx.lineWidth = 12;
  ctx.strokeStyle = ringHex;
  ctx.stroke();

  ctx.fillStyle = fgHex;
  ctx.font = 'bold 132px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kanji, 128, 136);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createKonohaGatePlaqueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  // Rich forest-green plaque board with warm timber & gold frame
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 146);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 480, 128);

  // Left & Right traditional Gate Seal Kanji ("あ" / "ん")
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 74px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('あ', 92, 82);
  ctx.fillText('ん', 420, 82);

  // Center Crimson Konoha Spiral Leaf Emblem
  ctx.save();
  ctx.translate(256, 80);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 3.3; a += 0.15) {
    const r = 4 + a * 4.2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Leaf point & stem
  ctx.beginPath();
  ctx.moveTo(28, -28);
  ctx.lineTo(54, -4);
  ctx.lineTo(24, 24);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRamenSwirlSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fillStyle = '#fef3c7';
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();

  // Red Narutomaki Swirl inside disc
  ctx.save();
  ctx.translate(128, 128);
  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 3.5; a += 0.15) {
    const r = 6 + a * 7.8;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the Extended Northern Scenic Road Trip Highway (z = -38.5 to -788, 750m long = 2.78x distance)
 * and the realistic Naruto Shippuden-inspired Hidden Leaf Ninja Village (z = -788 to -928) matching the reference artwork.
 */
export function buildNinjaVillageAndHighway(): NinjaVillageBuildResult {
  const outerRoot = new THREE.Group();
  outerRoot.name = 'HiddenLeafNinjaRegion';

  const highwayRoot = new THREE.Group();
  highwayRoot.name = 'ExtendedNorthernRoadJourney';
  outerRoot.add(highwayRoot);

  // Preserve the Hidden Leaf Ninja Village inside `root` shifted by z = -480
  // so its entrance gate sits at z = -788 (750m north of Gemini City!)
  const root = new THREE.Group();
  root.name = 'HiddenLeafVillageSanctuary';
  root.position.set(0, 0, -480);
  outerRoot.add(root);

  const buildingPickMeshes: { id: BuildingId; meshes: THREE.Object3D[] }[] = [];
  const registerPickable = (id: BuildingId, obj: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = [];
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData = { type: 'building', buildingId: id };
        meshes.push(child);
      }
    });
    const existing = buildingPickMeshes.find((b) => b.id === id);
    if (existing) {
      existing.meshes.push(...meshes);
    } else {
      buildingPickMeshes.push({ id, meshes });
    }
  };

  // Shared Materials
  const roadAsphaltMat = new THREE.MeshStandardMaterial({
    color: '#293241',
    roughness: 0.72,
    metalness: 0.08,
  });
  const roadCurbMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.6,
  });
  const laneGoldMat = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
  const villageEarthRoadMat = new THREE.MeshStandardMaterial({
    color: '#c2a685',
    roughness: 0.86,
    metalness: 0.02,
  });
  const villageStonePavingMat = new THREE.MeshStandardMaterial({
    color: '#a8a29e',
    roughness: 0.76,
  });
  const meadowGrassMat = new THREE.MeshStandardMaterial({
    color: '#3f7d4c',
    roughness: 0.86,
  });
  const forestGrassMat = new THREE.MeshStandardMaterial({
    color: '#2d5a3c',
    roughness: 0.88,
  });
  const villageGrassMat = new THREE.MeshStandardMaterial({
    color: '#4d8b55',
    roughness: 0.84,
  });
  const cliffStoneMat = new THREE.MeshStandardMaterial({
    color: '#8c7a6b',
    roughness: 0.85,
    metalness: 0.04,
  });
  // Realistic warm sandstone & ochre cliff rock matching the Hokage Mountain in the reference image
  const sandstoneCliffMat = new THREE.MeshStandardMaterial({
    color: '#c89d70',
    roughness: 0.82,
    metalness: 0.04,
  });
  const sandstoneStrataMat = new THREE.MeshStandardMaterial({
    color: '#ad8257',
    roughness: 0.86,
    metalness: 0.04,
  });
  const hokageCarvedRockMat = new THREE.MeshStandardMaterial({
    color: '#d9b38c',
    roughness: 0.72,
    metalness: 0.05,
  });
  const alpinePeakMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.88,
    metalness: 0.06,
  });
  const crimsonLacquerMat = new THREE.MeshStandardMaterial({
    color: '#dc2626',
    roughness: 0.35,
    metalness: 0.12,
  });
  const darkTimberMat = new THREE.MeshStandardMaterial({
    color: '#451a03',
    roughness: 0.75,
  });
  const warmWoodMat = new THREE.MeshStandardMaterial({
    color: '#92400e',
    roughness: 0.68,
  });
  const plasterWallMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.65,
  });
  const warmCreamWallMat = new THREE.MeshStandardMaterial({
    color: '#fef3c7',
    roughness: 0.68,
  });
  const civicBlueWallMat = new THREE.MeshStandardMaterial({
    color: '#e0f2fe',
    roughness: 0.62,
  });
  const greenTileRoofMat = new THREE.MeshStandardMaterial({
    color: '#15803d',
    roughness: 0.48,
    metalness: 0.12,
  });
  const tealPagodaRoofMat = new THREE.MeshStandardMaterial({
    color: '#0d9488',
    roughness: 0.44,
    metalness: 0.15,
  });
  const cobaltDomeMat = new THREE.MeshStandardMaterial({
    color: '#1d4ed8',
    roughness: 0.4,
    metalness: 0.18,
  });
  const ochreRoofMat = new THREE.MeshStandardMaterial({
    color: '#d97706',
    roughness: 0.48,
    metalness: 0.1,
  });
  const darkSlateRoofMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.52,
    metalness: 0.15,
  });
  const terracottaRoofMat = new THREE.MeshStandardMaterial({
    color: '#c2410c',
    roughness: 0.48,
    metalness: 0.1,
  });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#f59e0b',
    emissiveIntensity: 1.35,
    roughness: 0.2,
  });
  const redLanternGlowMat = new THREE.MeshStandardMaterial({
    color: '#fca5a5',
    emissive: '#ef4444',
    emissiveIntensity: 1.25,
    roughness: 0.25,
  });
  const nightWindowMat = new THREE.MeshStandardMaterial({
    color: '#fde68a',
    emissive: '#f59e0b',
    emissiveIntensity: 0.55,
    roughness: 0.3,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    metalness: 0.85,
    roughness: 0.2,
  });

  const animatedWatermills: THREE.Object3D[] = [];
  const animatedWaterfalls: THREE.Mesh[] = [];
  const animatedGuardArms: THREE.Object3D[] = [];

  // Helper: Traditional Japanese / Shinobi Pagoda Roof Tier
  const createPagodaRoof = (
    width: number,
    depth: number,
    height: number,
    mat: THREE.Material
  ): THREE.Group => {
    const rg = new THREE.Group();
    const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.76, height, 4), mat);
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
    mainRoof.position.y = height * 0.5;
    mainRoof.castShadow = true;
    mainRoof.receiveShadow = true;
    rg.add(mainRoof);

    // Sweeping Eave Trim
    const eavePlate = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.08, 0.22, depth * 1.08),
      mat
    );
    eavePlate.position.y = 0.11;
    eavePlate.castShadow = true;
    rg.add(eavePlate);
    return rg;
  };

  // Helper: Glowing Japanese Stone / Paper Lantern
  const createStoneLantern = (x: number, y: number, z: number, scale = 1): THREE.Group => {
    const lg = new THREE.Group();
    lg.position.set(x, y, z);
    lg.scale.setScalar(scale);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.28, 8), cliffStoneMat);
    base.position.y = 0.14;
    lg.add(base);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.2, 8), cliffStoneMat);
    post.position.y = 0.84;
    post.castShadow = true;
    lg.add(post);

    const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.46), lanternGlowMat);
    chamber.position.y = 1.64;
    lg.add(chamber);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.36, 6), cliffStoneMat);
    cap.position.y = 2.02;
    lg.add(cap);

    return lg;
  };

  // Helper: Pine / Cedar / Sakura Tree
  const createScenicTree = (
    x: number,
    y: number,
    z: number,
    style: 'pine' | 'sakura' | 'giant_shinobi',
    scale = 1
  ): THREE.Group => {
    const tg = new THREE.Group();
    tg.position.set(x, y, z);
    tg.scale.setScalar(scale);

    const trunkH = style === 'giant_shinobi' ? 8.5 : style === 'pine' ? 3.8 : 3.2;
    const trunkR = style === 'giant_shinobi' ? 0.85 : 0.28;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkR * 0.65, trunkR, trunkH, 10),
      darkTimberMat
    );
    trunk.position.y = trunkH * 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tg.add(trunk);

    if (style === 'pine' || style === 'giant_shinobi') {
      const foliageColor = style === 'giant_shinobi' ? '#14532d' : '#166534';
      const foliageMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.82 });
      const tiers = style === 'giant_shinobi' ? 4 : 3;
      for (let t = 0; t < tiers; t++) {
        const coneR = (style === 'giant_shinobi' ? 3.6 : 1.95) * (1 - t * 0.18);
        const coneH = style === 'giant_shinobi' ? 3.8 : 2.3;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(coneR, coneH, 10), foliageMat);
        cone.position.y = trunkH * 0.55 + t * (coneH * 0.58);
        cone.castShadow = true;
        tg.add(cone);
      }
    } else {
      const sakuraMat = new THREE.MeshStandardMaterial({
        color: '#f9a8d4',
        emissive: '#f472b6',
        emissiveIntensity: 0.12,
        roughness: 0.7,
      });
      for (const [ox, oy, oz, r] of [
        [0, 3.4, 0, 1.65],
        [-1.0, 3.0, 0.6, 1.2],
        [1.0, 3.1, -0.5, 1.25],
        [0.4, 3.7, 0.8, 1.1],
      ]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), sakuraMat);
        puff.scale.set(1.15, 0.78, 1.15);
        puff.position.set(ox, oy, oz);
        puff.castShadow = true;
        tg.add(puff);
      }
    }
    return tg;
  };

  // ============================================================================
  // PART 1: THE EXTENDED GREAT NORTHERN ROAD JOURNEY (z = -38.5 to -788.5 · 750m!)
  // Progression:
  //   🌆 Gemini City (z = 0..-38.5)
  //   ↓ 🏙️ City Outskirts (z = -38.5..-115)
  //   ↓ 🛣️ Long Highway & Rest Plaza (z = -115..-225)
  //   ↓ 🌾 Countryside, Golden Farms & Watermill (z = -225..-340)
  //   ↓ 🏘️ Small Roadside Settlement "Sakura Crossing" (z = -340..-435)
  //   ↓ 🌳 Forest Road & Woodland Stream (z = -435..-530)
  //   ↓ 🌉 Great Canyon River & Arch Bridge (z = -530..-595)
  //   ↓ ⛰️ Hills, Winding Mountain Road & Rock Tunnel (z = -595..-705)
  //   ↓ 🌲 Dense Ancient Shinobi Forest & Torii Corridor (z = -705..-788)
  //   ↓ 🍃 Hidden Leaf Ninja Village (z = -788..-928)
  // ============================================================================
  const highwayLength = 750; // z = -38.5 to -788.5 (2.78x longer road journey!)
  const highwayCenterZ = -38.5 - highwayLength / 2; // -413.5

  // 1A. Continuous Paved Two-Lane Scenic Highway + Curbs + Instanced Dashed Gold Centerline
  const mainHighwayRoad = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 0.26, highwayLength),
    roadAsphaltMat
  );
  mainHighwayRoad.position.set(0, -0.02, highwayCenterZ);
  mainHighwayRoad.receiveShadow = true;
  mainHighwayRoad.userData = { type: 'ground' };
  highwayRoot.add(mainHighwayRoad);

  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.34, highwayLength),
      roadCurbMat
    );
    sidewalk.position.set(side * 6.05, 0.02, highwayCenterZ);
    sidewalk.receiveShadow = true;
    sidewalk.userData = { type: 'ground' };
    highwayRoot.add(sidewalk);
  }

  // Mobile-Optimized InstancedMesh for all 114 Highway Centerline Dashes (1 draw call)
  const dashCount = 114;
  const dashGeo = new THREE.PlaneGeometry(0.28, 3.0);
  dashGeo.rotateX(-Math.PI / 2);
  const instancedDashes = new THREE.InstancedMesh(dashGeo, laneGoldMat, dashCount);
  const dummyMat = new THREE.Matrix4();
  for (let i = 0; i < dashCount; i++) {
    const z = -44 - i * 6.5;
    dummyMat.makeTranslation(0, 0.125, z);
    instancedDashes.setMatrixAt(i, dummyMat);
  }
  instancedDashes.instanceMatrix.needsUpdate = true;
  highwayRoot.add(instancedDashes);

  // ============================================================================
  // ZONE 1: 🏙️ CITY OUTSKIRTS (z = -38.5 to -115)
  // Wider roads, transition from modern city lighting to suburban cottages & greenery
  // ============================================================================
  const outskirtsChunk = new THREE.Group();
  outskirtsChunk.name = 'Zone1_CityOutskirts';
  highwayRoot.add(outskirtsChunk);

  const outskirtsGround = new THREE.Mesh(
    new THREE.BoxGeometry(96, 0.5, 80),
    meadowGrassMat
  );
  outskirtsGround.position.set(0, -0.26, -78);
  outskirtsGround.receiveShadow = true;
  outskirtsGround.userData = { type: 'ground' };
  outskirtsChunk.add(outskirtsGround);

  // Highway Welcome Gantry Sign at z = -46
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(0, 0, -46);
  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.7,
    roughness: 0.3,
  });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 7.2, 12),
      gantrySteelMat
    );
    pillar.position.set(side * 6.4, 3.6, 0);
    pillar.castShadow = true;
    gantryGroup.add(pillar);
  }
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.35, 0.35), gantrySteelMat);
  crossbar.position.set(0, 6.8, 0);
  gantryGroup.add(crossbar);

  const hwyBannerTex = createTextBannerTexture(
    '🍥 SHINOBI NORTH EXPRESSWAY',
    'COUNTRYSIDE · POST TOWN · HIDDEN LEAF VILLAGE (750M ↑)',
    '#065f46',
    '#ffffff',
    '#fbbf24'
  );
  const hwySignBoard = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 2.15, 0.22),
    new THREE.MeshBasicMaterial({ map: hwyBannerTex })
  );
  hwySignBoard.position.set(0, 6.8, 0.18);
  gantryGroup.add(hwySignBoard);
  outskirtsChunk.add(gantryGroup);

  // Outskirts Modern-to-Suburban Transition Houses & Highway Light Poles (z = -56 to -108)
  for (const [hx, hz, wallHex, roofHex] of [
    [-19, -58, '#f1f5f9', '#334155'],
    [19, -64, '#fef3c7', '#92400e'],
    [-21, -84, '#e0f2fe', '#1e3a8a'],
    [21, -92, '#fce7f3', '#831843'],
    [-18, -106, '#f8fafc', '#475569'],
  ] as [number, number, string, string][]) {
    const subHouse = new THREE.Group();
    subHouse.position.set(hx, 0, hz);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 4.2, 6.2),
      new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.65 })
    );
    body.position.y = 2.1;
    body.castShadow = true;
    body.receiveShadow = true;
    subHouse.add(body);
    const roof = createPagodaRoof(
      8.2,
      6.8,
      2.4,
      new THREE.MeshStandardMaterial({ color: roofHex, roughness: 0.55 })
    );
    roof.position.y = 4.2;
    subHouse.add(roof);
    outskirtsChunk.add(subHouse);
  }

  // Spacing-out Outskirts Highway Streetlights (gradually ending as city transitions to nature)
  for (const lz of [-52, -72, -96, -114]) {
    for (const side of [-1, 1]) {
      const lampPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 5.6, 8),
        gantrySteelMat
      );
      lampPole.position.set(side * 6.6, 2.8, lz);
      outskirtsChunk.add(lampPole);
      const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.36), lanternGlowMat);
      lampHead.position.set(side * 6.1, 5.6, lz);
      outskirtsChunk.add(lampHead);
    }
  }

  // ============================================================================
  // ZONE 2: 🛣️ LONG HIGHWAY & OPEN GRASSLANDS (z = -115 to -225)
  // Open cruising stretch, rolling grassland hills, distance signs & Rest Area
  // ============================================================================
  const longHighwayChunk = new THREE.Group();
  longHighwayChunk.name = 'Zone2_LongHighway';
  highwayRoot.add(longHighwayChunk);

  const highwayMeadowGround = new THREE.Mesh(
    new THREE.BoxGeometry(132, 0.5, 114),
    meadowGrassMat
  );
  highwayMeadowGround.position.set(0, -0.26, -170);
  highwayMeadowGround.receiveShadow = true;
  highwayMeadowGround.userData = { type: 'ground' };
  longHighwayChunk.add(highwayMeadowGround);

  // Sweeping Open Grassland Hills on the Horizon
  for (const [hx, hz, rx, ry, rz] of [
    [-42, -135, 22, 6.5, 26],
    [44, -148, 24, 7.5, 28],
    [-46, -195, 25, 8.5, 26],
    [42, -205, 22, 7.0, 24],
  ]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), meadowGrassMat);
    hill.scale.set(rx, ry, rz);
    hill.position.set(hx, -1.2, hz);
    hill.receiveShadow = true;
    longHighwayChunk.add(hill);
  }

  // Highway Rest Stop & Traveler Kiosk at (x = 16, z = -168)
  const restStopGroup = new THREE.Group();
  restStopGroup.position.set(15.5, 0, -168);
  const parkingApron = new THREE.Mesh(new THREE.BoxGeometry(16, 0.18, 26), roadAsphaltMat);
  parkingApron.position.set(-3.5, 0.01, 0);
  parkingApron.receiveShadow = true;
  parkingApron.userData = { type: 'ground' };
  restStopGroup.add(parkingApron);

  const kioskBody = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.9, 9.0), warmCreamWallMat);
  kioskBody.position.set(1.8, 1.95, 0);
  kioskBody.castShadow = true;
  restStopGroup.add(kioskBody);

  const kioskRoof = createPagodaRoof(8.6, 10.2, 2.2, terracottaRoofMat);
  kioskRoof.position.set(1.8, 3.9, 0);
  restStopGroup.add(kioskRoof);

  const restSignTex = createTextBannerTexture(
    '⛽🛣️ HIGHWAY TRAVEL PLAZA & REST AREA',
    'SCENIC OVERLOOK · ESPRESSO & GREEN TEA · 620M TO KONOHA',
    '#065f46',
    '#fef08a',
    '#f59e0b'
  );
  const restSign = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 1.35, 0.18),
    new THREE.MeshBasicMaterial({ map: restSignTex })
  );
  restSign.position.set(-2.2, 4.5, 0);
  restSign.rotation.y = -Math.PI / 2;
  restStopGroup.add(restSign);
  longHighwayChunk.add(restStopGroup);

  // ============================================================================
  // ZONE 3: 🌾 COUNTRYSIDE, FARMLANDS & WATERMILL (z = -225 to -340)
  // Golden crop fields, farmhouses, rotating watermill, red barn & grain silo
  // ============================================================================
  const countrysideChunk = new THREE.Group();
  countrysideChunk.name = 'Zone3_CountrysideFarms';
  highwayRoot.add(countrysideChunk);

  const countrysideGround = new THREE.Mesh(
    new THREE.BoxGeometry(140, 0.5, 118),
    meadowGrassMat
  );
  countrysideGround.position.set(0, -0.26, -282);
  countrysideGround.receiveShadow = true;
  countrysideGround.userData = { type: 'ground' };
  countrysideChunk.add(countrysideGround);

  // Golden Wheat & Rice Farmland Plots flanking the Countryside Highway
  const goldenCropMat = new THREE.MeshStandardMaterial({
    color: '#ca8a04',
    roughness: 0.9,
  });
  const freshCropMat = new THREE.MeshStandardMaterial({
    color: '#65a30d',
    roughness: 0.88,
  });
  for (const [fx, fz, fw, fd, isGold] of [
    [-26, -245, 24, 32, true],
    [26, -252, 24, 34, false],
    [-28, -308, 26, 30, false],
    [28, -315, 24, 28, true],
  ] as [number, number, number, number, boolean][]) {
    const fieldPlot = new THREE.Mesh(
      new THREE.BoxGeometry(fw, 0.22, fd),
      isGold ? goldenCropMat : freshCropMat
    );
    fieldPlot.position.set(fx, 0.08, fz);
    fieldPlot.receiveShadow = true;
    countrysideChunk.add(fieldPlot);
  }

  // Rotating Countryside Watermill Farmhouse at (x = -19, z = -274)
  const millGroup = new THREE.Group();
  millGroup.position.set(-19, 0, -274);
  const millHouse = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.8, 7.2), warmCreamWallMat);
  millHouse.position.y = 2.4;
  millHouse.castShadow = true;
  millGroup.add(millHouse);
  const millRoof = createPagodaRoof(9.4, 8.4, 2.8, darkTimberMat);
  millRoof.position.y = 4.8;
  millGroup.add(millRoof);

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(4.4, 2.4, 0);
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.18, 10, 20), warmWoodMat);
  wheelRim.rotation.y = Math.PI / 2;
  wheelGroup.add(wheelRim);
  for (let s = 0; s < 6; s++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.2, 0.28), warmWoodMat);
    spoke.rotation.x = (s * Math.PI) / 6;
    wheelGroup.add(spoke);
  }
  millGroup.add(wheelGroup);
  animatedWatermills.push(wheelGroup);
  countrysideChunk.add(millGroup);

  // Countryside Timber Barn & Grain Silo at (x = 22, z = -286)
  const barnGroup = new THREE.Group();
  barnGroup.position.set(22, 0, -286);
  const barnBody = new THREE.Mesh(new THREE.BoxGeometry(9.2, 5.4, 8.0), terracottaRoofMat);
  barnBody.position.y = 2.7;
  barnBody.castShadow = true;
  barnGroup.add(barnBody);
  const barnRoof = createPagodaRoof(10.4, 9.0, 2.6, darkTimberMat);
  barnRoof.position.y = 5.4;
  barnGroup.add(barnRoof);
  const grainSilo = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 8.2, 14),
    plasterWallMat
  );
  grainSilo.position.set(6.4, 4.1, -1.5);
  grainSilo.castShadow = true;
  barnGroup.add(grainSilo);
  const siloDome = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    roadCurbMat
  );
  siloDome.position.set(6.4, 8.2, -1.5);
  barnGroup.add(siloDome);
  countrysideChunk.add(barnGroup);

  // ============================================================================
  // ZONE 4: 🏘️ SMALL ROADSIDE SETTLEMENT — "SAKURA CROSSING POST TOWN" (z = -340 to -435)
  // Traditional halfway post town with tea shop, roadside inn, general store & lanterns
  // ============================================================================
  const settlementChunk = new THREE.Group();
  settlementChunk.name = 'Zone4_RoadsideSettlement';
  highwayRoot.add(settlementChunk);

  const settlementGround = new THREE.Mesh(
    new THREE.BoxGeometry(136, 0.5, 98),
    meadowGrassMat
  );
  settlementGround.position.set(0, -0.26, -388);
  settlementGround.receiveShadow = true;
  settlementGround.userData = { type: 'ground' };
  settlementChunk.add(settlementGround);

  // Stone Cobblestone Pull-off Aprons on both sides of the Settlement Street
  for (const side of [-1, 1]) {
    const townApron = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.16, 56),
      villageStonePavingMat
    );
    townApron.position.set(side * 12.2, 0.02, -386);
    townApron.receiveShadow = true;
    townApron.userData = { type: 'ground' };
    settlementChunk.add(townApron);
  }

  // Roadside Settlement Welcome Signboard at (x = -9.5, z = -348)
  const postTownSignTex = createTextBannerTexture(
    '🏘️ SAKURA CROSSING SETTLEMENT',
    'ROADSIDE TEA HOUSE · TRAVELER INN · 400M TO HIDDEN LEAF ↑',
    '#7c2d12',
    '#fef08a',
    '#fbbf24'
  );
  const postTownSign = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 1.55, 0.2),
    new THREE.MeshBasicMaterial({ map: postTownSignTex })
  );
  postTownSign.position.set(-10.2, 3.4, -348);
  postTownSign.rotation.y = 0.22;
  settlementChunk.add(postTownSign);
  const signPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.4, 8), darkTimberMat);
  signPostL.position.set(-10.2, 1.7, -348);
  settlementChunk.add(signPostL);

  // 4 Charming Roadside Settlement Buildings (Tea & Dango Shop, Traveler's Inn, General Store, Craft Hall)
  const settlementBuildings: [
    number,
    number,
    number,
    number,
    number,
    string,
    'green' | 'red' | 'slate',
    string
  ][] = [
    [-15.5, -368, 8.2, 4.8, 7.4, '#fef3c7', 'red', '🍵 DANGO & TEA SHOP'],
    [15.8, -372, 9.0, 6.2, 8.2, '#f8fafc', 'green', '🏮 TRAVELER’S INN'],
    [-16.0, -398, 8.4, 4.6, 7.2, '#ffedd5', 'slate', '🌾 COUNTRY MARKET'],
    [15.8, -402, 8.0, 5.0, 7.0, '#fef3c7', 'red', '🛠️ WOODCRAFT HALL'],
  ];

  for (const [bx, bz, bw, bh, bd, wallHex, roofStyle, bannerText] of settlementBuildings) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0, bz);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bw, bh, bd),
      new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.66 })
    );
    body.position.y = bh * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    bGroup.add(body);

    const rMat =
      roofStyle === 'green'
        ? greenTileRoofMat
        : roofStyle === 'red'
        ? terracottaRoofMat
        : darkSlateRoofMat;
    const roof = createPagodaRoof(bw * 1.15, bd * 1.15, 2.5, rMat);
    roof.position.y = bh;
    bGroup.add(roof);

    const shopTex = createTextBannerTexture(bannerText, '', '#1e293b', '#fef08a', '#f59e0b');
    const shopSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.95, 0.14),
      new THREE.MeshBasicMaterial({ map: shopTex })
    );
    shopSign.position.set(bx < 0 ? bw * 0.52 : -bw * 0.52, bh * 0.68, 0);
    shopSign.rotation.y = bx < 0 ? Math.PI / 2 : -Math.PI / 2;
    bGroup.add(shopSign);

    settlementChunk.add(bGroup);
  }

  // Settlement Stone Lanterns & Sakura Trees lining the Post Town street
  for (const sz of [-358, -384, -412]) {
    settlementChunk.add(createStoneLantern(-7.4, 0, sz, 0.95));
    settlementChunk.add(createStoneLantern(7.4, 0, sz, 0.95));
    settlementChunk.add(createScenicTree(-11.5, 0, sz - 6, 'sakura', 1.05));
    settlementChunk.add(createScenicTree(11.5, 0, sz - 6, 'sakura', 1.05));
  }

  // ============================================================================
  // ZONE 5: 🌳 FOREST ROAD & WOODLAND STREAM (z = -435 to -530)
  // Dense woodland canopy, meandering crystal forest stream & mossy rocks
  // ============================================================================
  const forestRoadChunk = new THREE.Group();
  forestRoadChunk.name = 'Zone5_ForestRoad';
  highwayRoot.add(forestRoadChunk);

  const forestRoadGround = new THREE.Mesh(
    new THREE.BoxGeometry(142, 0.5, 98),
    forestGrassMat
  );
  forestRoadGround.position.set(0, -0.26, -482);
  forestRoadGround.receiveShadow = true;
  forestRoadGround.userData = { type: 'ground' };
  forestRoadChunk.add(forestRoadGround);

  // Turquoise Woodland Stream meandering parallel to the Forest Road (x = -12.5, z = -438 to -545)
  const riverWaterMat = new THREE.MeshStandardMaterial({
    color: '#06b6d4',
    emissive: '#0891b2',
    emissiveIntensity: 0.22,
    roughness: 0.15,
    metalness: 0.35,
  });
  const woodlandStream = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 108), riverWaterMat);
  woodlandStream.position.set(-12.8, -0.06, -490);
  forestRoadChunk.add(woodlandStream);

  // Mossy Boulders along the Woodland Stream
  for (const [rx, rz, rs] of [
    [-9.8, -450, 1.4],
    [-15.8, -468, 1.8],
    [-9.5, -488, 1.5],
    [-16.2, -508, 1.9],
    [-9.8, -522, 1.6],
  ]) {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 1), cliffStoneMat);
    boulder.scale.set(1.2, 0.75, 1.1);
    boulder.position.set(rx, rs * 0.35, rz);
    boulder.castShadow = true;
    forestRoadChunk.add(boulder);
  }

  // ============================================================================
  // ZONE 6: 🌉 GREAT CANYON RIVER & ARCH BRIDGE (z = -530 to -595)
  // Wide canyon river, cascading cliffside waterfall & grand crimson bridge
  // ============================================================================
  const canyonBridgeChunk = new THREE.Group();
  canyonBridgeChunk.name = 'Zone6_CanyonBridge';
  highwayRoot.add(canyonBridgeChunk);

  const canyonGround = new THREE.Mesh(
    new THREE.BoxGeometry(148, 0.5, 68),
    forestGrassMat
  );
  canyonGround.position.set(0, -0.26, -562);
  canyonGround.receiveShadow = true;
  canyonGround.userData = { type: 'ground' };
  canyonBridgeChunk.add(canyonGround);

  // Wide Turquoise Canyon River crossing under the Highway at z = -562
  const riverBed = new THREE.Mesh(new THREE.BoxGeometry(148, 0.38, 24), riverWaterMat);
  riverBed.position.set(0, -0.08, -562);
  canyonBridgeChunk.add(riverBed);

  // Western Canyon Cliff & Animated Waterfall at (x = -46, z = -562)
  const waterfallCliff = new THREE.Mesh(new THREE.ConeGeometry(16, 34, 8), cliffStoneMat);
  waterfallCliff.position.set(-52, 16, -562);
  waterfallCliff.castShadow = true;
  canyonBridgeChunk.add(waterfallCliff);

  const waterfallSheet = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 26, 7.5),
    new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: '#06b6d4',
      emissiveIntensity: 0.45,
      roughness: 0.1,
    })
  );
  waterfallSheet.position.set(-41.5, 13, -562);
  canyonBridgeChunk.add(waterfallSheet);
  animatedWaterfalls.push(waterfallSheet);

  // Grand Crimson Timber & Gold Arch Bridge over the Canyon River at z = -562
  const riverBridgeGroup = new THREE.Group();
  riverBridgeGroup.position.set(0, 0, -562);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.4, 28), crimsonLacquerMat);
    rail.position.set(side * 5.85, 0.88, 0);
    rail.castShadow = true;
    riverBridgeGroup.add(rail);

    const lowerArchBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.42, 28),
       crimsonLacquerMat
    );
    lowerArchBeam.position.set(side * 5.85, 0.32, 0);
    riverBridgeGroup.add(lowerArchBeam);

    for (let pz = -12; pz <= 12; pz += 4) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.3, 1.95, 10),
        crimsonLacquerMat
      );
      post.position.set(side * 5.85, 1.12, pz);
      riverBridgeGroup.add(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 10), goldTrimMat);
      cap.position.set(side * 5.85, 2.14, pz);
      riverBridgeGroup.add(cap);
    }
  }
  canyonBridgeChunk.add(riverBridgeGroup);

  // ============================================================================
  // ZONE 7: ⛰️ HILLS, WINDING MOUNTAIN ROAD & ROCK TUNNEL (z = -595 to -705)
  // Towering mountain cliffs, scenic valley viewpoint & lantern-lit rock tunnel
  // ============================================================================
  const mountainRoadChunk = new THREE.Group();
  mountainRoadChunk.name = 'Zone7_MountainRoad';
  highwayRoot.add(mountainRoadChunk);

  const mountainPassGround = new THREE.Mesh(
    new THREE.BoxGeometry(150, 0.5, 114),
    forestGrassMat
  );
  mountainPassGround.position.set(0, -0.26, -650);
  mountainPassGround.receiveShadow = true;
  mountainPassGround.userData = { type: 'ground' };
  mountainRoadChunk.add(mountainPassGround);

  // Towering Mountain Range Peaks, Sandstone Crags & Stone-Arch Gorge Viaduct ("Mountain Path - Higher paths, greater views")
  for (const [mx, mz, mr, mh, isAlpine] of [
    [-44, -612, 20, 38, false],
    [46, -618, 22, 42, true],
    [-48, -648, 24, 46, true],
    [44, -654, 21, 40, false],
    [-46, -696, 22, 44, false],
    [48, -700, 24, 48, true],
  ] as [number, number, number, number, boolean][]) {
    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(mr, mh, 8),
      isAlpine ? alpinePeakMat : sandstoneCliffMat
    );
    peak.position.set(mx, mh * 0.46, mz);
    peak.castShadow = true;
    peak.receiveShadow = true;
    peak.userData = { type: 'decor' };
    mountainRoadChunk.add(peak);
  }

  // Stone-Arch Mountain Gorge Viaduct spanning between eastern crags at (x = 32, z = -636)
  const mountainViaduct = new THREE.Group();
  mountainViaduct.position.set(32, 0, -636);
  const viaductDeck = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 5.2), sandstoneStrataMat);
  viaductDeck.position.set(0, 14.5, 0);
  viaductDeck.userData = { type: 'decor' };
  mountainViaduct.add(viaductDeck);
  for (const px of [-9, 0, 9]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.6, 14.5, 4.4), sandstoneStrataMat);
    pier.position.set(px, 7.25, 0);
    pier.userData = { type: 'decor' };
    mountainViaduct.add(pier);
  }
  mountainRoadChunk.add(mountainViaduct);

  // Mountain Valley Scenic Viewpoint Overlook at (x = -15.5, z = -634)
  const mountainVistaGroup = new THREE.Group();
  mountainVistaGroup.position.set(-15.5, 0, -634);
  const vistaDeck = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.55, 10.0), warmWoodMat);
  vistaDeck.position.y = 0.28;
  vistaDeck.receiveShadow = true;
  vistaDeck.userData = { type: 'ground' };
  mountainVistaGroup.add(vistaDeck);
  mountainVistaGroup.add(createStoneLantern(-4.2, 0.55, -4.0, 0.95));
  mountainVistaGroup.add(createStoneLantern(4.2, 0.55, 4.0, 0.95));
  const vistaSignTex = createTextBannerTexture(
    '⛰️ SHINOBI MOUNTAIN SCENIC VIEWPOINT',
    'VALLEY OVERLOOK · 155M TO HIDDEN LEAF VILLAGE ↑',
    '#1e293b',
    '#fef08a',
    '#fbbf24'
  );
  const vistaSign = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 1.2, 0.16),
    new THREE.MeshBasicMaterial({ map: vistaSignTex })
  );
  vistaSign.position.set(0, 2.5, -4.4);
  vistaSign.userData = { type: 'decor' };
  mountainVistaGroup.add(vistaSign);
  mountainRoadChunk.add(mountainVistaGroup);

  // Dramatic Mountain Rock Tunnel at z = -678 (Players drive through it before the Deep Shinobi Forest!)
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(0, 0, -678);
  for (const side of [-1, 1]) {
    const tunnelWall = new THREE.Mesh(new THREE.BoxGeometry(7.5, 9.5, 22), sandstoneStrataMat);
    tunnelWall.position.set(side * 10.2, 4.75, 0);
    tunnelWall.castShadow = true;
    tunnelWall.receiveShadow = true;
    tunnelWall.userData = { type: 'decor' };
    tunnelGroup.add(tunnelWall);

    const cliffFlank = new THREE.Mesh(new THREE.ConeGeometry(15, 28, 9), sandstoneCliffMat);
    cliffFlank.position.set(side * 23, 13, 0);
    cliffFlank.castShadow = true;
    cliffFlank.userData = { type: 'decor' };
    tunnelGroup.add(cliffFlank);
  }
  const tunnelRoof = new THREE.Mesh(new THREE.BoxGeometry(28, 4.8, 22), sandstoneCliffMat);
  tunnelRoof.position.set(0, 10.4, 0);
  tunnelRoof.castShadow = true;
  tunnelRoof.userData = { type: 'decor' };
  tunnelGroup.add(tunnelRoof);

  for (const lz of [-7, 0, 7]) {
    const tLantern = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), lanternGlowMat);
    tLantern.position.set(0, 7.6, lz);
    tLantern.userData = { type: 'decor' };
    tunnelGroup.add(tLantern);
  }
  mountainRoadChunk.add(tunnelGroup);

  // ============================================================================
  // ZONE 8: 🌲 DENSE ANCIENT SHINOBI FOREST & TORII CORRIDOR (z = -705 to -788)
  // Sacred Vermilion Torii arches, Shinobi Watchtower & Naruto Cliffside Overlook
  // ============================================================================
  const deepForestChunk = new THREE.Group();
  deepForestChunk.name = 'Zone8_DeepShinobiForest';
  highwayRoot.add(deepForestChunk);

  const deepForestGround = new THREE.Mesh(
    new THREE.BoxGeometry(150, 0.5, 86),
    forestGrassMat
  );
  deepForestGround.position.set(0, -0.26, -746);
  deepForestGround.receiveShadow = true;
  deepForestGround.userData = { type: 'ground' };
  deepForestChunk.add(deepForestGround);

  // Sacred Vermilion Torii Gate Corridor (z = -716 to -748)
  for (let tz = -716; tz >= -748; tz -= 8.0) {
    const torii = new THREE.Group();
    torii.position.set(0, 0, tz);
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.44, 7.2, 12),
        crimsonLacquerMat
      );
      col.position.set(side * 6.5, 3.6, 0);
      col.castShadow = true;
      col.userData = { type: 'decor' };
      torii.add(col);
    }
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.55, 0.75), crimsonLacquerMat);
    topBeam.position.set(0, 7.1, 0);
    topBeam.userData = { type: 'decor' };
    torii.add(topBeam);
    const subBeam = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.38, 0.52), darkTimberMat);
    subBeam.position.set(0, 5.9, 0);
    subBeam.userData = { type: 'decor' };
    torii.add(subBeam);
    deepForestChunk.add(torii);
  }

  // Wooden Shinobi Sentinel Watchtower at (x = 16.5, z = -758)
  const watchtowerGroup = new THREE.Group();
  watchtowerGroup.position.set(16.5, 0, -758);
  for (const [lx, lz] of [
    [-2.2, -2.2],
    [2.2, -2.2],
    [-2.2, 2.2],
    [2.2, 2.2],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 9.5, 8), darkTimberMat);
    leg.position.set(lx, 4.75, lz);
    leg.castShadow = true;
    leg.userData = { type: 'decor' };
    watchtowerGroup.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.2, 5.6), warmCreamWallMat);
  cabin.position.y = 10.6;
  cabin.castShadow = true;
  cabin.userData = { type: 'decor' };
  watchtowerGroup.add(cabin);
  const wtRoof = createPagodaRoof(7.2, 7.2, 2.4, greenTileRoofMat);
  wtRoof.position.y = 12.2;
  watchtowerGroup.add(wtRoof);
  deepForestChunk.add(watchtowerGroup);

  // "A NEW JOURNEY AWAITS..." Sandstone Cliffside Overlook Ledge & Deck at (x = -15, z = -776)
  // Matches the bottom-right reference artwork where Naruto overlooks the entire Ninja Village & Hokage Mountain!
  const overlookGroup = new THREE.Group();
  overlookGroup.position.set(-15, 0, -776);
  const cliffPromontory = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 7.8, 1.2, 12),
    sandstoneCliffMat
  );
  cliffPromontory.position.set(0, 0.4, 0);
  cliffPromontory.receiveShadow = true;
  cliffPromontory.userData = { type: 'ground' };
  overlookGroup.add(cliffPromontory);

  const deckPlatform = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.6, 8.5), warmWoodMat);
  deckPlatform.position.y = 0.3;
  deckPlatform.receiveShadow = true;
  deckPlatform.userData = { type: 'ground' };
  overlookGroup.add(deckPlatform);
  overlookGroup.add(createStoneLantern(-3.8, 0.6, -3.5, 0.95));
  overlookGroup.add(createStoneLantern(3.8, 0.6, -3.5, 0.95));

  const journeySignTex = createTextBannerTexture(
    '🍃 NINJA VILLAGE — A NEW JOURNEY AWAITS',
    'EXPLORE · TRAIN · BECOME STRONGER · HOKAGE MOUNTAIN AHEAD ↑',
    '#14532d',
    '#fef08a',
    '#dc2626'
  );
  const journeySign = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 1.35, 0.18),
    new THREE.MeshBasicMaterial({ map: journeySignTex })
  );
  journeySign.position.set(0, 2.45, -4.1);
  journeySign.userData = { type: 'decor' };
  overlookGroup.add(journeySign);
  deepForestChunk.add(overlookGroup);

  // ============================================================================
  // MOBILE-OPTIMIZED INSTANCED VEGETATION & GUARDRAILS ALONG THE 750M ROUTE
  // Uses THREE.InstancedMesh (only 4 draw calls total for 220+ trees & posts!)
  // ============================================================================
  const treeCoords: [number, number, number][] = [];
  // Outskirts & Long Highway scattered roadside trees (z = -60 to -220)
  for (let z = -64; z >= -220; z -= 22) {
    treeCoords.push([-14.5, z, 0.95], [14.5, z - 8, 0.95]);
    treeCoords.push([-30, z - 5, 1.15], [30, z + 4, 1.15]);
  }
  // Countryside & Settlement border trees (z = -235 to -430)
  for (let z = -238; z >= -430; z -= 24) {
    treeCoords.push([-42, z, 1.2], [42, z - 6, 1.2]);
  }
  // Forest Road dense woodland corridor (z = -438 to -530)
  for (let z = -440; z >= -528; z -= 9.5) {
    treeCoords.push(
      [-19.5, z, 1.25],
      [12.5, z - 2, 1.2],
      [-31, z + 3, 1.4],
      [25, z - 4, 1.35],
      [-44, z - 1, 1.45],
      [38, z + 2, 1.4]
    );
  }
  // Mountain Road & Deep Ancient Shinobi Forest (z = -595 to -780)
  for (let z = -598; z >= -778; z -= 10.5) {
    if (z < -664 && z > -692) continue; // Keep tunnel portal clear
    treeCoords.push(
      [-13.5, z, 1.45],
      [13.5, z - 3, 1.45],
      [-25.5, z + 2, 1.65],
      [25.5, z - 2, 1.65],
      [-38.0, z - 4, 1.75],
      [38.0, z + 4, 1.75]
    );
  }

  const instTreeCount = treeCoords.length;
  const instTrunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 4.6, 8);
  instTrunkGeo.translate(0, 2.3, 0);
  const instConeLowGeo = new THREE.ConeGeometry(2.2, 3.2, 8);
  instConeLowGeo.translate(0, 4.2, 0);
  const instConeHighGeo = new THREE.ConeGeometry(1.65, 2.9, 8);
  instConeHighGeo.translate(0, 6.1, 0);
  const instFoliageMat = new THREE.MeshStandardMaterial({ color: '#155e34', roughness: 0.84 });

  const instTrunks = new THREE.InstancedMesh(instTrunkGeo, darkTimberMat, instTreeCount);
  const instConesLow = new THREE.InstancedMesh(instConeLowGeo, instFoliageMat, instTreeCount);
  const instConesHigh = new THREE.InstancedMesh(instConeHighGeo, instFoliageMat, instTreeCount);
  instTrunks.castShadow = true;
  instConesLow.castShadow = true;
  instConesHigh.castShadow = true;

  const treeMatrix = new THREE.Matrix4();
  const treePos = new THREE.Vector3();
  const treeQuat = new THREE.Quaternion();
  const treeScale = new THREE.Vector3();

  for (let i = 0; i < instTreeCount; i++) {
    const [tx, tz, ts] = treeCoords[i];
    treePos.set(tx, 0, tz);
    treeQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 1.7) % (Math.PI * 2));
    treeScale.set(ts, ts, ts);
    treeMatrix.compose(treePos, treeQuat, treeScale);
    instTrunks.setMatrixAt(i, treeMatrix);
    instConesLow.setMatrixAt(i, treeMatrix);
    instConesHigh.setMatrixAt(i, treeMatrix);
  }
  instTrunks.instanceMatrix.needsUpdate = true;
  instConesLow.instanceMatrix.needsUpdate = true;
  instConesHigh.instanceMatrix.needsUpdate = true;
  highwayRoot.add(instTrunks, instConesLow, instConesHigh);

  // Instanced Roadside Wooden Farm Fence & Mountain Guardrail Posts (1 draw call)
  const postZCoords: number[] = [];
  for (let z = -230; z >= -334; z -= 6.5) postZCoords.push(z);
  for (let z = -598; z >= -662; z -= 5.5) postZCoords.push(z);
  const fenceInstCount = postZCoords.length * 2;
  const fencePostGeo = new THREE.BoxGeometry(0.26, 1.05, 0.26);
  fencePostGeo.translate(0, 0.52, 0);
  const instFencePosts = new THREE.InstancedMesh(fencePostGeo, warmWoodMat, fenceInstCount);
  let fIdx = 0;
  for (const fz of postZCoords) {
    for (const side of [-1, 1]) {
      dummyMat.makeTranslation(side * 7.2, 0, fz);
      instFencePosts.setMatrixAt(fIdx++, dummyMat);
    }
  }
  instFencePosts.instanceMatrix.needsUpdate = true;
  highwayRoot.add(instFencePosts);

  // ============================================================================
  // PART 2: THE HIDDEN LEAF NINJA VILLAGE (KONOHA SANCTUARY)
  // Designed to match the reference bird's-eye master plan & district cards:
  //   - Main Gate (South, z = -308) with green Konoha plaque & red entrance banners
  //   - Central Village (Center, z = -356) with 4-tiered teal & terracotta Rotunda Pagoda
  //   - Food District / Ramen (SW, x = -20, z = -332) & Ichiraku Ramen (E, x = 24, z = -346)
  //   - Market District (SE, x = 16, z = -330) with colorful bazaar stalls
  //   - Shopping District (W, x = -42, z = -354) & Residential District (NW, x = -58, z = -384)
  //   - Training Grounds (NW-Center, x = -38, z = -342 & x = -26, z = -388)
  //   - Eastern Turquoise River Gorge, 3 Arch Bridges & Ninja Academy Campus (E, x = 32..64)
  //   - Administration District, Blue-Domed Civic Hall & Konoha Hospital (N, z = -396..-414)
  //   - Hokage Mountain (North Cliff Backdrop, z = -436) with all 7 sculpted Hokage faces!
  // ============================================================================
  const villageGround = new THREE.Mesh(
    new THREE.CylinderGeometry(106, 112, 0.6, 56),
    villageGrassMat
  );
  villageGround.position.set(0, -0.3, -374);
  villageGround.receiveShadow = true;
  villageGround.userData = { type: 'ground' };
  root.add(villageGround);

  // Central Earthen & Cobblestone Shinobi Thoroughfare + District Cross Streets
  const mainVillageAve = new THREE.Mesh(
    new THREE.BoxGeometry(12.8, 0.18, 96),
    villageEarthRoadMat
  );
  mainVillageAve.position.set(0, 0.04, -354);
  mainVillageAve.receiveShadow = true;
  mainVillageAve.userData = { type: 'ground' };
  root.add(mainVillageAve);

  const crossVillageStreetSouth = new THREE.Mesh(
    new THREE.BoxGeometry(104, 0.17, 9.5),
    villageEarthRoadMat
  );
  crossVillageStreetSouth.position.set(-4, 0.035, -338);
  crossVillageStreetSouth.receiveShadow = true;
  crossVillageStreetSouth.userData = { type: 'ground' };
  root.add(crossVillageStreetSouth);

  const crossVillageStreetNorth = new THREE.Mesh(
    new THREE.BoxGeometry(108, 0.17, 10.0),
    villageEarthRoadMat
  );
  crossVillageStreetNorth.position.set(-2, 0.035, -382);
  crossVillageStreetNorth.receiveShadow = true;
  crossVillageStreetNorth.userData = { type: 'ground' };
  root.add(crossVillageStreetNorth);

  // Grand Circular Central Village & Hokage Plazas
  const centralVillagePlazaDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(19, 19, 0.19, 36),
    villageStonePavingMat
  );
  centralVillagePlazaDisc.position.set(0, 0.045, -356);
  centralVillagePlazaDisc.receiveShadow = true;
  centralVillagePlazaDisc.userData = { type: 'ground' };
  root.add(centralVillagePlazaDisc);

  const hokagePlazaDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 24, 0.2, 36),
    villageStonePavingMat
  );
  hokagePlazaDisc.position.set(0, 0.05, -396);
  hokagePlazaDisc.receiveShadow = true;
  hokagePlazaDisc.userData = { type: 'ground' };
  root.add(hokagePlazaDisc);

  // ============================================================================
  // EASTERN TURQUOISE MOUNTAIN RIVER GORGE & 3 TRADITIONAL ARCH BRIDGES
  // (Matches the scenic whitewater river cutting down the east side in the reference image!)
  // ============================================================================
  const eastRiverGroup = new THREE.Group();
  eastRiverGroup.name = 'EasternRiverGorge';
  root.add(eastRiverGroup);

  const riverSegments: [number, number, number, number, number][] = [
    [25, -412, 8.5, 36, -0.12],
    [28, -380, 9.2, 36, -0.1],
    [31, -348, 9.8, 36, -0.08],
    [33, -316, 10.4, 34, -0.05],
  ];
  const foamMat = new THREE.MeshBasicMaterial({
    color: '#e0f2fe',
    transparent: true,
    opacity: 0.75,
  });
  for (const [rx, rz, rw, rl, rotY] of riverSegments) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.18, rl), riverWaterMat);
    seg.position.set(rx, 0.02, rz);
    seg.rotation.y = rotY;
    seg.userData = { type: 'decor' };
    eastRiverGroup.add(seg);

    // Whitewater foam streaks & river boulders along banks
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(rw * 0.45, rl * 0.82), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(rx, 0.13, rz);
    foam.rotation.z = -rotY;
    foam.userData = { type: 'decor' };
    eastRiverGroup.add(foam);

    for (const side of [-1, 1]) {
      const bankRock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.35, 1),
        sandstoneStrataMat
      );
      bankRock.scale.set(1.3, 0.65, 1.8);
      bankRock.position.set(rx + side * (rw * 0.54), 0.35, rz - 6);
      bankRock.userData = { type: 'decor' };
      eastRiverGroup.add(bankRock);
    }
  }

  // 3 Iconic Arched Red-and-Stone Bridges spanning the Eastern River Gorge
  for (const [bx, bz] of [
    [32.5, -322], // South Outer Forest Bridge
    [30.5, -354], // Central Ninja Academy Main Bridge
    [26.5, -384], // North Administration-to-Academy Bridge
  ]) {
    const eBridge = new THREE.Group();
    eBridge.position.set(bx, 0, bz);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.48, 6.4), villageStonePavingMat);
    deck.position.y = 0.42;
    deck.castShadow = true;
    deck.receiveShadow = true;
    deck.userData = { type: 'ground' };
    eBridge.add(deck);

    for (const zSide of [-1, 1]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(13.6, 1.15, 0.36), crimsonLacquerMat);
      parapet.position.set(0, 1.05, zSide * 2.95);
      parapet.castShadow = true;
      parapet.userData = { type: 'decor' };
      eBridge.add(parapet);

      for (const px of [-5.8, 0, 5.8]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.24, 1.55, 8),
          crimsonLacquerMat
        );
        post.position.set(px, 1.18, zSide * 2.95);
        post.userData = { type: 'decor' };
        eBridge.add(post);
      }
    }
    eastRiverGroup.add(eBridge);
  }

  // Western Training Stream & Arched Red Footbridge
  const villageStream = new THREE.Mesh(new THREE.BoxGeometry(52, 0.14, 4.4), riverWaterMat);
  villageStream.position.set(-34, 0.02, -356);
  villageStream.userData = { type: 'decor' };
  root.add(villageStream);

  const streamBridge = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.45, 6.4), crimsonLacquerMat);
  streamBridge.position.set(-22, 0.28, -356);
  streamBridge.castShadow = true;
  streamBridge.userData = { type: 'ground' };
  root.add(streamBridge);

  // ----------------------------------------------------------------------------
  // LANDMARK 1: THE MAIN GATE (x = 0, z = -308)
  // Matches the "Main Gate - The journey begins here" reference card & bird's-eye view!
  // ----------------------------------------------------------------------------
  const gateGroup = new THREE.Group();
  gateGroup.position.set(0, 0, -308);

  // Heavy Stone & Timber Gatehouse Bastions + Open Wooden Doors + Vertical Red Banners
  for (const side of [-1, 1]) {
    const stoneBastion = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 9.8, 5.2),
      sandstoneStrataMat
    );
    stoneBastion.position.set(side * 8.4, 4.9, 0);
    stoneBastion.castShadow = true;
    stoneBastion.receiveShadow = true;
    stoneBastion.userData = { type: 'decor' };
    gateGroup.add(stoneBastion);

    const timberPillar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 11.5, 4.2), darkTimberMat);
    timberPillar.position.set(side * 6.8, 5.75, 0);
    timberPillar.castShadow = true;
    timberPillar.userData = { type: 'decor' };
    gateGroup.add(timberPillar);

    // Fortress Wall segments extending left and right into the Outer Forest
    const wallSeg = new THREE.Mesh(new THREE.BoxGeometry(38, 7.8, 3.2), sandstoneStrataMat);
    wallSeg.position.set(side * 29, 3.9, 0);
    wallSeg.castShadow = true;
    wallSeg.receiveShadow = true;
    wallSeg.userData = { type: 'decor' };
    gateGroup.add(wallSeg);

    const wallRoof = createPagodaRoof(39, 4.4, 1.9, terracottaRoofMat);
    wallRoof.position.set(side * 29, 7.8, 0);
    gateGroup.add(wallRoof);

    // Massive Open Swinging Wooden Gate Door panels
    const openDoor = new THREE.Mesh(new THREE.BoxGeometry(5.0, 8.2, 0.65), warmWoodMat);
    openDoor.position.set(side * 6.4, 4.1, -2.6);
    openDoor.rotation.y = side * 1.15;
    openDoor.castShadow = true;
    openDoor.userData = { type: 'decor' };
    gateGroup.add(openDoor);

    // Tall Red Vertical Entrance Banner on Wooden Pole (from the "Main Gate" card!)
    const bannerPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 8.6, 8),
      darkTimberMat
    );
    bannerPole.position.set(side * 8.6, 4.3, 4.2);
    bannerPole.userData = { type: 'decor' };
    gateGroup.add(bannerPole);

    const vBanner = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 5.8, 0.1),
      crimsonLacquerMat
    );
    vBanner.position.set(side * 8.6, 4.6, 4.45);
    vBanner.castShadow = true;
    vBanner.userData = { type: 'decor' };
    gateGroup.add(vBanner);

    const vBannerEmblem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16),
      goldTrimMat
    );
    vBannerEmblem.rotation.x = Math.PI / 2;
    vBannerEmblem.position.set(side * 8.6, 5.6, 4.5);
    vBannerEmblem.userData = { type: 'decor' };
    gateGroup.add(vBannerEmblem);
  }

  // Stone Arch Lintel Beam spanning above the roadway
  const gateLintel = new THREE.Mesh(new THREE.BoxGeometry(19.5, 2.4, 4.8), sandstoneStrataMat);
  gateLintel.position.set(0, 9.4, 0);
  gateLintel.castShadow = true;
  gateLintel.userData = { type: 'decor' };
  gateGroup.add(gateLintel);

  // Double-Tiered Curved Terracotta-Orange & Gold Pagoda Roof crowning the Main Gate
  const gateLowerRoof = createPagodaRoof(25.5, 9.2, 3.5, terracottaRoofMat);
  gateLowerRoof.position.set(0, 10.6, 0);
  gateGroup.add(gateLowerRoof);

  const gateUpperTier = new THREE.Mesh(new THREE.BoxGeometry(15.5, 2.8, 5.4), warmCreamWallMat);
  gateUpperTier.position.set(0, 13.3, 0);
  gateUpperTier.userData = { type: 'decor' };
  gateGroup.add(gateUpperTier);

  const gateUpperRoof = createPagodaRoof(20.5, 7.6, 3.4, terracottaRoofMat);
  gateUpperRoof.position.set(0, 14.7, 0);
  gateGroup.add(gateUpperRoof);

  // Iconic Green Konoha Spiral Leaf Plaque ("あ [LEAF] ん") on Front & Back of Main Gate
  const gatePlaqueTex = createKonohaGatePlaqueTexture();
  const gatePlaqueMat = new THREE.MeshBasicMaterial({ map: gatePlaqueTex });
  for (const zFace of [2.52, -2.52]) {
    const gateSignMesh = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 2.35, 0.22),
      gatePlaqueMat
    );
    gateSignMesh.position.set(0, 9.45, zFace);
    gateSignMesh.userData = { type: 'decor' };
    gateGroup.add(gateSignMesh);
  }

  gateGroup.add(createStoneLantern(-11.5, 0, 4.5, 1.25));
  gateGroup.add(createStoneLantern(11.5, 0, 4.5, 1.25));
  root.add(gateGroup);

  // ----------------------------------------------------------------------------
  // LANDMARK 1B: CENTRAL VILLAGE GRAND ROTUNDA PAGODA (x = 0, z = -356)
  // Matches the centerpiece 4-tiered circular turquoise & terracotta pagoda labeled
  // "Central Village" in the reference image, with a wide drive-through archway at ground level!
  // ----------------------------------------------------------------------------
  const centralRotundaGroup = new THREE.Group();
  centralRotundaGroup.position.set(0, 0, -356);

  // Ground-floor grand colonnade pillars on Left & Right of the main avenue (x = ±7.8m so cars & NPCs pass freely!)
  for (const side of [-1, 1]) {
    const sideBastion = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 6.2, 11.5),
      warmCreamWallMat
    );
    sideBastion.position.set(side * 8.4, 3.1, 0);
    sideBastion.castShadow = true;
    sideBastion.receiveShadow = true;
    centralRotundaGroup.add(sideBastion);

    // Warm glowing shop windows on ground-level colonnade
    const winStrip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 8.2), nightWindowMat);
    winStrip.position.set(side * 5.95, 2.6, 0);
    centralRotundaGroup.add(winStrip);

    // Flanking Turret Annexes (seen around the Central Village Pagoda in the reference image)
    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.6, 9.2, 16),
      warmCreamWallMat
    );
    turret.position.set(side * 12.8, 4.6, 2.2);
    turret.castShadow = true;
    centralRotundaGroup.add(turret);

    const turretRoof = createPagodaRoof(8.2, 8.2, 2.8, tealPagodaRoofMat);
    turretRoof.position.set(side * 12.8, 9.2, 2.2);
    centralRotundaGroup.add(turretRoof);
  }

  // Tier 1: Wide Circular Drum & Turquoise-Teal Pagoda Roof spanning high above the avenue (y = 6.2m+)
  const rotundaTier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(11.2, 11.8, 4.2, 28),
    warmCreamWallMat
  );
  rotundaTier1.position.y = 8.3;
  rotundaTier1.castShadow = true;
  centralRotundaGroup.add(rotundaTier1);

  const rotundaRoof1 = createPagodaRoof(25.5, 25.5, 3.2, tealPagodaRoofMat);
  rotundaRoof1.position.y = 10.4;
  centralRotundaGroup.add(rotundaRoof1);

  // Tier 2: Crimson-and-Gold Balcony Drum & Terracotta Pagoda Roof
  const rotundaTier2 = new THREE.Mesh(
    new THREE.CylinderGeometry(8.6, 9.2, 3.8, 24),
    crimsonLacquerMat
  );
  rotundaTier2.position.y = 13.4;
  rotundaTier2.castShadow = true;
  centralRotundaGroup.add(rotundaTier2);

  const rotundaRoof2 = createPagodaRoof(20.2, 20.2, 3.0, terracottaRoofMat);
  rotundaRoof2.position.y = 15.3;
  centralRotundaGroup.add(rotundaRoof2);

  // Tier 3: Upper Cream Lantern Drum & Turquoise Pagoda Roof + Golden Spire
  const rotundaTier3 = new THREE.Mesh(
    new THREE.CylinderGeometry(5.8, 6.2, 3.4, 20),
    warmCreamWallMat
  );
  rotundaTier3.position.y = 17.8;
  centralRotundaGroup.add(rotundaTier3);

  const rotundaRoof3 = createPagodaRoof(14.5, 14.5, 3.4, tealPagodaRoofMat);
  rotundaRoof3.position.y = 19.5;
  centralRotundaGroup.add(rotundaRoof3);

  const rotundaSpire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.45, 4.2, 10),
    goldTrimMat
  );
  rotundaSpire.position.y = 23.2;
  centralRotundaGroup.add(rotundaSpire);

  registerPickable('hokage_mansion', centralRotundaGroup);
  root.add(centralRotundaGroup);

  // ----------------------------------------------------------------------------
  // LANDMARK 2: THE COLOSSAL HOKAGE MOUNTAIN (x = 0, z = -436)
  // Warm realistic sandstone cliff massif with ALL 7 SCULPTED HOKAGE FACES,
  // cliff-top pine forest, surrounding valley canyon walls, and distant alpine peaks!
  // ----------------------------------------------------------------------------
  const hokageMountainGroup = new THREE.Group();
  hokageMountainGroup.position.set(0, 0, -436);

  // Warm Sandstone Escarpment Base & Layered Horizontal Strata Ledges
  const mainCliffWall = new THREE.Mesh(
    new THREE.BoxGeometry(156, 48, 28),
    sandstoneCliffMat
  );
  mainCliffWall.position.set(0, 24, 0);
  mainCliffWall.castShadow = true;
  mainCliffWall.receiveShadow = true;
  mainCliffWall.userData = { type: 'decor' };
  hokageMountainGroup.add(mainCliffWall);

  // Horizontal Stratified Rock Ledges & Crags across the Sandstone Cliff
  for (const [lx, ly, lz, lw, lh, ld] of [
    [0, 8, 13.5, 148, 6.5, 5.5],
    [0, 18, 12.8, 142, 5.0, 4.2],
    [-58, 24, 10.0, 28, 46, 16],
    [58, 24, 10.0, 28, 46, 16],
  ]) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), sandstoneStrataMat);
    ledge.position.set(lx, ly, lz);
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    ledge.userData = { type: 'decor' };
    hokageMountainGroup.add(ledge);
  }

  // Surrounding Valley Canyon Cliffs wrapping East & West flanks of the Village (as in the reference image!)
  for (const [cx, cz, cw, ch, cd, rotY] of [
    [-86, 28, 24, 38, 65, 0.25],
    [-92, 82, 22, 32, 58, 0.42],
    [84, 26, 26, 42, 68, -0.25],
    [90, 80, 24, 36, 60, -0.38],
  ]) {
    const flankCliff = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), sandstoneCliffMat);
    flankCliff.position.set(cx, ch * 0.48, cz);
    flankCliff.rotation.y = rotY;
    flankCliff.castShadow = true;
    flankCliff.receiveShadow = true;
    flankCliff.userData = { type: 'decor' };
    hokageMountainGroup.add(flankCliff);
  }

  // Towering Blue-Grey Distant Alpine Mountain Peaks behind Hokage Mountain
  for (const [px, py, pz, pr, ph] of [
    [-72, 34, -22, 30, 68],
    [-38, 38, -26, 32, 76],
    [0, 42, -28, 36, 84],
    [38, 38, -25, 32, 74],
    [74, 34, -22, 30, 66],
  ]) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(pr, ph, 7), alpinePeakMat);
    peak.position.set(px, py, pz);
    peak.userData = { type: 'decor' };
    hokageMountainGroup.add(peak);
  }

  // Cliff-Top Green Pine Trees along the crest of Hokage Mountain (y = 48m)
  for (let tx = -60; tx <= 60; tx += 12) {
    const topTree = createScenicTree(tx, 47.5, -2, 'pine', 1.35);
    hokageMountainGroup.add(topTree);
  }

  // ALL 7 SCULPTED HOKAGE STONE FACES carved into the sandstone cliff (facing South +Z!)
  // 1: Hashirama, 2: Tobirama, 3: Hiruzen, 4: Minato, 5: Tsunade, 6: Kakashi, 7: Naruto
  const hokagePortraits: {
    name: string;
    x: number;
    y: number;
    hairStyle: 'long_parted' | 'spiky' | 'goatee_elder' | 'minato_locks' | 'tsunade' | 'kakashi_mask' | 'naruto';
    hasHeadband: boolean;
  }[] = [
    { name: 'First Hokage (Hashirama)', x: -45, y: 31.5, hairStyle: 'long_parted', hasHeadband: true },
    { name: 'Second Hokage (Tobirama)', x: -30, y: 32.0, hairStyle: 'spiky', hasHeadband: true },
    { name: 'Third Hokage (Hiruzen)', x: -15, y: 31.0, hairStyle: 'goatee_elder', hasHeadband: true },
    { name: 'Fourth Hokage (Minato)', x: 0, y: 32.2, hairStyle: 'minato_locks', hasHeadband: true },
    { name: 'Fifth Hokage (Tsunade)', x: 15, y: 31.2, hairStyle: 'tsunade', hasHeadband: false },
    { name: 'Sixth Hokage (Kakashi)', x: 30, y: 32.0, hairStyle: 'kakashi_mask', hasHeadband: true },
    { name: 'Seventh Hokage (Naruto)', x: 45, y: 32.2, hairStyle: 'naruto', hasHeadband: true },
  ];

  const darkCarvedCreviceMat = new THREE.MeshStandardMaterial({
    color: '#5c4028',
    roughness: 0.9,
  });

  for (const face of hokagePortraits) {
    const fg = new THREE.Group();
    fg.position.set(face.x, face.y, 13.8);

    // Chiseled High-Relief Sandstone Head Block
    const headBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(4.1, 3.4, 8.4, 10),
      hokageCarvedRockMat
    );
    headBlock.scale.set(1.08, 1, 0.74);
    headBlock.castShadow = true;
    headBlock.receiveShadow = true;
    fg.add(headBlock);

    // Carved Jaw & Chin
    const chin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 3.8), hokageCarvedRockMat);
    chin.position.set(0, -3.6, 0.75);
    fg.add(chin);

    // Carved Stone Nose Bridge
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.9, 2.1), hokageCarvedRockMat);
    nose.position.set(0, -0.15, 2.95);
    nose.rotation.x = -0.16;
    fg.add(nose);

    // Carved Brow Ridge & Deep Eye Sockets
    const browRidge = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.95, 1.65), sandstoneStrataMat);
    browRidge.position.set(0, 1.45, 2.75);
    fg.add(browRidge);

    for (const side of [-1, 1]) {
      const eyeSocket = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.62, 0.7),
        darkCarvedCreviceMat
      );
      eyeSocket.position.set(side * 1.65, 0.8, 2.95);
      fg.add(eyeSocket);

      // Naruto's 3 Whisker Marks on each cheek
      if (face.hairStyle === 'naruto') {
        for (let w = -1; w <= 1; w++) {
          const whisker = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.16, 0.35),
            darkCarvedCreviceMat
          );
          whisker.position.set(side * 2.25, -0.75 + w * 0.5, 2.9);
          fg.add(whisker);
        }
      }

      // Long Framing Side Locks for Hashirama, Minato, and Tsunade
      if (
        face.hairStyle === 'long_parted' ||
        face.hairStyle === 'minato_locks' ||
        face.hairStyle === 'tsunade'
      ) {
        const sideLock = new THREE.Mesh(
          new THREE.BoxGeometry(1.55, 7.6, 2.4),
          sandstoneStrataMat
        );
        sideLock.position.set(side * 3.85, -0.6, 1.4);
        sideLock.rotation.z = side * 0.08;
        fg.add(sideLock);
      }
    }

    // Kakashi's Sculpted Stone Face Mask or Carved Mouth
    if (face.hairStyle === 'kakashi_mask') {
      const maskMesh = new THREE.Mesh(
        new THREE.BoxGeometry(4.9, 3.6, 2.6),
        sandstoneStrataMat
      );
      maskMesh.position.set(0, -1.95, 2.1);
      fg.add(maskMesh);
    } else {
      const mouthLine = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.38, 0.75),
        darkCarvedCreviceMat
      );
      mouthLine.position.set(0, -2.2, 2.85);
      fg.add(mouthLine);
    }

    // Third Hokage Hiruzen's Pointed Goatee Beard
    if (face.hairStyle === 'goatee_elder') {
      const goatee = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 2.6, 6),
        sandstoneStrataMat
      );
      goatee.rotation.x = Math.PI;
      goatee.position.set(0, -5.2, 2.1);
      fg.add(goatee);
    }

    // Fifth Hokage Tsunade's Forehead Diamond Seal
    if (face.hairStyle === 'tsunade') {
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.48, 0),
        cobaltDomeMat
      );
      diamond.position.set(0, 2.5, 2.95);
      fg.add(diamond);
    }

    // Carved Stone Shinobi Forehead Protector Band
    if (face.hasHeadband) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.45, 4.4), sandstoneStrataMat);
      band.position.set(0, 2.65, 1.15);
      fg.add(band);
    }

    // Sculpted Stone Hair Crown Spikes
    const spikeCount =
      face.hairStyle === 'long_parted' || face.hairStyle === 'tsunade'
        ? 3
        : face.hairStyle === 'goatee_elder'
        ? 5
        : 8;
    for (let s = 0; s < spikeCount; s++) {
      const angle = (s / Math.max(1, spikeCount - 1) - 0.5) * 1.65;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.8, 6), hokageCarvedRockMat);
      spike.position.set(
        Math.sin(angle) * 4.2 + (face.hairStyle === 'kakashi_mask' ? 0.9 : 0),
        4.6 + Math.cos(angle) * 1.1,
        0.4
      );
      spike.rotation.z = -angle * 0.7 + (face.hairStyle === 'kakashi_mask' ? -0.28 : 0);
      spike.castShadow = true;
      fg.add(spike);
    }

    fg.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) c.userData = { type: 'decor' };
    });
    hokageMountainGroup.add(fg);
  }

  root.add(hokageMountainGroup);

  // ----------------------------------------------------------------------------
  // LANDMARK 3: ADMINISTRATION DISTRICT, CRIMSON HOKAGE HQ, BLUE-DOMED CIVIC HALL & HOSPITAL
  // (`hokage_mansion` at 0, 0, -396, plus the Blue-Domed Administration Building & Hospital from the reference image!)
  // ----------------------------------------------------------------------------
  const hokageMansionGroup = new THREE.Group();
  hokageMansionGroup.position.set(0, 0, -396);

  // Central Iconic Crimson Cylindrical Fortress Drum
  const mansionDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(10.5, 11.2, 13.5, 28),
    crimsonLacquerMat
  );
  mansionDrum.position.y = 6.75;
  mansionDrum.castShadow = true;
  mansionDrum.receiveShadow = true;
  hokageMansionGroup.add(mansionDrum);

  // Flanking Administrative Wings
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8.5, 9.2, 11.0), crimsonLacquerMat);
    wing.position.set(side * 12.2, 4.6, -1.5);
    wing.castShadow = true;
    wing.receiveShadow = true;
    hokageMansionGroup.add(wing);

    const wingRoof = createPagodaRoof(9.8, 12.2, 2.8, darkSlateRoofMat);
    wingRoof.position.set(side * 12.2, 9.2, -1.5);
    hokageMansionGroup.add(wingRoof);
  }

  // Sweeping Multi-Tiered Roofs & Iconic White "火" (Fire) Kanji Disc
  const mansionMidRoof = createPagodaRoof(24, 24, 3.6, darkSlateRoofMat);
  mansionMidRoof.position.y = 13.5;
  hokageMansionGroup.add(mansionMidRoof);

  const upperPenthouse = new THREE.Mesh(
    new THREE.CylinderGeometry(6.8, 7.2, 4.2, 24),
    plasterWallMat
  );
  upperPenthouse.position.y = 16.5;
  hokageMansionGroup.add(upperPenthouse);

  const mansionTopRoof = createPagodaRoof(16.5, 16.5, 4.2, terracottaRoofMat);
  mansionTopRoof.position.y = 18.6;
  hokageMansionGroup.add(mansionTopRoof);

  const fireKanjiTex = createKanjiDiscTexture('火', '#ffffff', '#dc2626', '#fbbf24');
  const fireEmblem = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.35, 28),
    new THREE.MeshBasicMaterial({ map: fireKanjiTex })
  );
  fireEmblem.rotation.x = Math.PI / 2;
  fireEmblem.position.set(0, 10.2, 10.8);
  hokageMansionGroup.add(fireEmblem);

  // Blue-Domed Classical Administration Building (visible right below Hokage Mountain in the reference image!)
  const blueCivicGroup = new THREE.Group();
  blueCivicGroup.position.set(-18, 0, -16); // local to hokageMansionGroup -> (x = -18, z = -412)
  const civicBody = new THREE.Mesh(new THREE.BoxGeometry(16.5, 11.5, 11.5), civicBlueWallMat);
  civicBody.position.y = 5.75;
  civicBody.castShadow = true;
  civicBody.receiveShadow = true;
  blueCivicGroup.add(civicBody);

  const civicRoof = new THREE.Mesh(new THREE.BoxGeometry(17.4, 0.8, 12.4), cobaltDomeMat);
  civicRoof.position.y = 11.6;
  blueCivicGroup.add(civicRoof);

  const civicTowerDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.0, 5.2, 16),
    civicBlueWallMat
  );
  civicTowerDrum.position.set(0, 14.2, 0);
  blueCivicGroup.add(civicTowerDrum);

  const blueDome = new THREE.Mesh(
    new THREE.SphereGeometry(4.0, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    cobaltDomeMat
  );
  blueDome.position.set(0, 16.8, 0);
  blueCivicGroup.add(blueDome);

  const domeSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 3.6, 8), goldTrimMat);
  domeSpire.position.set(0, 20.2, 0);
  blueCivicGroup.add(domeSpire);
  hokageMansionGroup.add(blueCivicGroup);

  // Konoha General Hospital (Matches the "Hospital - Care for a stronger tomorrow" card in the reference image!)
  const hospitalGroup = new THREE.Group();
  hospitalGroup.position.set(20, 0, -14); // local to hokageMansionGroup -> (x = 20, z = -410)
  const hospLower = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.5, 9.5, 24),
    plasterWallMat
  );
  hospLower.scale.set(1.25, 1, 0.88);
  hospLower.position.y = 4.75;
  hospLower.castShadow = true;
  hospLower.receiveShadow = true;
  hospitalGroup.add(hospLower);

  const hospMidRoof = createPagodaRoof(18.5, 13.5, 2.2, greenTileRoofMat);
  hospMidRoof.position.y = 9.5;
  hospitalGroup.add(hospMidRoof);

  const hospUpper = new THREE.Mesh(new THREE.BoxGeometry(11.2, 3.8, 8.2), plasterWallMat);
  hospUpper.position.y = 11.8;
  hospitalGroup.add(hospUpper);

  const hospTopRoof = createPagodaRoof(13.2, 10.0, 2.4, terracottaRoofMat);
  hospTopRoof.position.y = 13.7;
  hospitalGroup.add(hospTopRoof);

  // Red Medical Cross Emblem ("+") on the Hospital front facade
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.4, 0.25), crimsonLacquerMat);
  crossV.position.set(0, 11.8, 4.2);
  hospitalGroup.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 0.25), crimsonLacquerMat);
  crossH.position.set(0, 11.8, 4.2);
  hospitalGroup.add(crossH);
  hokageMansionGroup.add(hospitalGroup);

  registerPickable('hokage_mansion', hokageMansionGroup);
  root.add(hokageMansionGroup);

  // ----------------------------------------------------------------------------
  // LANDMARK 4: HIDDEN LEAF NINJA ACADEMY (`ninja_academy` at -34, 0, -384 + East-Bank Campus at 48, 0, -356)
  // Includes the iconic Wooden Tree Swing AND the sprawling East-Bank Riverside Campus from the reference image!
  // ----------------------------------------------------------------------------
  const academyGroup = new THREE.Group();
  academyGroup.position.set(-34, 0, -384);

  const academyMain = new THREE.Mesh(new THREE.BoxGeometry(16, 8.5, 11), warmCreamWallMat);
  academyMain.position.y = 4.25;
  academyMain.castShadow = true;
  academyMain.receiveShadow = true;
  academyGroup.add(academyMain);

  const academyRoof = createPagodaRoof(18.2, 12.8, 3.5, terracottaRoofMat);
  academyRoof.position.y = 8.5;
  academyGroup.add(academyRoof);

  const academyTower = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.2, 12.5, 16),
    crimsonLacquerMat
  );
  academyTower.position.set(-6.5, 6.25, 2.5);
  academyTower.castShadow = true;
  academyGroup.add(academyTower);

  const academyTowerRoof = createPagodaRoof(9.5, 9.5, 3.2, greenTileRoofMat);
  academyTowerRoof.position.set(-6.5, 12.5, 2.5);
  academyGroup.add(academyTowerRoof);

  // Iconic Academy Courtyard Tree & Wooden Rope Swing!
  const swingTree = createScenicTree(7.5, 0, 8.2, 'giant_shinobi', 0.82);
  academyGroup.add(swingTree);

  const branchBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 3.2, 8), darkTimberMat);
  branchBeam.rotation.z = Math.PI / 2;
  branchBeam.position.set(5.8, 4.2, 8.2);
  academyGroup.add(branchBeam);

  for (const rx of [5.1, 6.1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.1, 6), warmWoodMat);
    rope.position.set(rx, 2.65, 8.2);
    academyGroup.add(rope);
  }
  const swingSeat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.48), warmWoodMat);
  swingSeat.position.set(5.6, 1.1, 8.2);
  swingSeat.castShadow = true;
  academyGroup.add(swingSeat);

  registerPickable('ninja_academy', academyGroup);
  root.add(academyGroup);

  // East-Bank Riverside Ninja Academy Courtyard Campus (Matches "Ninja Academy" on the right bank of the river in the reference image!)
  const eastAcademyCampus = new THREE.Group();
  eastAcademyCampus.position.set(52, 0, -356);

  const campusCourtyard = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.2, 36),
    villageStonePavingMat
  );
  campusCourtyard.position.y = 0.05;
  campusCourtyard.receiveShadow = true;
  campusCourtyard.userData = { type: 'ground' };
  eastAcademyCampus.add(campusCourtyard);

  // Riverside Long Colonnade Classroom Hall
  const riversideWing = new THREE.Mesh(new THREE.BoxGeometry(7.5, 7.2, 32), warmCreamWallMat);
  riversideWing.position.set(-7.2, 3.6, 0);
  riversideWing.castShadow = true;
  riversideWing.receiveShadow = true;
  eastAcademyCampus.add(riversideWing);

  const riversideWingRoof = createPagodaRoof(9.2, 34, 2.6, greenTileRoofMat);
  riversideWingRoof.position.set(-7.2, 7.2, 0);
  eastAcademyCampus.add(riversideWingRoof);

  // Main East-Bank Academy Lecture Hall with Emerald & Terracotta Roofs
  const mainAcademyHall = new THREE.Mesh(new THREE.BoxGeometry(11.5, 9.8, 22), plasterWallMat);
  mainAcademyHall.position.set(4.5, 4.9, 0);
  mainAcademyHall.castShadow = true;
  mainAcademyHall.receiveShadow = true;
  eastAcademyCampus.add(mainAcademyHall);

  const mainAcademyRoof = createPagodaRoof(13.4, 24, 3.2, greenTileRoofMat);
  mainAcademyRoof.position.set(4.5, 9.8, 0);
  eastAcademyCampus.add(mainAcademyRoof);

  // Academy Crest Gable & Bell Pavilion
  const academyGable = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.4, 6.8), warmCreamWallMat);
  academyGable.position.set(4.5, 11.8, 0);
  eastAcademyCampus.add(academyGable);

  const academyGableRoof = createPagodaRoof(8.2, 8.4, 2.5, terracottaRoofMat);
  academyGableRoof.position.set(4.5, 13.5, 0);
  eastAcademyCampus.add(academyGableRoof);

  registerPickable('ninja_academy', eastAcademyCampus);
  root.add(eastAcademyCampus);

  // ----------------------------------------------------------------------------
  // LANDMARK 5: ICHIRAKU RAMEN SHOP (`ichiraku_ramen` at 24, 0, -346)
  // + FOOD DISTRICT (RAMEN) CIRCULAR PAVILION (`x = -20, z = -328` from the reference image!)
  // ----------------------------------------------------------------------------
  const ichirakuGroup = new THREE.Group();
  ichirakuGroup.position.set(24, 0, -346);

  const ramenBuilding = new THREE.Mesh(new THREE.BoxGeometry(9.5, 5.4, 7.8), warmCreamWallMat);
  ramenBuilding.position.y = 2.7;
  ramenBuilding.castShadow = true;
  ramenBuilding.receiveShadow = true;
  ichirakuGroup.add(ramenBuilding);

  const ramenRoof = createPagodaRoof(11.2, 9.4, 2.6, greenTileRoofMat);
  ramenRoof.position.y = 5.4;
  ichirakuGroup.add(ramenRoof);

  // Warm Wooden Counter & 4 Red Ramen Stools
  const counterBar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.1, 1.2), warmWoodMat);
  counterBar.position.set(0, 0.55, 4.1);
  ichirakuGroup.add(counterBar);

  for (const sx of [-2.4, -0.8, 0.8, 2.4]) {
    const stool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.26, 0.68, 12),
      crimsonLacquerMat
    );
    stool.position.set(sx, 0.34, 5.2);
    stool.castShadow = true;
    ichirakuGroup.add(stool);

    // Steaming Ramen Bowl on Counter
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.22, 14), plasterWallMat);
    bowl.position.set(sx, 1.21, 4.1);
    ichirakuGroup.add(bowl);
  }

  // Iconic Ichiraku Noren Curtain Banner
  const ichirakuTex = createTextBannerTexture(
    '🍜 一楽ラーメン · ICHIRAKU RAMEN',
    'HAND-PULLED SHINOBI MISO & TONKOTSU',
    '#1e3a8a',
    '#ffffff',
    '#fbbf24'
  );
  const norenCurtain = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 1.35, 0.14),
    new THREE.MeshBasicMaterial({ map: ichirakuTex })
  );
  norenCurtain.position.set(0, 3.6, 4.15);
  ichirakuGroup.add(norenCurtain);

  // Hanging Red Paper Lanterns
  for (const lx of [-3.4, 3.4]) {
    const rLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.85, 14),
      redLanternGlowMat
    );
    rLantern.position.set(lx, 3.2, 4.6);
    ichirakuGroup.add(rLantern);
  }

  registerPickable('ichiraku_ramen', ichirakuGroup);
  root.add(ichirakuGroup);

  // Food District (Ramen) Circular Crimson Pavilion at (x = -20, z = -328)
  // Matches the round red Ramen building with the giant Narutomaki swirl crest just west of the Main Gate!
  const foodDistrictRamenGroup = new THREE.Group();
  foodDistrictRamenGroup.position.set(-20, 0, -328);

  const ramenRotunda = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.6, 6.4, 24),
    crimsonLacquerMat
  );
  ramenRotunda.position.y = 3.2;
  ramenRotunda.castShadow = true;
  ramenRotunda.receiveShadow = true;
  foodDistrictRamenGroup.add(ramenRotunda);

  const ramenRotundaRoof = createPagodaRoof(14.6, 14.6, 2.8, ochreRoofMat);
  ramenRotundaRoof.position.y = 6.4;
  foodDistrictRamenGroup.add(ramenRotundaRoof);

  const ramenUpperCupola = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.1, 2.6, 18),
    warmCreamWallMat
  );
  ramenUpperCupola.position.y = 8.4;
  foodDistrictRamenGroup.add(ramenUpperCupola);

  const ramenTopRoof = createPagodaRoof(9.6, 9.6, 2.2, terracottaRoofMat);
  ramenTopRoof.position.y = 9.7;
  foodDistrictRamenGroup.add(ramenTopRoof);

  // Giant Circular Narutomaki Swirl Sign on Front of the Food District Ramen Pavilion
  const swirlTex = createRamenSwirlSignTexture();
  const swirlDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 0.28, 24),
    new THREE.MeshBasicMaterial({ map: swirlTex })
  );
  swirlDisc.rotation.x = Math.PI / 2;
  swirlDisc.position.set(0, 4.8, 6.35);
  foodDistrictRamenGroup.add(swirlDisc);

  // Row of Glowing Red Paper Lanterns under the Ramen Pavilion eaves
  for (let ang = -0.9; ang <= 0.9; ang += 0.36) {
    const rl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.78, 12),
      redLanternGlowMat
    );
    rl.position.set(Math.sin(ang) * 6.8, 2.9, Math.cos(ang) * 6.8);
    foodDistrictRamenGroup.add(rl);
  }

  registerPickable('ichiraku_ramen', foodDistrictRamenGroup);
  root.add(foodDistrictRamenGroup);

  // ----------------------------------------------------------------------------
  // LANDMARK 6: SHINOBI TRAINING GROUNDS #3 (`training_grounds` at -38, 0, -342 & North Field at -28, 0, -392)
  // Matches the "Training Grounds - Discipline builds strength" reference card!
  // ----------------------------------------------------------------------------
  const trainingGroup = new THREE.Group();
  trainingGroup.position.set(-38, 0, -342);

  const trainingRing = new THREE.Mesh(
    new THREE.CylinderGeometry(12.5, 13.0, 0.18, 32),
    villageEarthRoadMat
  );
  trainingRing.position.y = 0.05;
  trainingRing.receiveShadow = true;
  trainingGroup.add(trainingRing);

  // Iconic Three Wooden Training Posts + Square Discipline Pillars from the reference card!
  for (const [lx, lz, h, isSquare] of [
    [-3.2, -2.5, 3.4, false],
    [0, -2.5, 4.0, false],
    [3.2, -2.5, 3.5, false],
    [-6.5, 2.2, 3.2, true],
    [-2.2, 3.6, 2.8, true],
    [2.2, 3.6, 3.1, true],
    [6.5, 2.2, 2.9, true],
  ] as [number, number, number, boolean][]) {
    const logPost = new THREE.Mesh(
      isSquare
        ? new THREE.BoxGeometry(0.95, h, 0.95)
        : new THREE.CylinderGeometry(0.58, 0.64, h, 16),
      warmWoodMat
    );
    logPost.position.set(lx, h * 0.5, lz);
    logPost.castShadow = true;
    logPost.receiveShadow = true;
    trainingGroup.add(logPost);

    // Target Ring / Rope Binding on each Wooden Post
    const targetDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.06, 16),
      crimsonLacquerMat
    );
    targetDisc.rotation.x = Math.PI / 2;
    targetDisc.position.set(lx, h * 0.65, lz + 0.55);
    trainingGroup.add(targetDisc);
  }

  // Training Dojo Pavilion & Weapon Rack
  const dojoPavilion = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.2, 5.5), darkTimberMat);
  dojoPavilion.position.set(0, 2.1, -8.2);
  dojoPavilion.castShadow = true;
  trainingGroup.add(dojoPavilion);

  const dojoRoof = createPagodaRoof(10.2, 7.2, 2.4, greenTileRoofMat);
  dojoRoof.position.set(0, 4.2, -8.2);
  trainingGroup.add(dojoRoof);

  // Memorial Stone Monument
  const memorialStone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.4, 5), cliffStoneMat);
  memorialStone.position.set(7.5, 1.2, 3.2);
  memorialStone.castShadow = true;
  trainingGroup.add(memorialStone);

  registerPickable('training_grounds', trainingGroup);
  root.add(trainingGroup);

  // ----------------------------------------------------------------------------
  // LANDMARK 7: UCHIHA CLAN COMPOUND & QUARTER (`uchiha_clan_compound` at 42, 0, -382)
  // ----------------------------------------------------------------------------
  const uchihaGroup = new THREE.Group();
  uchihaGroup.position.set(42, 0, -382);

  const uchihaHall = new THREE.Mesh(new THREE.BoxGeometry(15, 7.2, 10.5), plasterWallMat);
  uchihaHall.position.y = 3.6;
  uchihaHall.castShadow = true;
  uchihaHall.receiveShadow = true;
  uchihaGroup.add(uchihaHall);

  const uchihaRoof = createPagodaRoof(17.2, 12.4, 3.4, darkSlateRoofMat);
  uchihaRoof.position.y = 7.2;
  uchihaGroup.add(uchihaRoof);

  // Iconic Red & White Uchiha Fan Emblem on Front Gate Wall
  const fanTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.25, 24, 1, false, 0, Math.PI),
    crimsonLacquerMat
  );
  fanTop.rotation.z = -Math.PI / 2;
  fanTop.rotation.y = Math.PI / 2;
  fanTop.position.set(0, 5.2, 5.4);
  uchihaGroup.add(fanTop);

  const fanBot = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.25, 24, 1, false, 0, Math.PI),
    plasterWallMat
  );
  fanBot.rotation.z = Math.PI / 2;
  fanBot.rotation.y = Math.PI / 2;
  fanBot.position.set(0, 5.2, 5.4);
  uchihaGroup.add(fanBot);

  registerPickable('uchiha_clan_compound', uchihaGroup);
  root.add(uchihaGroup);

  // ----------------------------------------------------------------------------
  // LANDMARK 8: CHUNIN EXAM ARENA & PAGODA (`chunin_arena` at 38, 0, -334)
  // ----------------------------------------------------------------------------
  const chuninGroup = new THREE.Group();
  chuninGroup.position.set(38, 0, -334);

  const arenaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(11.5, 12.4, 7.5, 24),
    warmCreamWallMat
  );
  arenaBase.position.y = 3.75;
  arenaBase.castShadow = true;
  arenaBase.receiveShadow = true;
  chuninGroup.add(arenaBase);

  const arenaMidRoof = createPagodaRoof(25, 25, 3.2, greenTileRoofMat);
  arenaMidRoof.position.y = 7.5;
  chuninGroup.add(arenaMidRoof);

  const arenaUpper = new THREE.Mesh(
    new THREE.CylinderGeometry(7.8, 8.2, 4.5, 20),
    crimsonLacquerMat
  );
  arenaUpper.position.y = 10.2;
  chuninGroup.add(arenaUpper);

  const arenaTopRoof = createPagodaRoof(18, 18, 3.6, greenTileRoofMat);
  arenaTopRoof.position.y = 12.4;
  chuninGroup.add(arenaTopRoof);

  registerPickable('chunin_arena', chuninGroup);
  root.add(chuninGroup);

  // ============================================================================
  // REFERENCE IMAGE DISTRICTS:
  //   1) MARKET BAZAAR (SE of Central Village: x = 14..24, z = -322..-336)
  //   2) CENTRAL VILLAGE AVENUE & SHOPPING DISTRICT (x = -14..-54, z = -320..-376)
  //   3) RESIDENTIAL DISTRICT (NW Hillside: x = -50..-74, z = -368..-412)
  // ============================================================================
  const marketGroup = new THREE.Group();
  marketGroup.name = 'KonohaMarketBazaar';
  root.add(marketGroup);

  // Colorful Open-Air Market Bazaar Stalls ("Market - Trade, talk, find what you need")
  const stallSpecs: [number, number, string][] = [
    [12.5, -322, '#dc2626'],
    [18.5, -322, '#d97706'],
    [12.5, -330, '#2563eb'],
    [18.5, -330, '#16a34a'],
    [15.5, -337, '#9333ea'],
  ];
  for (const [sx, sz, canopyHex] of stallSpecs) {
    const stall = new THREE.Group();
    stall.position.set(sx, 0, sz);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.0, 2.4), warmWoodMat);
    counter.position.y = 0.5;
    counter.castShadow = true;
    counter.userData = { type: 'decor' };
    stall.add(counter);

    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: canopyHex, roughness: 0.6 })
    );
    canopy.rotation.y = Math.PI / 4;
    canopy.scale.set(1.2, 1, 0.9);
    canopy.position.y = 2.65;
    canopy.castShadow = true;
    canopy.userData = { type: 'decor' };
    stall.add(canopy);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 8),
      redLanternGlowMat
    );
    lantern.position.set(0, 2.05, 1.1);
    lantern.userData = { type: 'decor' };
    stall.add(lantern);
    marketGroup.add(stall);
  }

  // Dense Multi-Story Townhouses across Central Village, Shopping District & Residential District
  // Matches the rich tapestry of terracotta-red, turquoise-teal, ochre-gold & slate roofs in the reference image!
  const districtBuildings: [
    number,
    number,
    number,
    number,
    string,
    'green' | 'red' | 'slate' | 'teal' | 'ochre'
  ][] = [
    // Central Village Avenue Shopfronts
    [-14.5, -318, 7.8, 7.2, '#fef3c7', 'red'],
    [14.5, -315, 7.8, 7.0, '#f8fafc', 'teal'],
    [-15.0, -344, 8.4, 8.6, '#ffedd5', 'ochre'],
    [15.0, -366, 8.2, 8.4, '#fef3c7', 'red'],
    [-16.5, -372, 8.2, 8.0, '#f1f5f9', 'teal'],
    [16.5, -375, 8.0, 7.8, '#fef3c7', 'green'],
    // Shopping District (West of Food District & Central Village)
    [-34, -322, 8.5, 6.8, '#fef3c7', 'red'],
    [-46, -326, 8.0, 6.5, '#ffedd5', 'ochre'],
    [-52, -342, 8.6, 7.4, '#f8fafc', 'teal'],
    [-52, -358, 9.0, 7.8, '#fef3c7', 'red'],
    [-38, -366, 8.2, 7.2, '#e0f2fe', 'slate'],
    // Residential District (Northwest Hillside Homes with Terracotta & Green Roofs)
    [-54, -376, 7.6, 5.8, '#fef3c7', 'red'],
    [-66, -372, 7.2, 5.4, '#f8fafc', 'red'],
    [-56, -392, 7.8, 6.2, '#ffedd5', 'green'],
    [-68, -388, 7.4, 5.6, '#fef3c7', 'red'],
    [-48, -404, 8.0, 6.4, '#f8fafc', 'teal'],
    [-62, -406, 7.5, 5.8, '#fef3c7', 'red'],
    // East & North-East Village Homes near Uchiha Quarter
    [44, -402, 8.2, 6.6, '#f8fafc', 'slate'],
    [56, -394, 7.8, 6.0, '#fef3c7', 'red'],
  ];

  for (const [tx, tz, w, h, wallHex, rStyle] of districtBuildings) {
    const th = new THREE.Group();
    th.position.set(tx, 0, tz);
    const bMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.86),
      new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.66 })
    );
    bMesh.position.y = h * 0.5;
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    bMesh.userData = { type: 'decor' };
    th.add(bMesh);

    // Warm Glowing Night Windows on upper & lower floors ("Village at Night - Even the night has a story")
    const winMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.68, 1.15, w * 0.88),
      nightWindowMat
    );
    winMesh.position.y = h * 0.62;
    winMesh.userData = { type: 'decor' };
    th.add(winMesh);

    const rMat =
      rStyle === 'green'
        ? greenTileRoofMat
        : rStyle === 'red'
        ? terracottaRoofMat
        : rStyle === 'teal'
        ? tealPagodaRoofMat
        : rStyle === 'ochre'
        ? ochreRoofMat
        : darkSlateRoofMat;
    const rMesh = createPagodaRoof(w * 1.16, w * 1.02, 2.6, rMat);
    rMesh.position.y = h;
    rMesh.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) c.userData = { type: 'decor' };
    });
    th.add(rMesh);
    root.add(th);
  }

  // Village Street Stone Lanterns, Red Festival Lanterns & Lush Green Trees
  for (let lz = -316; lz >= -388; lz -= 12) {
    root.add(createStoneLantern(-7.2, 0, lz, 1.0));
    root.add(createStoneLantern(7.2, 0, lz, 1.0));
    root.add(createScenicTree(-11.2, 0, lz - 4, 'sakura', 1.05));
    root.add(createScenicTree(11.2, 0, lz - 4, 'sakura', 1.05));
  }

  // Outer Forest Perimeter wrapping the South Gate, East River Gorge & West Residential Hills
  for (let z = -302; z >= -428; z -= 11) {
    root.add(createScenicTree(-74, 0, z, 'giant_shinobi', 1.3));
    root.add(createScenicTree(72, 0, z, 'giant_shinobi', 1.3));
    root.add(createScenicTree(-64, 0, z - 5, 'pine', 1.35));
    root.add(createScenicTree(62, 0, z - 5, 'pine', 1.35));
  }
  // Dense Outer Forest flanking the Main Gate Entrance (as shown in the reference image!)
  for (const [fx, fz, fs] of [
    [-22, -298, 1.35],
    [-34, -296, 1.45],
    [-46, -300, 1.3],
    [22, -298, 1.35],
    [34, -296, 1.45],
    [48, -300, 1.4],
    [44, -314, 1.35],
    [54, -322, 1.45],
  ]) {
    root.add(createScenicTree(fx, 0, fz, 'giant_shinobi', fs));
  }

  return {
    group: outerRoot,
    buildingPickMeshes,
    updateAnimations: (elapsedTime: number, isNight: boolean) => {
      lanternGlowMat.emissiveIntensity = isNight ? 2.4 : 0.95;
      redLanternGlowMat.emissiveIntensity = isNight ? 2.2 : 0.85;
      nightWindowMat.emissiveIntensity = isNight ? 1.85 : 0.25;
      for (const wm of animatedWatermills) {
        wm.rotation.x = elapsedTime * 0.85;
      }
      for (const wf of animatedWaterfalls) {
        wf.position.y = Math.sin(elapsedTime * 3.0) * 0.08;
      }
      for (const ga of animatedGuardArms) {
        ga.rotation.x = Math.sin(elapsedTime * 2.5) * 0.15;
      }
    },
  };
}
