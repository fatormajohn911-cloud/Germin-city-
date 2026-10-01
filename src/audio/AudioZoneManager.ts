import {
  AudioZoneDefinition,
  AudioZoneId,
  AudioZoneRuntimeState,
} from './AudioTypes';

export const DEFAULT_AUDIO_ZONES: AudioZoneDefinition[] = [
  {
    id: 'park',
    name: 'Central Starlight Park & Fountain',
    shortLabel: 'Park',
    icon: '🌳',
    description: 'Crystal fountain water, songbirds, and rustling sakura & oak leaves.',
    centers: [{ x: 0, z: 1 }],
    radius: 14,
    fadeDistance: 12,
    priority: 4,
    enabled: true,
    volume: 0.85,
    profile: 'park_nature',
  },
  {
    id: 'cafe',
    name: 'Sunbeam Espresso Café & Bistro',
    shortLabel: 'Restaurant / Café',
    icon: '☕',
    description: 'Warm espresso roastery, bistro terrace chatter, and cozy acoustic atmosphere.',
    centers: [{ x: -22, z: 17 }, { x: -16, z: 12 }],
    radius: 11,
    fadeDistance: 10,
    priority: 5,
    enabled: true,
    volume: 0.85,
    profile: 'cafe_restaurant',
  },
  {
    id: 'downtown_school',
    name: 'Horizon Academy & Downtown Civic Plaza',
    shortLabel: 'Downtown',
    icon: '🏛️',
    description: 'Civic clocktower plaza, research institute campus, and downtown avenue bustle.',
    centers: [{ x: 0, z: -25 }, { x: 0, z: -16 }],
    radius: 14,
    fadeDistance: 12,
    priority: 3,
    enabled: true,
    volume: 0.8,
    profile: 'downtown_city',
  },
  {
    id: 'beach_harbor',
    name: 'South Harbor Pier & Sandy Beach Coastline',
    shortLabel: 'Beach / Harbor',
    icon: '🏖️',
    description: 'Ocean waves washing onto golden sand, coastal breeze, and harbor pier.',
    centers: [
      { x: 0, z: 62 },
      { x: -34, z: 28 },
      { x: 38, z: 38 },
      { x: -55, z: 0 },
      { x: 0, z: -58 },
    ],
    radius: 18,
    fadeDistance: 16,
    priority: 3,
    enabled: true,
    volume: 0.9,
    profile: 'beach_ocean',
  },
  {
    id: 'residential',
    name: 'Maple, Blossom & Hearthstone Residential Area',
    shortLabel: 'Residential',
    icon: '🏡',
    description: 'Peaceful residential neighborhood porches, garden wind chimes, and trees.',
    centers: [
      { x: -22, z: -17 },
      { x: 22, z: -17 },
      { x: 22, z: 18 },
      { x: 186, z: -34 },
      { x: 155, z: -16 },
      { x: 154, z: 16 },
    ],
    radius: 12,
    fadeDistance: 10,
    priority: 2,
    enabled: true,
    volume: 0.75,
    profile: 'residential_calm',
  },
  {
    id: 'suspension_bridge',
    name: 'Golden Horizon Suspension Bridge',
    shortLabel: 'Bridge Span',
    icon: '🌉',
    description: 'High-altitude ocean crossing wind and suspension cable harmonics.',
    centers: [
      { x: 72, z: 0 },
      { x: 99, z: 0 },
      { x: 126, z: 0 },
    ],
    radius: 22,
    fadeDistance: 16,
    priority: 4,
    enabled: true,
    volume: 0.8,
    profile: 'bridge_wind',
  },
  {
    id: 'neo_plaza_market',
    name: 'Neo-Horizon Cyber-Core Plaza & Market',
    shortLabel: 'Market / City 2',
    icon: '🏙️',
    description: 'Futuristic anti-gravity gyroscope plaza, market energy, and synth pulse.',
    centers: [
      { x: 198, z: 0 },
      { x: 172, z: 16 },
      { x: 222, z: 16 },
    ],
    radius: 22,
    fadeDistance: 16,
    priority: 4,
    enabled: true,
    volume: 0.85,
    profile: 'cyber_market',
  },
  {
    id: 'sanctuary_temple',
    name: 'Starlight Sanctuary (Church / Mosque / Reflection)',
    shortLabel: 'Sanctuary',
    icon: '🕌',
    description: 'Serene spiritual sanctuary, harmonic bells, and peaceful contemplation.',
    centers: [
      { x: 241, z: 16 },
      { x: 240, z: -16 },
    ],
    radius: 14,
    fadeDistance: 12,
    priority: 5,
    enabled: true,
    volume: 0.85,
    profile: 'sacred_sanctuary',
  },
  {
    id: 'vehicle_depot',
    name: 'Bus Parking Depot & Cyber-Car Station',
    shortLabel: 'Vehicle Area',
    icon: '🚏',
    description: 'Transit bus depot charging canopy and Cyber-Valkyrie GT induction pad.',
    centers: [
      { x: -15.4, z: -2.0 },
      { x: 13.8, z: 5.2 },
    ],
    radius: 9,
    fadeDistance: 8,
    priority: 3,
    enabled: true,
    volume: 0.75,
    profile: 'transit_depot',
  },
];

