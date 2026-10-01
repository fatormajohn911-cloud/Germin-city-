import * as THREE from 'three';
import {
  EmoteType,
  ExplorerBackGear,
  ExplorerHeadgear,
  ExplorerOutfitStyle,
} from '../types/game';

export interface HumanoidAnimState {
  walkWeight: number;
  talkWeight: number;
  sitWeight: number;
  emoteWeight: number;
  jumpWeight: number;
  slideWeight: number;
  walkPhase: number;
  lastWorldX: number;
  lastWorldZ: number;
  smoothedSpeed: number;
}

export interface HumanoidRig {
  group: THREE.Group;
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  neckAndHeadGroup: THREE.Group;
  leftShoulderGroup: THREE.Group;
  leftElbowGroup: THREE.Group;
  leftHandGroup: THREE.Group;
  leftFingersGroup: THREE.Group;
  leftFingerJoints: THREE.Group[];
  leftThumbGroup: THREE.Group;
  rightShoulderGroup: THREE.Group;
  rightElbowGroup: THREE.Group;
  rightHandGroup: THREE.Group;
  rightFingersGroup: THREE.Group;
  rightFingerJoints: THREE.Group[];
  rightThumbGroup: THREE.Group;
  leftHipGroup: THREE.Group;
  leftKneeGroup: THREE.Group;
  rightHipGroup: THREE.Group;
  rightKneeGroup: THREE.Group;
  leftEyelid: THREE.Mesh;
  rightEyelid: THREE.Mesh;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  mouthMesh: THREE.Mesh;
  ring: THREE.Mesh;
  skinMat: THREE.MeshStandardMaterial;
  outfitMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  trousersMat: THREE.MeshStandardMaterial;
  shoeMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  ringMat: THREE.MeshBasicMaterial;
  explorerWardrobe?: {
    outfitGroups: Record<ExplorerOutfitStyle, THREE.Group>;
    headgearGroups: Record<Exclude<ExplorerHeadgear, 'none'>, THREE.Group>;
    backGearGroups: Record<Exclude<ExplorerBackGear, 'none'>, THREE.Group>;
  };
  residentWeatherWardrobe?: {
    sunnyGroup: THREE.Group;
    cloudyGroup: THREE.Group;
    rainyGroup: THREE.Group;
    forearmMeshes: THREE.Mesh[];
    sleeveCuffMeshes: THREE.Mesh[];
  };
  pickMeshes: THREE.Object3D[];
  phaseOffset: number;
  baseScale: number;
  lastAppearanceKey?: string;
  animState: HumanoidAnimState;
}

export interface HumanoidBuildOptions {
  id: string;
  isPlayer: boolean;
  outfitColor: string;
  accentColor: string;
  hairColor: string;
  skinColor: string;
  scale: number;
  aoTexture?: THREE.Texture;
}

interface JointPose {
  pelvisY: number;
  pelvisRotY: number;
  torsoRotX: number;
  torsoRotY: number;
  leftHipX: number;
  rightHipX: number;
  leftKneeX: number;
  rightKneeX: number;
  leftShoulderX: number;
  rightShoulderX: number;
  leftShoulderZ: number;
  rightShoulderZ: number;
  leftElbowX: number;
  rightElbowX: number;
}

function createEmptyPose(): JointPose {
  return {
    pelvisY: 0.92,
    pelvisRotY: 0,
    torsoRotX: 0,
    torsoRotY: 0,
    leftHipX: 0,
    rightHipX: 0,
    leftKneeX: 0,
    rightKneeX: 0,
    leftShoulderX: 0,
    rightShoulderX: 0,
    leftShoulderZ: 0,
    rightShoulderZ: 0,
    leftElbowX: 0,
    rightElbowX: 0,
  };
}

function lerpPoseInto(out: JointPose, a: JointPose, b: JointPose, t: number): void {
  const k = THREE.MathUtils.clamp(t, 0, 1);
  if (k <= 0.0001) {
    out.pelvisY = a.pelvisY;
    out.pelvisRotY = a.pelvisRotY;
    out.torsoRotX = a.torsoRotX;
    out.torsoRotY = a.torsoRotY;
    out.leftHipX = a.leftHipX;
    out.rightHipX = a.rightHipX;
    out.leftKneeX = a.leftKneeX;
    out.rightKneeX = a.rightKneeX;
    out.leftShoulderX = a.leftShoulderX;
    out.rightShoulderX = a.rightShoulderX;
    out.leftShoulderZ = a.leftShoulderZ;
    out.rightShoulderZ = a.rightShoulderZ;
    out.leftElbowX = a.leftElbowX;
    out.rightElbowX = a.rightElbowX;
    return;
  }
  out.pelvisY = THREE.MathUtils.lerp(a.pelvisY, b.pelvisY, k);
  out.pelvisRotY = THREE.MathUtils.lerp(a.pelvisRotY, b.pelvisRotY, k);
  out.torsoRotX = THREE.MathUtils.lerp(a.torsoRotX, b.torsoRotX, k);
  out.torsoRotY = THREE.MathUtils.lerp(a.torsoRotY, b.torsoRotY, k);
  out.leftHipX = THREE.MathUtils.lerp(a.leftHipX, b.leftHipX, k);
  out.rightHipX = THREE.MathUtils.lerp(a.rightHipX, b.rightHipX, k);
  out.leftKneeX = THREE.MathUtils.lerp(a.leftKneeX, b.leftKneeX, k);
  out.rightKneeX = THREE.MathUtils.lerp(a.rightKneeX, b.rightKneeX, k);
  out.leftShoulderX = THREE.MathUtils.lerp(a.leftShoulderX, b.leftShoulderX, k);
  out.rightShoulderX = THREE.MathUtils.lerp(a.rightShoulderX, b.rightShoulderX, k);
  out.leftShoulderZ = THREE.MathUtils.lerp(a.leftShoulderZ, b.leftShoulderZ, k);
  out.rightShoulderZ = THREE.MathUtils.lerp(a.rightShoulderZ, b.rightShoulderZ, k);
  out.leftElbowX = THREE.MathUtils.lerp(a.leftElbowX, b.leftElbowX, k);
  out.rightElbowX = THREE.MathUtils.lerp(a.rightElbowX, b.rightElbowX, k);
}

const _idlePose = createEmptyPose();
const _walkPose = createEmptyPose();
const _sitPose = createEmptyPose();
const _emotePose = createEmptyPose();
const _jumpPose = createEmptyPose();
const _slidePose = createEmptyPose();
const _blendPose = createEmptyPose();

let sharedHitboxGeo: THREE.CylinderGeometry | null = null;
let sharedHitboxMat: THREE.MeshBasicMaterial | null = null;
let sharedSculptedHeadGeo: THREE.SphereGeometry | null = null;
let cachedFabricBumpTex: THREE.CanvasTexture | null = null;

/**
 * Builds a single, seamless, high-resolution anatomical human head geometry
 * by smoothly sculpting the vertices of a 36x32 sphere (tapered jawline, soft chin,
 * smooth cheek contours) with zero intersecting spheres or cheek bumps.
 */