export class AudioZoneManager {
  private zones: Map<AudioZoneId, AudioZoneRuntimeState> = new Map();
  private forcedZoneId: AudioZoneId | null = null;

  constructor(
    savedZonePrefs?: Record<AudioZoneId, { enabled: boolean; volume: number }>
  ) {
    DEFAULT_AUDIO_ZONES.forEach((def) => {
      const pref = savedZonePrefs?.[def.id];
      const mergedDef: AudioZoneDefinition = {
        ...def,
        enabled: pref ? pref.enabled : def.enabled,
        volume: pref ? pref.volume : def.volume,
      };
      this.zones.set(def.id, {
        zone: mergedDef,
        distance: 999,
        targetWeight: 0,
        currentGain: 0,
        isInside: false,
      });
    });
  }

  public syncPreferences(
    savedZonePrefs: Record<AudioZoneId, { enabled: boolean; volume: number }>
  ): void {
    this.zones.forEach((state, id) => {
      const pref = savedZonePrefs[id];
      if (pref) {
        state.zone.enabled = pref.enabled;
        state.zone.volume = pref.volume;
      }
    });
  }

  public setZoneEnabled(zoneId: AudioZoneId, enabled: boolean): void {
    const st = this.zones.get(zoneId);
    if (st) {
      st.zone.enabled = enabled;
      if (!enabled) {
        st.targetWeight = 0;
      }
    }
  }

  public setZoneVolume(zoneId: AudioZoneId, volume: number): void {
    const st = this.zones.get(zoneId);
    if (st) {
      st.zone.volume = Math.max(0, Math.min(1, volume));
    }
  }

  public enterZone(zoneId: AudioZoneId): void {
    if (this.zones.has(zoneId)) {
      this.forcedZoneId = zoneId;
    }
  }

  public exitZone(zoneId: AudioZoneId): void {
    if (this.forcedZoneId === zoneId) {
      this.forcedZoneId = null;
    }
  }

  public updatePlayerPosition(playerX: number, playerZ: number, dtSec: number): {
    dominantZone: AudioZoneRuntimeState | null;
    allZones: AudioZoneRuntimeState[];
  } {
    let bestZone: AudioZoneRuntimeState | null = null;
    let bestScore = -1;

    this.zones.forEach((st) => {
      // Compute minimum distance to any of this zone's centers
      let minDist = Infinity;
      for (let i = 0; i < st.zone.centers.length; i++) {
        const c = st.zone.centers[i];
        const d = Math.hypot(playerX - c.x, playerZ - c.z);
        if (d < minDist) minDist = d;
      }

      // Special check: Gemini Island outer beach ring (radius 54..72 around (0,0))
      if (st.zone.id === 'beach_harbor') {
        const distFromIslandCenter = Math.hypot(playerX, playerZ);
        if (distFromIslandCenter >= 52 && distFromIslandCenter <= 76 && playerX < 55) {
          const distToRing = Math.abs(distFromIslandCenter - 63);
          if (distToRing < minDist) minDist = distToRing;
        }
      }

      st.distance = minDist;

      if (!st.zone.enabled) {
        st.isInside = false;
        st.targetWeight = 0;
      } else if (this.forcedZoneId === st.zone.id) {
        st.isInside = true;
        st.targetWeight = 1.0;
      } else if (minDist <= st.zone.radius) {
        st.isInside = true;
        st.targetWeight = 1.0;
      } else if (minDist <= st.zone.radius + st.zone.fadeDistance) {
        st.isInside = false;
        st.targetWeight =
          1.0 - (minDist - st.zone.radius) / Math.max(1, st.zone.fadeDistance);
      } else {
        st.isInside = false;
        st.targetWeight = 0;
      }

      // Smooth fadeIn / fadeOut interpolation
      const fadeRate = st.targetWeight > st.currentGain ? 1.8 : 1.4;
      const alpha = 1 - Math.exp(-fadeRate * dtSec);
      st.currentGain += (st.targetWeight * st.zone.volume - st.currentGain) * alpha;
      if (st.currentGain < 0.005 && st.targetWeight === 0) {
        st.currentGain = 0;
      }

      const priorityScore = st.currentGain * (1 + st.zone.priority * 0.25);
      if (st.currentGain > 0.04 && priorityScore > bestScore) {
        bestScore = priorityScore;
        bestZone = st;
      }
    });

    return {
      dominantZone: bestZone,
      allZones: Array.from(this.zones.values()),
    };
  }

  public getAllZones(): AudioZoneRuntimeState[] {
    return Array.from(this.zones.values());
  }
}