function getSculptedHeadGeometry(): THREE.SphereGeometry {
  if (sharedSculptedHeadGeo) return sharedSculptedHeadGeo;
  const geo = new THREE.SphereGeometry(0.212, 36, 32);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ny = v.y / 0.212; // -1 (chin) .. +1 (crown)
    const nz = v.z / 0.212; // -1 (back) .. +1 (front face)

    // Natural cranial proportions
    v.x *= 0.92;
    v.y *= 1.07;
    v.z *= 0.97;

    // Smooth, seamless jawline & chin taper on the lower half of the head (ny < 0)
    if (ny < 0) {
      const t = Math.min(1, -ny); // 0 at mid-face -> 1 at bottom of chin
      // Narrow the lower cheeks and jaw smoothly without any seam or bump
      const jawNarrow = 1 - Math.pow(t, 1.35) * 0.26;
      v.x *= jawNarrow;

      // Gently bring the chin forward and flatten the underside of the jaw
      if (nz > 0) {
        v.z += Math.sin(t * Math.PI * 0.85) * 0.016 * nz;
      } else {
        v.z *= 1 - t * 0.14;
      }
    } else {
      // Subtle temple narrowing near forehead
      const browT = Math.max(0, Math.min(1, ny));
      v.x *= 1 - browT * 0.04;
    }

    // Gently flatten the front facial plane so eyes, nose, and lips sit naturally
    if (nz > 0.55 && ny > -0.65 && ny < 0.45) {
      v.z -= (nz - 0.55) * 0.018;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  sharedSculptedHeadGeo = geo;
  return geo;
}

function getFabricMicroTexture(): THREE.CanvasTexture {
  if (cachedFabricBumpTex) return cachedFabricBumpTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7c7c7c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#888888';
  for (let y = 0; y < 128; y += 4) {
    ctx.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 4) {
    ctx.fillRect(x, 0, 1, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  cachedFabricBumpTex = tex;
  return tex;
}

export function createHumanoidRig(options: HumanoidBuildOptions): HumanoidRig {
  const group = new THREE.Group();
  group.scale.setScalar(options.scale);
  group.userData = {
    type: options.isPlayer ? 'player' : 'character',
    characterId: options.id,
  };

  const pickMeshes: THREE.Object3D[] = [];
  if (!sharedHitboxGeo) {
    sharedHitboxGeo = new THREE.CylinderGeometry(0.45, 0.45, 2.05, 8);
  }
  if (!sharedHitboxMat) {
    sharedHitboxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });
  }
  const hitboxMesh = new THREE.Mesh(sharedHitboxGeo, sharedHitboxMat);
  hitboxMesh.position.y = 1.02;
  hitboxMesh.userData = {
    type: options.isPlayer ? 'player' : 'character',
    characterId: options.id,
  };
  group.add(hitboxMesh);
  pickMeshes.push(hitboxMesh);

  const tagPickable = (mesh: THREE.Object3D) => {
    mesh.userData = {
      type: options.isPlayer ? 'player' : 'character',
      characterId: options.id,
    };
  };

  const fabricBump = getFabricMicroTexture();

  // Silky-smooth, poreless human skin with warm subsurface radiance (Zero bumpMap noise on cheeks!)
  const skinColorObj = new THREE.Color(options.skinColor);
  const subsurfaceTint = skinColorObj.clone().lerp(new THREE.Color('#f43f5e'), 0.16);
  const skinMat = new THREE.MeshStandardMaterial({
    color: options.skinColor,
    roughness: 0.34,
    metalness: 0.02,
    emissive: subsurfaceTint,
    emissiveIntensity: 0.055,
  });
  const palmSkinMat = new THREE.MeshStandardMaterial({
    color: skinColorObj.clone().lerp(new THREE.Color('#fda4af'), 0.12),
    roughness: 0.36,
    metalness: 0.02,
    emissive: subsurfaceTint,
    emissiveIntensity: 0.045,
  });
  const isFemaleChar = ['elena', 'maya', 'iysha', 'amie', 'hawa'].includes(options.id);
  const lipMat = new THREE.MeshStandardMaterial({
    color: skinColorObj
      .clone()
      .lerp(new THREE.Color(isFemaleChar ? '#e11d48' : '#be185d'), isFemaleChar ? 0.48 : 0.32),
    roughness: 0.26,
    metalness: 0.06,
  });
  const nailMat = new THREE.MeshStandardMaterial({
    color: '#ffe4e6',
    roughness: 0.18,
    metalness: 0.08,
  });
  const outfitMat = new THREE.MeshStandardMaterial({
    color: options.outfitColor,
    bumpMap: fabricBump,
    bumpScale: 0.005,
    roughness: 0.52,
    metalness: 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: options.accentColor,
    roughness: 0.34,
    metalness: 0.22,
  });
  const trousersMat = new THREE.MeshStandardMaterial({
    color:
      options.id === 'aria'
        ? '#1e293b'
        : options.id === 'elena'
        ? '#312e81'
        : options.id === 'leo'
        ? '#334155'
        : '#1e293b',
    bumpMap: fabricBump,
    bumpScale: 0.005,
    roughness: 0.62,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: options.hairColor,
    roughness: 0.38,
    metalness: 0.16,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.36,
    metalness: 0.12,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.48,
  });

  // Soft Ground Ambient Occlusion Shadow Disc
  if (options.aoTexture) {
    const aoPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: options.aoTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.65,
      })
    );
    aoPlane.rotation.x = -Math.PI / 2;
    aoPlane.position.y = 0.02;
    group.add(aoPlane);
  }

  // Subtle Selection / Presence Ring
  const ringGeo = new THREE.RingGeometry(0.46, 0.58, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: options.isPlayer ? '#fbbf24' : options.accentColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: options.isPlayer ? 0.8 : 0.42,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  group.add(ring);

  // 1. Pelvis Root (y = 0.92 in standing pose)
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.92, 0);
  group.add(pelvisGroup);

  const hipsMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.2, 0.22, 24),
    trousersMat
  );
  hipsMesh.scale.set(isFemaleChar ? 1.15 : 1.1, 1, 0.78);
  hipsMesh.castShadow = true;
  tagPickable(hipsMesh);
  pelvisGroup.add(hipsMesh);

  // Tailored Waist Belt & Metallic Buckle
  const beltMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.216, 0.214, 0.055, 24),
    new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.3 })
  );
  beltMesh.position.set(0, 0.075, 0);
  beltMesh.scale.set(isFemaleChar ? 1.15 : 1.11, 1, 0.79);
  pelvisGroup.add(beltMesh);

  const buckleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.062, 0.03),
    new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.22, metalness: 0.88 })
  );
  buckleMesh.position.set(0, 0.075, 0.17);
  pelvisGroup.add(buckleMesh);

  // 2. Torso & Spine Group
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.08, 0);
  pelvisGroup.add(torsoGroup);

  const chestMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(isFemaleChar ? 0.238 : 0.252, 0.198, 0.58, 24),
    outfitMat
  );
  chestMesh.position.set(0, 0.3, 0);
  chestMesh.scale.set(isFemaleChar ? 1.12 : 1.18, 1, 0.74);
  chestMesh.castShadow = true;
  chestMesh.receiveShadow = true;
  tagPickable(chestMesh);
  torsoGroup.add(chestMesh);

  const shoulderCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 20, 14),
    outfitMat
  );
  shoulderCap.position.set(0, 0.55, 0);
  shoulderCap.scale.set(isFemaleChar ? 1.15 : 1.24, 0.42, 0.74);
  shoulderCap.castShadow = true;
  tagPickable(shoulderCap);
  torsoGroup.add(shoulderCap);

  const collarMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.128, 0.148, 0.14, 18),
    accentMat
  );
  collarMesh.position.set(0, 0.59, 0.02);
  torsoGroup.add(collarMesh);

  // Distinct Character Attire Details (All 10 Residents)
  if (options.id === 'kaelen') {
    const apronMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.78 });
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.23, 0.62, 18, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      apronMat
    );
    apron.position.set(0, 0.15, 0.02);
    apron.scale.set(1.15, 1, 0.78);
    torsoGroup.add(apron);
  } else if (options.id === 'leo' || options.id === 'alie') {
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.38, 0.16),
      new THREE.MeshStandardMaterial({
        color: options.id === 'alie' ? '#0891b2' : '#047857',
        roughness: 0.5,
        metalness: 0.25,
      })
    );
    pack.position.set(0, 0.32, -0.22);
    pack.castShadow = true;
    torsoGroup.add(pack);

    const solarPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.14, 0.03),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.35,
        metalness: 0.65,
        roughness: 0.18,
      })
    );
    solarPanel.position.set(0, 0.42, -0.31);
    solarPanel.rotation.x = -0.3;
    torsoGroup.add(solarPanel);
  } else if (options.id === 'maya' || options.id === 'amie') {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.145, 0.024, 10, 24),
      new THREE.MeshStandardMaterial({ color: '#f472b6', metalness: 0.4, roughness: 0.3 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.58, 0.02);
    torsoGroup.add(band);
  } else if (options.id === 'aria' || options.id === 'joseph') {
    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.04), accentMat);
    lapelL.position.set(-0.08, 0.38, 0.18);
    lapelL.rotation.z = -0.15;
    torsoGroup.add(lapelL);

    const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.04), accentMat);
    lapelR.position.set(0.08, 0.38, 0.18);
    lapelR.rotation.z = 0.15;
    torsoGroup.add(lapelR);
  }

  // Unique Explorer (Player) Modular 3D Wardrobe Groups
  let explorerWardrobe: HumanoidRig['explorerWardrobe'] | undefined;
  if (options.isPlayer) {
    accentMat.emissive = new THREE.Color(options.accentColor);
    accentMat.emissiveIntensity = 0.35;

    // 1. Cyber Explorer Jacket (Glowing AI Core + Shoulder Pauldrons + Belt)
    const cyberGroup = new THREE.Group();
    const coreBadge = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), accentMat);
    coreBadge.position.set(0, 0.4, 0.2);
    coreBadge.scale.set(1, 1, 0.45);
    cyberGroup.add(coreBadge);
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), accentMat);
      pauldron.position.set(side * 0.29, 0.56, 0);
      pauldron.scale.set(1.1, 0.55, 0.95);
      cyberGroup.add(pauldron);
    }
    torsoGroup.add(cyberGroup);

    // 2. Royal Commander Coat (Regal Coattails + Diagonal Sash + Epaulets)
    const royalGroup = new THREE.Group();
    royalGroup.visible = false;
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.58, 0.39), accentMat);
    sash.position.set(0, 0.33, 0);
    sash.rotation.z = 0.45;
    royalGroup.add(sash);
    const coatSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.31, 0.38, 18, 1, true, Math.PI * 0.2, Math.PI * 1.6),
      outfitMat
    );
    coatSkirt.position.set(0, -0.06, -0.02);
    royalGroup.add(coatSkirt);
    torsoGroup.add(royalGroup);

    // 3. Streetwear Hoodie Vest (Puffer Vest + Back Hood + Pocket Trim)
    const hoodieGroup = new THREE.Group();
    hoodieGroup.visible = false;
    const vestBody = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.48, 18), accentMat);
    vestBody.position.set(0, 0.3, 0);
    vestBody.scale.set(1.14, 1, 0.8);
    hoodieGroup.add(vestBody);
    const backHood = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), accentMat);
    backHood.position.set(0, 0.58, -0.14);
    backHood.scale.set(1.2, 0.65, 0.9);
    hoodieGroup.add(backHood);
    torsoGroup.add(hoodieGroup);

    // 4. Tactical Armor Suit (Chest Plate + Utility Belt Pouches)
    const tacticalGroup = new THREE.Group();
    tacticalGroup.visible = false;
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.14), accentMat);
    chestPlate.position.set(0, 0.38, 0.14);
    tacticalGroup.add(chestPlate);
    for (const bx of [-0.16, 0, 0.16]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.08), accentMat);
      pouch.position.set(bx, 0.06, 0.19);
      tacticalGroup.add(pouch);
    }
    torsoGroup.add(tacticalGroup);

    // 5. Safari Adventure Blazer (Lapels + Cross-body Satchel)
    const safariGroup = new THREE.Group();
    safariGroup.visible = false;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.38), accentMat);
    strap.position.set(0, 0.3, 0);
    strap.rotation.z = -0.48;
    safariGroup.add(strap);
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.22), accentMat);
    satchel.position.set(0.24, 0.04, 0.04);
    safariGroup.add(satchel);
    torsoGroup.add(safariGroup);

    // Back Gear 1: AI Hover Jetpack
    const jetpackGroup = new THREE.Group();
    for (const jx of [-0.11, 0.11]) {
      const thruster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.09, 0.42, 14),
        new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.65, roughness: 0.28 })
      );
      thruster.position.set(jx, 0.34, -0.22);
      jetpackGroup.add(thruster);

      const glowRing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 14), accentMat);
      glowRing.position.set(jx, 0.11, -0.22);
      jetpackGroup.add(glowRing);
    }
    const centerPod = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.14), outfitMat);
    centerPod.position.set(0, 0.36, -0.21);
    jetpackGroup.add(centerPod);
    torsoGroup.add(jetpackGroup);

    // Back Gear 2: Heroic Flowing Cape
    const capeGroup = new THREE.Group();
    capeGroup.visible = false;
    const capeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.85, 0.03), accentMat);
    capeMesh.position.set(0, 0.12, -0.21);
    capeMesh.rotation.x = 0.14;
    capeGroup.add(capeMesh);
    torsoGroup.add(capeGroup);

    // Back Gear 3: Field Research Backpack with Antenna
    const backpackGroup = new THREE.Group();
    backpackGroup.visible = false;
    const packBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.18), accentMat);
    packBox.position.set(0, 0.32, -0.22);
    backpackGroup.add(packBox);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.015, 0.38, 8),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.8 })
    );
    antenna.position.set(0.12, 0.66, -0.24);
    backpackGroup.add(antenna);
    torsoGroup.add(backpackGroup);

    explorerWardrobe = {
      outfitGroups: {
        cyber_explorer: cyberGroup,
        royal_commander: royalGroup,
        street_hoodie: hoodieGroup,
        tactical_suit: tacticalGroup,
        safari_blazer: safariGroup,
      },
      headgearGroups: {
        visor: new THREE.Group(),
        crown: new THREE.Group(),
        cap: new THREE.Group(),
        headphones: new THREE.Group(),
      },
      backGearGroups: {
        jetpack: jetpackGroup,
        cape: capeGroup,
        backpack: backpackGroup,
      },
    };
  }

  // Resident AI Weather-Adaptive 3D Wardrobe (Sunny Light Clothes, Cloudy Layered Scarf/Vest, Rainy Waterproof Hooded Raincoat)
  let residentWeatherWardrobe: HumanoidRig['residentWeatherWardrobe'] | undefined;
  if (!options.isPlayer) {
    const sunnyGroup = new THREE.Group();
    sunnyGroup.visible = true;
    // Breezy summer V-neck collar trim & light summer chest pocket badge
    const summerPocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.025),
      accentMat
    );
    summerPocket.position.set(0.11, 0.41, 0.19);
    sunnyGroup.add(summerPocket);
    torsoGroup.add(sunnyGroup);

    const cloudyGroup = new THREE.Group();
    cloudyGroup.visible = false;
    // Quilted Windbreaker Outer Vest & Cozy Woven Neck Scarf
    const windbreakerVest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.268, 0.225, 0.5, 20),
      accentMat
    );
    windbreakerVest.position.set(0, 0.31, 0);
    windbreakerVest.scale.set(1.15, 1, 0.78);
    windbreakerVest.castShadow = true;
    cloudyGroup.add(windbreakerVest);

    const cozyScarfRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.148, 0.042, 10, 20),
      accentMat
    );
    cozyScarfRing.rotation.x = Math.PI / 2;
    cozyScarfRing.position.set(0, 0.59, 0.02);
    cloudyGroup.add(cozyScarfRing);

    const scarfTail = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.28, 0.035),
      accentMat
    );
    scarfTail.position.set(0.06, 0.44, 0.21);
    scarfTail.rotation.z = -0.12;
    cloudyGroup.add(scarfTail);
    torsoGroup.add(cloudyGroup);

    const rainyGroup = new THREE.Group();
    rainyGroup.visible = false;
    // Waterproof Flared Raincoat Skirt & High-Visibility Storm Stripes
    const raincoatSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.32, 0.42, 20, 1, false),
      outfitMat
    );
    raincoatSkirt.position.set(0, -0.04, 0);
    raincoatSkirt.scale.set(1.14, 1, 0.82);
    raincoatSkirt.castShadow = true;
    rainyGroup.add(raincoatSkirt);

    const stormStripeChest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.262, 0.254, 0.065, 20),
      accentMat
    );
    stormStripeChest.position.set(0, 0.38, 0);
    stormStripeChest.scale.set(1.17, 1, 0.76);
    rainyGroup.add(stormStripeChest);

    const stormCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.175, 0.16, 16, 1, true, Math.PI * 0.15, Math.PI * 1.7),
      outfitMat
    );
    stormCollar.position.set(0, 0.62, -0.01);
    rainyGroup.add(stormCollar);
    torsoGroup.add(rainyGroup);

    residentWeatherWardrobe = {
      sunnyGroup,
      cloudyGroup,
      rainyGroup,
      forearmMeshes: [],
      sleeveCuffMeshes: [],
    };
  }

  // 3. Neck & Seamless, Smooth-Cheeked Sculpted Human Head Group (Zero Cheek Bumps!)
  const neckAndHeadGroup = new THREE.Group();
  neckAndHeadGroup.position.set(0, 0.64, 0);
  torsoGroup.add(neckAndHeadGroup);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.092, 0.18, 22),
    skinMat
  );
  neckMesh.position.y = 0.065;
  neckAndHeadGroup.add(neckMesh);

  const headCenterY = 0.29;
  // Single, continuous vertex-sculpted head mesh (smooth cheeks, tapered jawline, soft chin — zero intersecting spheres!)
  const cranium = new THREE.Mesh(getSculptedHeadGeometry(), skinMat);
  cranium.position.set(0, headCenterY, 0);
  cranium.castShadow = true;
  cranium.receiveShadow = true;
  tagPickable(cranium);
  neckAndHeadGroup.add(cranium);

  // Delicate, Seamless Nose Bridge & Soft Nose Tip (no protruding nostril balls)
  const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.048, 10, 14), skinMat);
  noseBridge.position.set(0, headCenterY + 0.008, 0.193);
  noseBridge.rotation.x = -0.2;
   noseBridge.scale.set(0.95, 1, 0.78);
  neckAndHeadGroup.add(noseBridge);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 16, 14), skinMat);
  noseTip.position.set(0, headCenterY - 0.018, 0.207);
  noseTip.scale.set(1.02, 0.86, 0.92);
  neckAndHeadGroup.add(noseTip);

  // Detailed Human Ears with Outer Helix & Earlobe
  const earGeo = new THREE.SphereGeometry(0.042, 16, 14);
  for (const side of [-1, 1]) {
    const earGroup = new THREE.Group();
    earGroup.position.set(side * 0.19, headCenterY - 0.004, -0.012);
    earGroup.rotation.y = side * -0.16;

    const outerEar = new THREE.Mesh(earGeo, skinMat);
    outerEar.scale.set(0.38, 1.02, 0.68);
    earGroup.add(outerEar);

    const earRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.026, 0.0065, 8, 14, Math.PI * 1.3),
      skinMat
    );
    earRim.rotation.y = Math.PI / 2;
    earRim.position.set(side * 0.007, 0.005, 0);
    earGroup.add(earRim);

    // Subtle pearl/gold stud earring on female characters for extra beauty
    if (isFemaleChar) {
      const earring = new THREE.Mesh(
        new THREE.SphereGeometry(0.009, 10, 10),
        new THREE.MeshStandardMaterial({
          color: '#fde047',
          emissive: '#f59e0b',
          emissiveIntensity: 0.25,
          metalness: 0.85,
          roughness: 0.15,
        })
      );
      earring.position.set(side * 0.012, -0.032, 0.006);
      earGroup.add(earring);
    }

    neckAndHeadGroup.add(earGroup);
  }

  // Lifelike Multi-Layered Eyes (Almond Sclera + Limbal Ring + Luminous Iris + Deep Pupil + Dual Cornea Catchlights + Curved Lashes)
  const scleraMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.14 });
  const irisColorHex =
    options.isPlayer
      ? '#0284c7'
      : options.id === 'aria'
      ? '#059669'
      : options.id === 'elena'
      ? '#7c3aed'
      : options.id === 'maya'
      ? '#d97706'
      : options.id === 'leo'
      ? '#2563eb'
      : options.id === 'alie'
      ? '#06b6d4'
      : options.id === 'joseph'
      ? '#9333ea'
      : options.id === 'iysha'
      ? '#10b981'
      : options.id === 'amie'
      ? '#ec4899'
      : options.id === 'hawa'
      ? '#f59e0b'
      : '#4f46e5';
  const irisColorObj = new THREE.Color(irisColorHex);
  const limbalMat = new THREE.MeshBasicMaterial({
    color: irisColorObj.clone().multiplyScalar(0.45),
  });
  const irisMat = new THREE.MeshStandardMaterial({
    color: irisColorHex,
    emissive: irisColorHex,
    emissiveIntensity: 0.15,
    roughness: 0.12,
    metalness: 0.12,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#060911' });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const lashMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });

  const buildEye = (side: -1 | 1) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.071, headCenterY + 0.032, 0.175);
    eyeGroup.rotation.y = side * 0.12;

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 16), scleraMat);
    eyeball.scale.set(1.08, 0.94, 0.58);
    eyeGroup.add(eyeball);

    // Outer limbal ring for realistic iris depth
    const limbalRing = new THREE.Mesh(new THREE.SphereGeometry(0.0225, 18, 14), limbalMat);
    limbalRing.position.set(0, 0, 0.0125);
    limbalRing.scale.set(1, 1, 0.42);
    eyeGroup.add(limbalRing);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0205, 18, 14), irisMat);
    iris.position.set(0, 0, 0.014);
    iris.scale.set(1, 1, 0.44);
    eyeGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 12), pupilMat);
    pupil.position.set(0, 0, 0.0185);
    pupil.scale.set(1, 1, 0.4);
    eyeGroup.add(pupil);

    // Primary & Secondary Glossy Cornea Catchlights (makes eyes sparkle with life!)
    const catchlightMain = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 10, 10), catchlightMat);
    catchlightMain.position.set(0.0065, 0.0065, 0.0225);
    eyeGroup.add(catchlightMain);

    const catchlightSub = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 8), catchlightMat);
    catchlightSub.position.set(-0.0055, -0.005, 0.022);
    eyeGroup.add(catchlightSub);

    // Smoothly curved upper eyelash arch
    const lashArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, isFemaleChar ? 0.0042 : 0.0032, 8, 16, Math.PI * 0.88),
      lashMat
    );
    lashArch.position.set(0, 0.002, 0.012);
    lashArch.rotation.z = Math.PI * 0.06;
    eyeGroup.add(lashArch);

    const eyelid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0365, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      skinMat
    );
    eyelid.scale.set(1.1, 0.1, 0.68);
    eyelid.position.set(0, 0.008, 0.003);
    eyeGroup.add(eyelid);

    neckAndHeadGroup.add(eyeGroup);
    return eyelid;
  };

  const leftEyelid = buildEye(-1);
  const rightEyelid = buildEye(1);

  const browGeo = new THREE.CapsuleGeometry(isFemaleChar ? 0.0075 : 0.009, 0.05, 8, 10);
  const leftBrow = new THREE.Mesh(browGeo, hairMat);
  leftBrow.position.set(-0.072, headCenterY + 0.08, 0.184);
  leftBrow.rotation.z = Math.PI / 2 + 0.05;
   leftBrow.rotation.y = -0.14;
  neckAndHeadGroup.add(leftBrow);

  const rightBrow = new THREE.Mesh(browGeo, hairMat);
  rightBrow.position.set(0.072, headCenterY + 0.08, 0.184);
  rightBrow.rotation.z = Math.PI / 2 - 0.05;
  rightBrow.rotation.y = 0.14;
  neckAndHeadGroup.add(rightBrow);

  // Sculpted Upper & Lower Lips + Animated Mouth Cavity with Subtle Teeth Glimpse
  const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0088, 0.044, 8, 12), lipMat);
  upperLip.rotation.z = Math.PI / 2;
  upperLip.position.set(0, headCenterY - 0.068, 0.188);
  upperLip.scale.set(0.95, 1, 0.82);
  neckAndHeadGroup.add(upperLip);

  const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0098, 0.04, 8, 12), lipMat);
  lowerLip.rotation.z = Math.PI / 2;
  lowerLip.position.set(0, headCenterY - 0.086, 0.186);
  lowerLip.scale.set(0.95, 1, 0.85);
  neckAndHeadGroup.add(lowerLip);

  const mouthMat = new THREE.MeshBasicMaterial({ color: '#6b121c' });
  const mouthMesh = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), mouthMat);
  mouthMesh.position.set(0, headCenterY - 0.077, 0.183);
  mouthMesh.scale.set(1.18, 0.24, 0.4);
  neckAndHeadGroup.add(mouthMesh);

  const teethMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.034, 0.008, 0.012),
    new THREE.MeshBasicMaterial({ color: '#f8fafc' })
  );
  teethMesh.position.set(0, 0.009, 0.014);
  mouthMesh.add(teethMesh);

  // Voluminous Multi-Strand 3D Hairstyles for Every Resident & Explorer
  const hairBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairBase.position.set(0, headCenterY + 0.022, -0.014);
  hairBase.rotation.x = -0.18;
  hairBase.castShadow = true;
  neckAndHeadGroup.add(hairBase);

  if (options.id === 'aria') {
    const crownWave = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.16, 10, 14), hairMat);
    crownWave.rotation.z = Math.PI / 2 - 0.12;
    crownWave.position.set(0.01, headCenterY + 0.185, 0.085);
    neckAndHeadGroup.add(crownWave);

    const sideSweep = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), hairMat);
    sideSweep.scale.set(1.45, 0.42, 0.62);
    sideSweep.position.set(0.035, headCenterY + 0.145, 0.148);
    sideSweep.rotation.z = -0.18;
    neckAndHeadGroup.add(sideSweep);
  } else if (options.id === 'elena' || options.id === 'iysha' || options.id === 'hawa') {
    const locksL = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.3, 10, 14), hairMat);
    locksL.position.set(-0.158, headCenterY - 0.085, -0.04);
    locksL.rotation.z = 0.14;
    neckAndHeadGroup.add(locksL);

    const locksR = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.3, 10, 14), hairMat);
    locksR.position.set(0.158, headCenterY - 0.085, -0.04);
    locksR.rotation.z = -0.14;
    neckAndHeadGroup.add(locksR);

    const backHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.28, 12, 16), hairMat);
    backHair.position.set(0, headCenterY - 0.07, -0.115);
    neckAndHeadGroup.add(backHair);

    const softBangs = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), hairMat);
    softBangs.scale.set(1.55, 0.38, 0.55);
    softBangs.position.set(0, headCenterY + 0.148, 0.148);
    neckAndHeadGroup.add(softBangs);
  } else if (options.id === 'maya' || options.id === 'amie') {
    const bunL = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 16), hairMat);
    bunL.position.set(-0.16, headCenterY + 0.19, -0.04);
    neckAndHeadGroup.add(bunL);

    const bunR = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 16), hairMat);
    bunR.position.set(0.16, headCenterY + 0.19, -0.04);
    neckAndHeadGroup.add(bunR);

    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), hairMat);
    fringe.scale.set(1.52, 0.4, 0.58);
    fringe.position.set(0, headCenterY + 0.146, 0.148);
    neckAndHeadGroup.add(fringe);
  } else if (options.id === 'kaelen') {
    const wave = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 10, 14), hairMat);
    wave.rotation.z = Math.PI / 2;
    wave.position.set(0, headCenterY + 0.19, 0.08);
    neckAndHeadGroup.add(wave);

    // Clean, well-groomed jawline beard contour
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(0.192, 20, 16, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.36),
      hairMat
    );
    beard.position.set(0, headCenterY - 0.012, 0.012);
    beard.scale.set(0.91, 1.02, 0.96);
    neckAndHeadGroup.add(beard);
  } else {
    // Sleek layered modern swept hair for Player, Leo/Abdullah, Alie, Joseph
    const topSweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.076, 0.15, 10, 14), hairMat);
    topSweep.position.set(0.015, headCenterY + 0.192, 0.085);
    topSweep.rotation.z = Math.PI / 2 - 0.16;
    topSweep.rotation.x = 0.22;
    neckAndHeadGroup.add(topSweep);

    const frontLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.11, 8, 12), hairMat);
    frontLock.position.set(-0.045, headCenterY + 0.165, 0.145);
    frontLock.rotation.z = 0.45;
    neckAndHeadGroup.add(frontLock);
  }

  // Attach Explorer Headgear Options onto neckAndHeadGroup
  if (options.isPlayer && explorerWardrobe) {
    // 1. Cyber AI Visor Glasses (Sleek translucent holographic lens so Explorer's eyes stay visible!)
    const visorGroup = explorerWardrobe.headgearGroups.visor;
    const visorMat = new THREE.MeshStandardMaterial({
      color: options.accentColor,
      emissive: options.accentColor,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.62,
      roughness: 0.12,
      metalness: 0.6,
    });
    const visorLens = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.062, 0.08), visorMat);
    visorLens.position.set(0, headCenterY + 0.032, 0.178);
    visorGroup.add(visorLens);
    neckAndHeadGroup.add(visorGroup);

    // 2. Golden Explorer Crown
    const crownGroup = explorerWardrobe.headgearGroups.crown;
    crownGroup.visible = false;
    const crownBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.175, 0.11, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.82, roughness: 0.18 })
    );
    crownBand.position.set(0, headCenterY + 0.21, 0);
    crownGroup.add(crownBand);
    const crownGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), accentMat);
    crownGem.position.set(0, headCenterY + 0.22, 0.18);
    crownGroup.add(crownGem);
    neckAndHeadGroup.add(crownGroup);

    // 3. Adventure Peaked Cap
    const capGroup = explorerWardrobe.headgearGroups.cap;
    capGroup.visible = false;
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.222, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
      outfitMat
    );
    capDome.position.set(0, headCenterY + 0.05, 0);
    capGroup.add(capDome);
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.18), accentMat);
    capBrim.position.set(0, headCenterY + 0.11, 0.2);
    capBrim.rotation.x = 0.12;
    capGroup.add(capBrim);
    neckAndHeadGroup.add(capGroup);

    // 4. Studio Tech Headphones
    const headphonesGroup = explorerWardrobe.headgearGroups.headphones;
    headphonesGroup.visible = false;
    const earBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.225, 0.022, 10, 24, Math.PI),
      accentMat
    );
    earBand.position.set(0, headCenterY + 0.02, 0);
    headphonesGroup.add(earBand);
    for (const side of [-1, 1]) {
      const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.06, 16), accentMat);
      earCup.rotation.z = Math.PI / 2;
      earCup.position.set(side * 0.215, headCenterY + 0.01, 0);
      headphonesGroup.add(earCup);
    }
    neckAndHeadGroup.add(headphonesGroup);
  }

  // Attach Weather-Appropriate Headgear for AI Residents (Keep eyes & faces 100% uncovered in Sunny weather!)
  if (!options.isPlayer && residentWeatherWardrobe) {
    const sunnyShadesGroup = new THREE.Group();
    // Subtle hair-crest sunband perched high on crown so eyes and face remain completely clear & beautiful
    const sunCrestBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.198, 0.014, 8, 24, Math.PI),
      accentMat
    );
    sunCrestBand.position.set(0, headCenterY + 0.04, 0.01);
    sunCrestBand.rotation.x = -0.28;
    sunnyShadesGroup.add(sunCrestBand);
    neckAndHeadGroup.add(sunnyShadesGroup);
    residentWeatherWardrobe.sunnyGroup.userData.headPart = sunnyShadesGroup;

    // Rainy: Sculpted 3D Waterproof Raincoat Hood framing the head
    const rainHoodGroup = new THREE.Group();
    rainHoodGroup.visible = false;
    const hoodDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.242, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.66),
      outfitMat
    );
    hoodDome.position.set(0, headCenterY + 0.02, -0.025);
    hoodDome.rotation.x = -0.24;
    hoodDome.castShadow = true;
    rainHoodGroup.add(hoodDome);

    const hoodBrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.218, 0.024, 10, 24, Math.PI * 1.15),
      accentMat
    );
    hoodBrim.position.set(0, headCenterY + 0.04, 0.09);
    hoodBrim.rotation.x = -0.18;
    rainHoodGroup.add(hoodBrim);
    neckAndHeadGroup.add(rainHoodGroup);
    residentWeatherWardrobe.rainyGroup.userData.headPart = rainHoodGroup;
  }

  // 4. Multi-Jointed Human Arms + Unmistakable, Super-Realistic Articulated 5-Finger Hands
  const buildArm = (side: -1 | 1) => {
    const shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(side * 0.31, 0.52, 0);
    torsoGroup.add(shoulderGroup);

    // Sculpted Deltoid Shoulder Cap
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), outfitMat);
    deltoid.position.set(0, -0.02, 0);
    deltoid.scale.set(0.95, 1.15, 0.95);
    shoulderGroup.add(deltoid);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.066, 0.2, 10, 14),
      outfitMat
    );
    upperArm.position.set(0, -0.135, 0);
    upperArm.castShadow = true;
    tagPickable(upperArm);
    shoulderGroup.add(upperArm);

    const elbowGroup = new THREE.Group();
    elbowGroup.position.set(0, -0.26, 0);
    shoulderGroup.add(elbowGroup);

    const isShortSleeve = options.id === 'kaelen' || options.id === 'leo';
    // Forearm ends cleanly above the wrist so the human wrist & full 5-finger hand are 100% exposed
    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.053, 0.13, 10, 14),
      !options.isPlayer ? skinMat : isShortSleeve ? skinMat : outfitMat
    );
    forearm.position.set(0, -0.085, 0);
    forearm.castShadow = true;
    tagPickable(forearm);
    elbowGroup.add(forearm);

    const sleeveCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.058, 0.032, 16),
      accentMat
    );
    sleeveCuff.position.set(0, -0.168, 0);
    sleeveCuff.visible = options.isPlayer ? !isShortSleeve : false;
    elbowGroup.add(sleeveCuff);

    if (residentWeatherWardrobe) {
      residentWeatherWardrobe.forearmMeshes.push(forearm);
      residentWeatherWardrobe.sleeveCuffMeshes.push(sleeveCuff);
    }

    // Exposed Anatomical Human Wrist + Ulnar Wrist Bone
    const wristMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.042, 0.068, 16),
      skinMat
    );
    wristMesh.position.set(0, -0.205, 0);
    wristMesh.scale.set(1.08, 1, 0.82);
    wristMesh.castShadow = true;
    elbowGroup.add(wristMesh);

    // Stylish Smart-Watch / Wristband on Left Wrist for extra character realism
    if (side === -1) {
      const watchBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.046, 0.022, 16),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.35, metalness: 0.5 })
      );
      watchBand.position.set(0, -0.195, 0);
      watchBand.scale.set(1.1, 1, 0.86);
      elbowGroup.add(watchBand);

      const watchFace = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.028, 0.012),
        accentMat
      );
      watchFace.position.set(0, -0.195, 0.038);
      elbowGroup.add(watchFace);
    }

    // Articulated 3D Human Hand Group anchored cleanly below the wrist
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.236, 0);
    elbowGroup.add(handGroup);

    // 1) Sculpted Human Palm (Dorsal Back of Hand + Inner Soft Palm Pad + Thumb Thenar Muscle + 4 Knuckles)
    const palmBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.104, 0.098, 0.042),
      skinMat
    );
    palmBody.position.set(0, -0.048, 0.004);
    palmBody.castShadow = true;
    tagPickable(palmBody);
    handGroup.add(palmBody);

    const innerPalmPad = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 12, 10),
      palmSkinMat
    );
    innerPalmPad.position.set(0, -0.046, 0.016);
    innerPalmPad.scale.set(0.96, 0.88, 0.42);
    handGroup.add(innerPalmPad);

    const thenarMuscle = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 10),
      palmSkinMat
    );
    thenarMuscle.position.set(-side * 0.032, -0.034, 0.018);
    thenarMuscle.scale.set(0.85, 1.15, 0.68);
    handGroup.add(thenarMuscle);

    const wristHeal = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 14, 10),
      skinMat
    );
    wristHeal.position.set(0, -0.012, 0.003);
    wristHeal.scale.set(1.02, 0.58, 0.52);
    handGroup.add(wristHeal);

    // 2) Opposable 3D Human Thumb (Thumb Metacarpal + Proximal & Distal Phalanx + Glossy Thumbnail)
    const thumbGroup = new THREE.Group();
    // Thumb sits on the inner radial side of each hand (-side * X) and angles naturally forward
    thumbGroup.position.set(-side * 0.052, -0.03, 0.016);
    thumbGroup.rotation.z = side * 0.58;
    thumbGroup.rotation.x = 0.35;
    handGroup.add(thumbGroup);

    const thumbJointSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.019, 10, 10),
      skinMat
    );
    thumbGroup.add(thumbJointSphere);

    const thumbBase = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0175, 0.038, 8, 10),
      skinMat
    );
    thumbBase.position.set(0, -0.024, 0);
    thumbBase.castShadow = true;
    thumbGroup.add(thumbBase);

    const thumbTip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.015, 0.034, 8, 10),
      skinMat
    );
    thumbTip.position.set(0, -0.062, 0.008);
    thumbTip.rotation.x = 0.28;
    thumbTip.castShadow = true;
    thumbGroup.add(thumbTip);

    const thumbNail = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.014, 0.005),
      nailMat
    );
    thumbNail.position.set(0, -0.075, -0.006);
    thumbGroup.add(thumbNail);

    // 3) 4 Individual Articulated Multi-Segment Fingers (Index, Middle, Ring, Pinky)
    const fingersGroup = new THREE.Group();
    fingersGroup.position.set(0, -0.096, 0.004);
    handGroup.add(fingersGroup);

    const fingerJoints: THREE.Group[] = [];
    // Finger specs ordered from Index (-side) to Pinky (+side) with natural splay angle
    const fingerSpecs: {
      offsetRatio: number;
      splayAngle: number;
      len1: number;
      len2: number;
      radius: number;
    }[] = [
      { offsetRatio: -1.55, splayAngle: -0.08, len1: 0.045, len2: 0.038, radius: 0.013 }, // Index finger
      { offsetRatio: -0.5, splayAngle: -0.02, len1: 0.052, len2: 0.043, radius: 0.0138 }, // Middle finger (longest)
      { offsetRatio: 0.55, splayAngle: 0.03, len1: 0.047, len2: 0.039, radius: 0.0128 },  // Ring finger
      { offsetRatio: 1.55, splayAngle: 0.09, len1: 0.037, len2: 0.031, radius: 0.0115 },  // Pinky finger
    ];

    fingerSpecs.forEach((f) => {
      const fx = side * f.offsetRatio * 0.0265;
      const singleFinger = new THREE.Group();
      singleFinger.position.set(fx, 0, 0);
      singleFinger.rotation.z = side * f.splayAngle;

      // Dorsal Metacarpal Knuckle Sphere
      const knuckle = new THREE.Mesh(
        new THREE.SphereGeometry(f.radius * 1.18, 10, 10),
        skinMat
      );
      singleFinger.add(knuckle);

      // Proximal & middle phalanx segment
      const phalanx1 = new THREE.Mesh(
        new THREE.CapsuleGeometry(f.radius, f.len1, 8, 10),
        skinMat
      );
      phalanx1.position.set(0, -f.len1 * 0.58, 0.003);
      phalanx1.rotation.x = 0.14;
      phalanx1.castShadow = true;
      singleFinger.add(phalanx1);

      // PIP Middle Knuckle Joint
      const midKnuckle = new THREE.Mesh(
        new THREE.SphereGeometry(f.radius * 0.96, 8, 8),
        skinMat
      );
      midKnuckle.position.set(0, -f.len1 * 1.05, 0.008);
      singleFinger.add(midKnuckle);

      // Distal fingertip phalanx (curled slightly inward like a real human hand)
      const phalanx2 = new THREE.Mesh(
        new THREE.CapsuleGeometry(f.radius * 0.88, f.len2, 8, 10),
        palmSkinMat
      );
      phalanx2.position.set(0, -(f.len1 + f.len2 * 0.48), 0.014);
      phalanx2.rotation.x = 0.32;
      phalanx2.castShadow = true;
      singleFinger.add(phalanx2);

      // Glossy Fingernail Plate on the dorsal tip
      const fingernail = new THREE.Mesh(
        new THREE.BoxGeometry(f.radius * 1.4, 0.013, 0.0045),
        nailMat
      );
      fingernail.position.set(0, -(f.len1 + f.len2 * 0.76), 0.005);
      fingernail.rotation.x = 0.32;
      singleFinger.add(fingernail);

      tagPickable(phalanx1);
      tagPickable(phalanx2);
      fingersGroup.add(singleFinger);
      fingerJoints.push(singleFinger);
    });

    return {
      shoulderGroup,
      elbowGroup,
      handGroup,
      fingersGroup,
      fingerJoints,
      thumbGroup,
    };
  };

  const {
    shoulderGroup: leftShoulderGroup,
    elbowGroup: leftElbowGroup,
    handGroup: leftHandGroup,
    fingersGroup: leftFingersGroup,
    fingerJoints: leftFingerJoints,
    thumbGroup: leftThumbGroup,
  } = buildArm(-1);
  const {
    shoulderGroup: rightShoulderGroup,
    elbowGroup: rightElbowGroup,
    handGroup: rightHandGroup,
    fingersGroup: rightFingersGroup,
    fingerJoints: rightFingerJoints,
    thumbGroup: rightThumbGroup,
  } = buildArm(1);

  // 5. Multi-Jointed Human Legs + Sculpted Knees, Ankles & Detailed 3D Sneakers
  const buildLeg = (side: -1 | 1) => {
    const hipGroup = new THREE.Group();
    hipGroup.position.set(side * 0.125, -0.04, 0);
    pelvisGroup.add(hipGroup);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.088, 0.31, 10, 16),
      trousersMat
    );
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    tagPickable(thigh);
    hipGroup.add(thigh);

    const kneeGroup = new THREE.Group();
    kneeGroup.position.set(0, -0.41, 0);
    hipGroup.add(kneeGroup);

    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.074, 12, 10),
      options.id === 'leo' ? skinMat : trousersMat
    );
    kneeCap.position.set(0, 0, 0.015);
    kneeCap.scale.set(0.95, 0.9, 1.05);
    kneeGroup.add(kneeCap);

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.072, 0.3, 10, 16),
      options.id === 'leo' ? skinMat : trousersMat
    );
    shin.position.set(0, -0.2, 0);
    shin.castShadow = true;
    kneeGroup.add(shin);

    // Multi-Part 3D Sneaker / Footwear (Upper + White Outsole + Toe Cap + Accent Stripe)
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.42, 0.045);
    kneeGroup.add(shoeGroup);

    const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.076, 0.24), shoeMat);
    shoeUpper.position.set(0, 0.01, -0.005);
    shoeUpper.castShadow = true;
    shoeGroup.add(shoeUpper);

    const shoeToe = new THREE.Mesh(
      new THREE.SphereGeometry(0.066, 14, 10),
      shoeMat
    );
    shoeToe.position.set(0, -0.004, 0.105);
    shoeToe.scale.set(1.0, 0.62, 1.15);
    shoeGroup.add(shoeToe);

    const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.032, 0.275), soleMat);
    shoeSole.position.set(0, -0.034, 0.008);
    shoeSole.castShadow = true;
    shoeGroup.add(shoeSole);

    const shoeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.022, 0.12), accentMat);
    shoeStripe.position.set(0, 0.012, 0.01);
    shoeGroup.add(shoeStripe);

    return { hipGroup, kneeGroup };
  };

  const { hipGroup: leftHipGroup, kneeGroup: leftKneeGroup } = buildLeg(-1);
  const { hipGroup: rightHipGroup, kneeGroup: rightKneeGroup } = buildLeg(1);

  const phaseOffset = Math.random() * Math.PI * 2;

  return {
    group,
    pelvisGroup,
    torsoGroup,
    neckAndHeadGroup,
    leftShoulderGroup,
    leftElbowGroup,
    leftHandGroup,
    leftFingersGroup,
    leftFingerJoints,
    leftThumbGroup,
    rightShoulderGroup,
    rightElbowGroup,
    rightHandGroup,
    rightFingersGroup,
    rightFingerJoints,
    rightThumbGroup,
    leftHipGroup,
    leftKneeGroup,
    rightHipGroup,
    rightKneeGroup,
    leftEyelid,
    rightEyelid,
    leftBrow,
    rightBrow,
    mouthMesh,
    ring,
    skinMat,
    outfitMat,
    accentMat,
    trousersMat,
    shoeMat,
    hairMat,
    ringMat,
    explorerWardrobe,
    residentWeatherWardrobe,
    pickMeshes,
    phaseOffset,
    baseScale: options.scale,
    animState: {
      walkWeight: 0,
      talkWeight: 0,
      sitWeight: 0,
      emoteWeight: 0,
      jumpWeight: 0,
      slideWeight: 0,
      walkPhase: phaseOffset,
      lastWorldX: 0,
      lastWorldZ: 0,
      smoothedSpeed: 0,
    },
  };
}

export interface AnimateRigParams {
  rig: HumanoidRig;
  isMoving: boolean;
  moveIntensity?: number; // 0..1.4 normalized locomotion speed (>1 = sprinting)
  isJumping?: boolean;
  verticalVelocity?: number;
  isSliding?: boolean;
  isTalking: boolean;
  isSitting: boolean;
  lookTargetAngleDelta: number | null;
  elapsedTime: number;
  deltaTime?: number;
  isSelected: boolean;
  emotion?: string;
  emotionIntensity?: number;
  emote?: EmoteType;
  isDistant?: boolean;
}

/**
 * Multi-state skeletal animation blender with smooth exponential weight transitions
 * between Idle (Breathing/Talking), Walking (Full Gait Cycle), and Sitting states,
 * plus emotional facial expressions and body language.
 */
export function animateHumanoidRig({
  rig,
  isMoving,
  moveIntensity,
  isJumping = false,
  verticalVelocity = 0,
  isSliding = false,
  isTalking,
  isSitting,
  lookTargetAngleDelta,
  elapsedTime,
  deltaTime = 1 / 60,
  isSelected,
  emotion = 'Calmness',
  emotionIntensity = 65,
  emote = 'none',
  isDistant = false,
}: AnimateRigParams) {
  const dt = Math.min(0.1, Math.max(0.001, deltaTime));
  const state = rig.animState;
  const emoNorm = THREE.MathUtils.clamp((emotionIntensity ?? 65) / 100, 0.15, 1.0);
  const hasActiveEmote = Boolean(emote && emote !== 'none' && !isMoving && !isJumping && !isSliding);

  // 1. Update Continuous Blend Weights (Exponential Damping)
  const targetWalkWeight = isMoving
    ? THREE.MathUtils.clamp(moveIntensity !== undefined ? moveIntensity : 1.0, 0.15, 1.35)
    : 0.0;
  const targetSitWeight =
    isSitting && !isMoving && !isJumping && !isSliding && emote !== 'dance' && emote !== 'cheer'
      ? 1.0
      : 0.0;
  const targetTalkWeight = isTalking ? 1.0 : 0.0;
  const targetEmoteWeight = hasActiveEmote && !isSitting ? 1.0 : 0.0;
  const targetJumpWeight = isJumping ? 1.0 : 0.0;
  const targetSlideWeight = isSliding && !isJumping ? 1.0 : 0.0;

  // Smooth blend rates (~150-220ms transition window)
  const walkBlendAlpha = 1 - Math.exp(-10.5 * dt);
  const sitBlendAlpha = 1 - Math.exp(-7.5 * dt);
  const talkBlendAlpha = 1 - Math.exp(-8.5 * dt);
  const emoteBlendAlpha = 1 - Math.exp(-10.0 * dt);
  const jumpBlendAlpha = 1 - Math.exp(-16.0 * dt);
  const slideBlendAlpha = 1 - Math.exp(-15.0 * dt);

  state.walkWeight = THREE.MathUtils.lerp(state.walkWeight, targetWalkWeight, walkBlendAlpha);
  state.sitWeight = THREE.MathUtils.lerp(state.sitWeight, targetSitWeight, sitBlendAlpha);
  state.talkWeight = THREE.MathUtils.lerp(state.talkWeight, targetTalkWeight, talkBlendAlpha);
  state.emoteWeight = THREE.MathUtils.lerp(state.emoteWeight, targetEmoteWeight, emoteBlendAlpha);
  state.jumpWeight = THREE.MathUtils.lerp(state.jumpWeight, targetJumpWeight, jumpBlendAlpha);
  state.slideWeight = THREE.MathUtils.lerp(state.slideWeight, targetSlideWeight, slideBlendAlpha);

  if (state.walkWeight < 0.002 && targetWalkWeight === 0) state.walkWeight = 0;
  if (state.sitWeight < 0.002 && targetSitWeight === 0) state.sitWeight = 0;
  if (state.talkWeight < 0.002 && targetTalkWeight === 0) state.talkWeight = 0;
  if (state.emoteWeight < 0.002 && targetEmoteWeight === 0) state.emoteWeight = 0;
  if (state.jumpWeight < 0.002 && targetJumpWeight === 0) state.jumpWeight = 0;
  if (state.slideWeight < 0.002 && targetSlideWeight === 0) state.slideWeight = 0;

  // Advance gait phase smoothly scaled by current walk/sprint blend weight
  if (state.walkWeight > 0.001 && state.slideWeight < 0.6) {
    const emotionCadenceMod =
      emotion === 'Excitement' || emotion === 'Happiness'
        ? 1.08
        : emotion === 'Sadness' || emotion === 'Loneliness'
        ? 0.86
        : 1.0;
    const cadence = 8.2 * (0.36 + 0.72 * state.walkWeight) * emotionCadenceMod;
    state.walkPhase += dt * cadence;
  }

  // 2. Facial Animation: Periodic Blinking, Lip-Sync, Eyebrows & Emotional Expressions
  const isSadOrLonely = emotion === 'Sadness' || emotion === 'Loneliness';
  const isAngryOrJealous = emotion === 'Anger' || emotion === 'Jealousy';
  const isHappyOrAffection =
    emotion === 'Happiness' || emotion === 'Affection' || emotion === 'Excitement';
  const isShyOrFear = emotion === 'Embarrassment' || emotion === 'Fear';

  const blinkPeriod = isShyOrFear ? 2.6 : 4.2;
  const blinkCycle = (elapsedTime + rig.phaseOffset) % blinkPeriod;
  const isBlinking = blinkCycle > blinkPeriod - 0.18;
  const restingLidScale = isSadOrLonely ? 0.35 * emoNorm : isHappyOrAffection ? 0.08 : 0.12;
  const targetLidScaleY = isBlinking ? 1.05 : restingLidScale;
  rig.leftEyelid.scale.y = THREE.MathUtils.lerp(rig.leftEyelid.scale.y, targetLidScaleY, 0.35);
  rig.rightEyelid.scale.y = THREE.MathUtils.lerp(rig.rightEyelid.scale.y, targetLidScaleY, 0.35);

  const talkMouthScale = 0.3 + Math.abs(Math.sin(elapsedTime * 14 + rig.phaseOffset)) * 0.95;
  const isLaughingOrCheering = emote === 'laugh' || emote === 'cheer' || emote === 'dance';
  const idleMouthY = isLaughingOrCheering
    ? 0.68 + Math.abs(Math.sin(elapsedTime * 12)) * 0.45
    : isHappyOrAffection
    ? 0.34
    : isSadOrLonely
    ? 0.18
    : 0.25;
  const idleMouthX = isLaughingOrCheering ? 1.45 : isHappyOrAffection ? 1.22 : isSadOrLonely ? 0.85 : 1.0;
  const blendedMouthY = THREE.MathUtils.lerp(idleMouthY, talkMouthScale, state.talkWeight);
  rig.mouthMesh.scale.y = THREE.MathUtils.lerp(rig.mouthMesh.scale.y, blendedMouthY, 0.3);
  rig.mouthMesh.scale.x = THREE.MathUtils.lerp(rig.mouthMesh.scale.x, idleMouthX, 0.2);

  const emotionBrowOffset = isHappyOrAffection
    ? 0.008 * emoNorm
    : isAngryOrJealous
    ? -0.009 * emoNorm
    : isSadOrLonely
    ? -0.005 * emoNorm
    : 0;
  const browLift = Math.sin(elapsedTime * 5) * 0.008 * state.talkWeight + emotionBrowOffset;
  const browTilt = isAngryOrJealous
    ? 0.18 * emoNorm
    : isSadOrLonely
    ? -0.14 * emoNorm
    : 0;

  rig.leftBrow.position.y = THREE.MathUtils.lerp(rig.leftBrow.position.y, 0.372 + browLift, 0.25);
  rig.rightBrow.position.y = THREE.MathUtils.lerp(rig.rightBrow.position.y, 0.372 + browLift, 0.25);
  rig.leftBrow.rotation.z = THREE.MathUtils.lerp(rig.leftBrow.rotation.z, -browTilt, 0.2);
  rig.rightBrow.rotation.z = THREE.MathUtils.lerp(rig.rightBrow.rotation.z, browTilt, 0.2);

  // 3. Head Look-At Tracking, Emotional Head Posture & Conversational Nodding
  const idleHeadYaw = Math.sin(elapsedTime * 0.9 + rig.phaseOffset) * 0.09;
  const talkHeadYaw = Math.sin(elapsedTime * 2.5 + rig.phaseOffset) * 0.16;
  const talkHeadPitch = Math.sin(elapsedTime * 5 + rig.phaseOffset) * 0.07;
  const emotionHeadPitch = isSadOrLonely
    ? 0.11 * emoNorm
    : isShyOrFear
    ? 0.08 * emoNorm
    : isHappyOrAffection
    ? -0.03 * emoNorm
    : 0;

  let desiredHeadYaw = THREE.MathUtils.lerp(idleHeadYaw, talkHeadYaw, state.talkWeight);
  let desiredHeadPitch =
    THREE.MathUtils.lerp(0, talkHeadPitch, state.talkWeight) + emotionHeadPitch;

  if (emote === 'dance') {
    desiredHeadYaw = Math.sin(elapsedTime * 6.5) * 0.26;
    desiredHeadPitch = Math.abs(Math.cos(elapsedTime * 6.5)) * 0.14 - 0.05;
  } else if (emote === 'laugh') {
    desiredHeadPitch = -0.22 + Math.sin(elapsedTime * 15) * 0.09;
    desiredHeadYaw = Math.sin(elapsedTime * 5) * 0.12;
  } else if (emote === 'think') {
    desiredHeadPitch = 0.14;
    desiredHeadYaw = 0.22 + Math.sin(elapsedTime * 1.5) * 0.06;
  } else if (emote === 'cheer') {
    desiredHeadPitch = -0.18 + Math.sin(elapsedTime * 8) * 0.08;
  } else if (lookTargetAngleDelta !== null) {
    desiredHeadYaw = THREE.MathUtils.clamp(lookTargetAngleDelta, -0.85, 0.85);
  }

  const headDamp = 1 - Math.exp(-10 * dt);
  rig.neckAndHeadGroup.rotation.y = THREE.MathUtils.lerp(
    rig.neckAndHeadGroup.rotation.y,
    desiredHeadYaw,
    headDamp
  );
  rig.neckAndHeadGroup.rotation.x = THREE.MathUtils.lerp(
    rig.neckAndHeadGroup.rotation.x,
    desiredHeadPitch,
    headDamp
  );

  // 4. Evaluate Candidate Skeletal Poses (Idle/Talk, Walk, Sit)
  const breathRate = emotion === 'Excitement' || emotion === 'Anger' ? 3.1 : 2.1;
  const breath = Math.sin(elapsedTime * breathRate + rig.phaseOffset) * 0.015;
  const gestureSpeed = emotion === 'Excitement' ? 5.0 : isSadOrLonely ? 2.4 : 3.8;
  const gWaveL = Math.sin(elapsedTime * gestureSpeed + rig.phaseOffset);
  const gWaveR = Math.cos(elapsedTime * (gestureSpeed * 0.9) + rig.phaseOffset);
  const idleArmSway = Math.sin(elapsedTime * 1.5 + rig.phaseOffset) * 0.04;
  const torsoLookYaw =
    lookTargetAngleDelta !== null
      ? THREE.MathUtils.clamp(lookTargetAngleDelta * 0.35, -0.3, 0.3)
      : 0;
  const emotionTorsoLean = isSadOrLonely ? 0.06 * emoNorm : isHappyOrAffection ? -0.02 : 0;

  // Pose A: Standing Idle blended with Conversational & Emotional Gestures
  _idlePose.pelvisY = 0.92 + breath;
  _idlePose.pelvisRotY = 0;
  _idlePose.torsoRotX = emotionTorsoLean;
  _idlePose.torsoRotY = torsoLookYaw;
  _idlePose.leftHipX = 0;
  _idlePose.rightHipX = 0;
  _idlePose.leftKneeX = 0;
  _idlePose.rightKneeX = 0;
  _idlePose.leftShoulderX = THREE.MathUtils.lerp(
    idleArmSway,
    -0.38 + gWaveL * 0.22,
    state.talkWeight
  );
  _idlePose.rightShoulderX = THREE.MathUtils.lerp(
    -idleArmSway,
    -0.38 + gWaveR * 0.22,
    state.talkWeight
  );
  _idlePose.leftShoulderZ = 0.06;
  _idlePose.rightShoulderZ = -0.06;
  _idlePose.leftElbowX = THREE.MathUtils.lerp(-0.16, -0.88 + gWaveL * 0.28, state.talkWeight);
  _idlePose.rightElbowX = THREE.MathUtils.lerp(-0.16, -0.88 + gWaveR * 0.28, state.talkWeight);

  // Pose B: Full-Body Walking & Sprinting Gait Pose (Scales dynamically with sprint intensity)
  const phase = state.walkPhase;
  const stride = Math.sin(phase);
  const oppStride = Math.sin(phase + Math.PI);
  const sprintFactor = THREE.MathUtils.clamp((state.walkWeight - 0.72) / 0.55, 0, 1);

  const hipSwingAmp = THREE.MathUtils.lerp(0.62, 0.96, sprintFactor);
  const kneeDriveAmp = THREE.MathUtils.lerp(0.74, 1.24, sprintFactor);
  const armSwingAmp = THREE.MathUtils.lerp(0.48, 0.88, sprintFactor);
  const torsoForwardLean = THREE.MathUtils.lerp(0.055, 0.21, sprintFactor);
  const verticalBounce = THREE.MathUtils.lerp(0.048, 0.095, sprintFactor);
  const baseElbowBend = THREE.MathUtils.lerp(-0.28, -0.92, sprintFactor);

  _walkPose.pelvisY = 0.92 + Math.abs(Math.cos(phase)) * verticalBounce - sprintFactor * 0.03;
  _walkPose.pelvisRotY = stride * (0.085 + sprintFactor * 0.06);
  _walkPose.torsoRotX = torsoForwardLean;
  _walkPose.torsoRotY = -stride * (0.11 + sprintFactor * 0.08);
  _walkPose.leftHipX = stride * hipSwingAmp;
  _walkPose.rightHipX = oppStride * hipSwingAmp;
  _walkPose.leftKneeX = Math.max(0.04 * sprintFactor, -Math.cos(phase) * kneeDriveAmp);
  _walkPose.rightKneeX = Math.max(0.04 * sprintFactor, -Math.cos(phase + Math.PI) * kneeDriveAmp);
  _walkPose.leftShoulderX = oppStride * armSwingAmp;
  _walkPose.rightShoulderX = stride * armSwingAmp;
  _walkPose.leftShoulderZ = 0.06 + sprintFactor * 0.05;
  _walkPose.rightShoulderZ = -0.06 - sprintFactor * 0.05;
  _walkPose.leftElbowX = baseElbowBend - Math.max(0, oppStride) * (0.36 + sprintFactor * 0.32);
  _walkPose.rightElbowX = baseElbowBend - Math.max(0, stride) * (0.36 + sprintFactor * 0.32);

  // Pose C: Seated Pose (Flush on 3D Bench/Chair Cushion + Conversational Gestures & Partner Turn)
  const sitTalkGestureL = THREE.MathUtils.lerp(-0.32, -0.52 + gWaveL * 0.24, state.talkWeight);
  const sitTalkGestureR = THREE.MathUtils.lerp(-0.32, -0.52 + gWaveR * 0.24, state.talkWeight);
  const sitElbowL = THREE.MathUtils.lerp(-0.62, -0.95 + gWaveL * 0.28, state.talkWeight);
  const sitElbowR = THREE.MathUtils.lerp(-0.62, -0.95 + gWaveR * 0.28, state.talkWeight);
  _sitPose.pelvisY = 0.50 + breath * 0.4;
  _sitPose.pelvisRotY = torsoLookYaw * 0.25;
  _sitPose.torsoRotX = -0.05 + Math.sin(elapsedTime * 1.8 + rig.phaseOffset) * 0.018;
  _sitPose.torsoRotY = torsoLookYaw * 0.72;
  _sitPose.leftHipX = -1.48;
  _sitPose.rightHipX = -1.48;
  _sitPose.leftKneeX = 1.48;
  _sitPose.rightKneeX = 1.48;
  _sitPose.leftShoulderX = sitTalkGestureL;
  _sitPose.rightShoulderX = sitTalkGestureR;
  _sitPose.leftShoulderZ = 0.08;
  _sitPose.rightShoulderZ = -0.08;
  _sitPose.leftElbowX = sitElbowL;
  _sitPose.rightElbowX = sitElbowR;

  // Pose D: Expressive Full-Body Emote Pose (dance, laugh, wave, cheer, think, clap)
  let activeEmotePose: JointPose = _idlePose;
  if (state.emoteWeight > 0.001) {
    const emoteBeat = elapsedTime * 6.8 + rig.phaseOffset;
    const beatSin = Math.sin(emoteBeat);
    const beatCos = Math.cos(emoteBeat);
    activeEmotePose = _emotePose;

    if (emote === 'dance') {
      _emotePose.pelvisY = 0.92 + Math.abs(beatSin) * 0.09 - 0.03;
      _emotePose.pelvisRotY = beatSin * 0.34;
      _emotePose.torsoRotX = Math.sin(emoteBeat * 0.5) * 0.08;
      _emotePose.torsoRotY = -beatSin * 0.28;
      _emotePose.leftHipX = beatSin * 0.42;
      _emotePose.rightHipX = -beatSin * 0.42;
      _emotePose.leftKneeX = Math.max(0, -beatSin * 0.68);
      _emotePose.rightKneeX = Math.max(0, beatSin * 0.68);
      _emotePose.leftShoulderX = -1.65 + beatCos * 0.55;
      _emotePose.rightShoulderX = -1.65 - beatCos * 0.55;
      _emotePose.leftShoulderZ = 0.42 + beatSin * 0.25;
      _emotePose.rightShoulderZ = -0.42 + beatSin * 0.25;
      _emotePose.leftElbowX = -0.85 + beatSin * 0.45;
      _emotePose.rightElbowX = -0.85 - beatSin * 0.45;
    } else if (emote === 'laugh') {
      const laughShake = Math.sin(elapsedTime * 15 + rig.phaseOffset);
      _emotePose.pelvisY = 0.91 + Math.abs(laughShake) * 0.035;
      _emotePose.pelvisRotY = Math.sin(elapsedTime * 4) * 0.08;
      _emotePose.torsoRotX = -0.14 + laughShake * 0.07;
      _emotePose.torsoRotY = Math.cos(elapsedTime * 4) * 0.1;
      _emotePose.leftHipX = -0.08;
      _emotePose.rightHipX = -0.08;
      _emotePose.leftKneeX = 0.16;
      _emotePose.rightKneeX = 0.16;
      _emotePose.leftShoulderX = -0.65 + laughShake * 0.12;
      _emotePose.rightShoulderX = -0.65 - laughShake * 0.12;
      _emotePose.leftShoulderZ = -0.18;
      _emotePose.rightShoulderZ = 0.18;
      _emotePose.leftElbowX = -1.45 + laughShake * 0.15;
      _emotePose.rightElbowX = -1.45 + laughShake * 0.15;
    } else if (emote === 'wave') {
      const waveOsc = Math.sin(elapsedTime * 9.5);
      _emotePose.pelvisY = 0.92 + breath;
      _emotePose.pelvisRotY = 0.06;
      _emotePose.torsoRotX = -0.03;
      _emotePose.torsoRotY = 0.12;
      _emotePose.leftHipX = 0;
      _emotePose.rightHipX = 0;
      _emotePose.leftKneeX = 0;
      _emotePose.rightKneeX = 0;
      _emotePose.leftShoulderX = idleArmSway;
      _emotePose.rightShoulderX = -2.45;
      _emotePose.leftShoulderZ = 0.08;
      _emotePose.rightShoulderZ = -0.35 + waveOsc * 0.32;
      _emotePose.leftElbowX = -0.18;
      _emotePose.rightElbowX = -0.55 + waveOsc * 0.38;
    } else if (emote === 'cheer') {
      const jump = Math.max(0, Math.sin(elapsedTime * 7.5));
      _emotePose.pelvisY = 0.92 + jump * 0.14;
      _emotePose.pelvisRotY = Math.sin(elapsedTime * 4) * 0.12;
      _emotePose.torsoRotX = -0.08;
      _emotePose.torsoRotY = 0;
      _emotePose.leftHipX = -jump * 0.25;
      _emotePose.rightHipX = -jump * 0.25;
      _emotePose.leftKneeX = jump * 0.45;
      _emotePose.rightKneeX = jump * 0.45;
      _emotePose.leftShoulderX = -2.65 + Math.sin(elapsedTime * 10) * 0.22;
      _emotePose.rightShoulderX = -2.65 + Math.cos(elapsedTime * 10) * 0.22;
      _emotePose.leftShoulderZ = 0.35;
      _emotePose.rightShoulderZ = -0.35;
      _emotePose.leftElbowX = -0.35;
      _emotePose.rightElbowX = -0.35;
    } else if (emote === 'think') {
      _emotePose.pelvisY = 0.92 + breath;
      _emotePose.pelvisRotY = -0.08;
      _emotePose.torsoRotX = 0.05;
      _emotePose.torsoRotY = -0.12;
      _emotePose.leftHipX = 0;
      _emotePose.rightHipX = 0;
      _emotePose.leftKneeX = 0;
      _emotePose.rightKneeX = 0;
      _emotePose.leftShoulderX = -0.35;
      _emotePose.rightShoulderX = -1.18;
      _emotePose.leftShoulderZ = -0.18;
      _emotePose.rightShoulderZ = 0.22;
      _emotePose.leftElbowX = -1.35;
      _emotePose.rightElbowX = -1.85 + Math.sin(elapsedTime * 3) * 0.06;
    } else if (emote === 'clap') {
      const clapPulse = Math.abs(Math.sin(elapsedTime * 11));
      _emotePose.pelvisY = 0.92 + Math.sin(elapsedTime * 5.5) * 0.03;
      _emotePose.pelvisRotY = 0;
      _emotePose.torsoRotX = -0.02;
      _emotePose.torsoRotY = 0;
      _emotePose.leftHipX = 0;
      _emotePose.rightHipX = 0;
      _emotePose.leftKneeX = 0;
      _emotePose.rightKneeX = 0;
      _emotePose.leftShoulderX = -0.82;
      _emotePose.rightShoulderX = -0.82;
      _emotePose.leftShoulderZ = -0.24 + clapPulse * 0.22;
      _emotePose.rightShoulderZ = 0.24 - clapPulse * 0.22;
      _emotePose.leftElbowX = -1.15;
      _emotePose.rightElbowX = -1.15;
    } else {
      activeEmotePose = _idlePose;
    }
  }

  // Pose E: Athletic 3D Jump & Mid-Air Leap Pose (Responsive to ascending vs descending velocity)
  const airTilt = THREE.MathUtils.clamp(verticalVelocity * 0.06, -0.25, 0.25);
  _jumpPose.pelvisY = 0.96;
  _jumpPose.pelvisRotY = 0.08;
  _jumpPose.torsoRotX = 0.12 - airTilt * 0.6;
  _jumpPose.torsoRotY = -0.08;
  _jumpPose.leftHipX = -0.78 - airTilt * 0.3;
  _jumpPose.rightHipX = -0.32 + airTilt * 0.25;
  _jumpPose.leftKneeX = 1.28;
  _jumpPose.rightKneeX = 0.82;
  _jumpPose.leftShoulderX = -2.05 + airTilt * 0.4;
  _jumpPose.rightShoulderX = -1.75 + airTilt * 0.4;
  _jumpPose.leftShoulderZ = 0.32;
  _jumpPose.rightShoulderZ = -0.32;
  _jumpPose.leftElbowX = -0.58;
  _jumpPose.rightElbowX = -0.72;

  // Pose F: Dynamic Low-Friction Ground Slide / Parkour Dash Pose
  _slidePose.pelvisY = 0.43;
  _slidePose.pelvisRotY = 0.38;
  _slidePose.torsoRotX = -0.28;
  _slidePose.torsoRotY = -0.34;
  _slidePose.leftHipX = -0.36;
  _slidePose.rightHipX = -1.12;
  _slidePose.leftKneeX = 1.88;
  _slidePose.rightKneeX = 0.16;
  _slidePose.leftShoulderX = -0.78;
  _slidePose.rightShoulderX = 0.48;
  _slidePose.leftShoulderZ = 0.56;
  _slidePose.rightShoulderZ = -0.46;
  _slidePose.leftElbowX = -0.92;
  _slidePose.rightElbowX = -0.52;

  // 5. Blend Poses Together In-Place using Continuous Weights (Zero Heap Allocations!)
  lerpPoseInto(_blendPose, _idlePose, activeEmotePose, state.emoteWeight);
  lerpPoseInto(_blendPose, _blendPose, _walkPose, THREE.MathUtils.clamp(state.walkWeight, 0, 1));
  lerpPoseInto(_blendPose, _blendPose, _sitPose, state.sitWeight);
  lerpPoseInto(_blendPose, _blendPose, _slidePose, state.slideWeight);
  lerpPoseInto(_blendPose, _blendPose, _jumpPose, state.jumpWeight);
  const finalPose = _blendPose;

  // Apply blended target pose with frame-rate independent joint smoothing
  const jointSmooth = 1 - Math.exp(-18 * dt);
  rig.pelvisGroup.position.y = THREE.MathUtils.lerp(
    rig.pelvisGroup.position.y,
    finalPose.pelvisY,
    jointSmooth
  );
  rig.pelvisGroup.rotation.y = THREE.MathUtils.lerp(
    rig.pelvisGroup.rotation.y,
    finalPose.pelvisRotY,
    jointSmooth
  );
  rig.torsoGroup.rotation.x = THREE.MathUtils.lerp(
    rig.torsoGroup.rotation.x,
    finalPose.torsoRotX,
    jointSmooth
  );
  rig.torsoGroup.rotation.y = THREE.MathUtils.lerp(
    rig.torsoGroup.rotation.y,
    finalPose.torsoRotY,
    jointSmooth
  );

  rig.leftHipGroup.rotation.x = THREE.MathUtils.lerp(
    rig.leftHipGroup.rotation.x,
    finalPose.leftHipX,
    jointSmooth
  );
  rig.rightHipGroup.rotation.x = THREE.MathUtils.lerp(
    rig.rightHipGroup.rotation.x,
    finalPose.rightHipX,
    jointSmooth
  );
  rig.leftKneeGroup.rotation.x = THREE.MathUtils.lerp(
    rig.leftKneeGroup.rotation.x,
    finalPose.leftKneeX,
    jointSmooth
  );
  rig.rightKneeGroup.rotation.x = THREE.MathUtils.lerp(
    rig.rightKneeGroup.rotation.x,
    finalPose.rightKneeX,
    jointSmooth
  );

  rig.leftShoulderGroup.rotation.x = THREE.MathUtils.lerp(
    rig.leftShoulderGroup.rotation.x,
    finalPose.leftShoulderX,
    jointSmooth
  );
  rig.rightShoulderGroup.rotation.x = THREE.MathUtils.lerp(
    rig.rightShoulderGroup.rotation.x,
    finalPose.rightShoulderX,
    jointSmooth
  );
  rig.leftShoulderGroup.rotation.z = THREE.MathUtils.lerp(
    rig.leftShoulderGroup.rotation.z,
    finalPose.leftShoulderZ,
    jointSmooth
  );
  rig.rightShoulderGroup.rotation.z = THREE.MathUtils.lerp(
    rig.rightShoulderGroup.rotation.z,
    finalPose.rightShoulderZ,
    jointSmooth
  );
  rig.leftElbowGroup.rotation.x = THREE.MathUtils.lerp(
    rig.leftElbowGroup.rotation.x,
    finalPose.leftElbowX,
    jointSmooth
  );
  rig.rightElbowGroup.rotation.x = THREE.MathUtils.lerp(
    rig.rightElbowGroup.rotation.x,
    finalPose.rightElbowX,
    jointSmooth
  );

  // 5B. Realistic Wrist & Individual 5-Finger Articulation (Skipped for distant characters > 55m away to save CPU)
  if (!isDistant) {
    const isWavingOrCheering = emote === 'wave' || emote === 'cheer' || emote === 'clap' || emote === 'dance';
    const targetFingerCurl = isWavingOrCheering
      ? -0.08 // Open expressive palm with spread fingers
      : state.talkWeight > 0.2
      ? 0.1 + Math.sin(elapsedTime * 5.2 + rig.phaseOffset) * 0.18 // Conversational hand gesturing
      : state.walkWeight > 0.75
      ? 0.68 // Athletic runner grip when sprinting
      : state.walkWeight > 0.1
      ? 0.3 // Relaxed walking hand curl
      : 0.16 + Math.sin(elapsedTime * 1.8 + rig.phaseOffset) * 0.05; // Natural resting hand posture

    const targetWristRotY =
      state.talkWeight > 0.2
        ? Math.sin(elapsedTime * 4.2 + rig.phaseOffset) * 0.32
        : emote === 'wave'
        ? Math.sin(elapsedTime * 9.5) * 0.38
        : 0;
    const targetWristRotX =
      state.talkWeight > 0.2
        ? -0.12 + Math.cos(elapsedTime * 3.8 + rig.phaseOffset) * 0.14
        : emote === 'wave'
        ? -0.22
        : 0;

    rig.leftFingersGroup.rotation.x = THREE.MathUtils.lerp(
      rig.leftFingersGroup.rotation.x,
      targetFingerCurl,
      jointSmooth
    );
    rig.rightFingersGroup.rotation.x = THREE.MathUtils.lerp(
      rig.rightFingersGroup.rotation.x,
      emote === 'wave' ? -0.14 : targetFingerCurl,
      jointSmooth
    );

    // Per-finger anatomical cascade (Index -> Middle -> Ring -> Pinky curl progressively like real human fingers)
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const cascadeCurl =
        state.talkWeight > 0.2
          ? Math.sin(elapsedTime * 6.0 + fIdx * 0.65 + rig.phaseOffset) * 0.12
          : fIdx * 0.055;
      if (rig.leftFingerJoints[fIdx]) {
        rig.leftFingerJoints[fIdx].rotation.x = THREE.MathUtils.lerp(
          rig.leftFingerJoints[fIdx].rotation.x,
          cascadeCurl,
          jointSmooth
        );
      }
      if (rig.rightFingerJoints[fIdx]) {
        rig.rightFingerJoints[fIdx].rotation.x = THREE.MathUtils.lerp(
          rig.rightFingerJoints[fIdx].rotation.x,
          emote === 'wave'
            ? Math.sin(elapsedTime * 11 + fIdx * 0.5) * 0.08
            : cascadeCurl,
          jointSmooth
        );
      }
    }

    rig.leftThumbGroup.rotation.x = THREE.MathUtils.lerp(
      rig.leftThumbGroup.rotation.x,
      0.28 + targetFingerCurl * 0.45,
      jointSmooth
    );
    rig.rightThumbGroup.rotation.x = THREE.MathUtils.lerp(
      rig.rightThumbGroup.rotation.x,
      0.28 + (emote === 'wave' ? -0.06 : targetFingerCurl * 0.45),
      jointSmooth
    );
    rig.leftHandGroup.rotation.y = THREE.MathUtils.lerp(
      rig.leftHandGroup.rotation.y,
      targetWristRotY,
      jointSmooth
    );
    rig.rightHandGroup.rotation.y = THREE.MathUtils.lerp(
      rig.rightHandGroup.rotation.y,
      -targetWristRotY,
      jointSmooth
    );
    rig.leftHandGroup.rotation.x = THREE.MathUtils.lerp(
      rig.leftHandGroup.rotation.x,
      targetWristRotX,
      jointSmooth
    );
    rig.rightHandGroup.rotation.x = THREE.MathUtils.lerp(
      rig.rightHandGroup.rotation.x,
      targetWristRotX,
      jointSmooth
    );
  }

  // 6. Selection Halo Ring
  const ringScale = isSelected ? 1.25 + Math.sin(elapsedTime * 5) * 0.1 : 1.0;
  rig.ring.scale.setScalar(ringScale);
}

export function updateHumanoidRigAppearance(
  rig: HumanoidRig,
  appearance: {
    skinColor?: string;
    outfitColor?: string;
    accentColor?: string;
    pantsColor?: string;
    shoesColor?: string;
    hairColor?: string;
    scale?: number;
    outfitStyle?: ExplorerOutfitStyle;
    headgear?: ExplorerHeadgear;
    backGear?: ExplorerBackGear;
    weather?: 'sunny' | 'cloudy' | 'rainy';
  }
) {
  const appearanceKey = `${appearance.skinColor || ''}|${appearance.outfitColor || ''}|${
    appearance.accentColor || ''
  }|${appearance.pantsColor || ''}|${appearance.shoesColor || ''}|${appearance.hairColor || ''}|${
    appearance.scale ?? 1
  }|${appearance.outfitStyle || ''}|${appearance.headgear || ''}|${appearance.backGear || ''}|${
    appearance.weather || ''
  }`;
  if (rig.lastAppearanceKey === appearanceKey) {
    return;
  }
  rig.lastAppearanceKey = appearanceKey;
  if (appearance.skinColor) {
    rig.skinMat.color.set(appearance.skinColor);
  }
  if (appearance.outfitColor) {
    rig.outfitMat.color.set(appearance.outfitColor);
  }
  if (appearance.accentColor) {
    rig.accentMat.color.set(appearance.accentColor);
    if (rig.accentMat.emissive) {
      rig.accentMat.emissive.set(appearance.accentColor);
    }
    rig.ringMat.color.set(appearance.accentColor);
  }
  if (appearance.pantsColor) {
    rig.trousersMat.color.set(appearance.pantsColor);
  }
  if (appearance.shoesColor) {
    rig.shoeMat.color.set(appearance.shoesColor);
  }
  if (appearance.hairColor) {
    rig.hairMat.color.set(appearance.hairColor);
  }
  if (typeof appearance.scale === 'number' && appearance.scale > 0.5) {
    rig.baseScale = appearance.scale;
    rig.group.scale.setScalar(appearance.scale);
  }
  if (rig.residentWeatherWardrobe && appearance.weather) {
    const w = appearance.weather;
    const rw = rig.residentWeatherWardrobe;
    rw.sunnyGroup.visible = w === 'sunny';
    rw.cloudyGroup.visible = w === 'cloudy';
    rw.rainyGroup.visible = w === 'rainy';

    const sunnyHead = rw.sunnyGroup.userData.headPart as THREE.Object3D | undefined;
    if (sunnyHead) sunnyHead.visible = w === 'sunny';
    const rainyHead = rw.rainyGroup.userData.headPart as THREE.Object3D | undefined;
    if (rainyHead) rainyHead.visible = w === 'rainy';

    // Glossy waterproof sheen for raincoats vs breathable cotton/linen in sunny weather
    rig.outfitMat.roughness = w === 'rainy' ? 0.2 : w === 'cloudy' ? 0.45 : 0.64;
    rig.outfitMat.metalness = w === 'rainy' ? 0.18 : 0.05;

    // Short sleeves in sunny weather vs full long sleeves in cloudy/rainy weather
    rw.forearmMeshes.forEach((mesh) => {
      mesh.material = w === 'sunny' ? rig.skinMat : rig.outfitMat;
    });
    rw.sleeveCuffMeshes.forEach((cuff) => {
      cuff.visible = w !== 'sunny';
    });
  }
  if (rig.explorerWardrobe) {
    if (appearance.outfitStyle) {
      (Object.keys(rig.explorerWardrobe.outfitGroups) as ExplorerOutfitStyle[]).forEach((k) => {
        rig.explorerWardrobe!.outfitGroups[k].visible = k === appearance.outfitStyle;
      });
    }
    if (appearance.headgear) {
      (
        Object.keys(rig.explorerWardrobe.headgearGroups) as Exclude<ExplorerHeadgear, 'none'>[]
      ).forEach((k) => {
        rig.explorerWardrobe!.headgearGroups[k].visible = k === appearance.headgear;
      });
    }
    if (appearance.backGear) {
      (
        Object.keys(rig.explorerWardrobe.backGearGroups) as Exclude<ExplorerBackGear, 'none'>[]
      ).forEach((k) => {
        rig.explorerWardrobe!.backGearGroups[k].visible = k === appearance.backGear;
      });
    }
  }
}
