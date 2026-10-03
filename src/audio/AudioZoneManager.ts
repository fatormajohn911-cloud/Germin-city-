import {
  MusicStationCustomConfig,
  MusicStationDefinition,
  MusicStationRuntimeState,
  StationEffectSettings,
  WorldStationId,
} from './AudioTypes';
import { CITY_BUILDINGS } from '../data/cityData';
import { BuildingId } from '../types/game';

/**
 * Default Effect Settings: 100% CLEAN ORIGINAL AUDIO (All effects OFF)
 */
export function buildCleanDefaultEffects(): StationEffectSettings {
  return {
    reverbEnabled: false,
    reverbAmount: 0.35,
    reverbRoomSize: 0.5,
    reverbWetDry: 0.3,
    slowEnabled: false,
    playbackSpeed: 1.0,
    smoothTransition: true,
    echoEnabled: false,
    echoAmount: 0.3,
    echoDelaySec: 0.28,
    filterEnabled: false,
    filterType: 'lowpass',
    filterAmount: 0.4,
    fadeEnabled: false,
    fadeIn: true,
    fadeOut: true,
    fadeDurationSec: 3.0,
    stationVolume: 1.0,
  };
}

/**
 * Physical World Music Stations:
 * 🎵 ONE AUDIO STATION IN CYBER CITY (x: 198, z: 8)
 * 🎵 ONE AUDIO STATION IN JAMAICA CITY (x: -8, z: 6)
 */
export const DEFAULT_WORLD_STATIONS: MusicStationDefinition[] = [
  {
    id: 'cyber_city_station',
    name: 'Cyber City Audio Station',
    shortLabel: 'Cyber Station',
    icon: '⚡',
    description: 'Neo-Horizon Cyber-Core Plaza & Holographic Promenade (x: 198, z: 8).',
    position: { x: 198, z: 8 },
    interactionRadius: 5.5,
    radius: 8,
    fadeDistance: 22,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'jamaica_city_station',
    name: 'Jamaica City Audio Station',
    shortLabel: 'Jamaica Station',
    icon: '🌴',
    description: 'Central Starlight Park Promenade & Floral Gazebo (x: -8, z: 6).',
    position: { x: -8, z: 6 },
    interactionRadius: 5.5,
    radius: 8,
    fadeDistance: 22,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'downtown_station',
    name: 'Downtown Music Station',
    shortLabel: 'Downtown Station',
    icon: '📻',
    description: 'Horizon Civic Academy, Clocktower Plaza & North Boulevard (x: 0, z: -20).',
    position: { x: 0, z: -20 },
    interactionRadius: 22,
    radius: 30,
    fadeDistance: 50,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'beach_station',
    name: 'Beach Music Station',
    shortLabel: 'Beach Station',
    icon: '📻',
    description: 'South Harbor Pier, Boardwalk & Golden Sandy Coastline (x: 0, z: 54).',
    position: { x: 0, z: 54 },
    interactionRadius: 26,
    radius: 40,
    fadeDistance: 80,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'park_station',
    name: 'Park Music Station',
    shortLabel: 'Park Station',
    icon: '📻',
    description: 'Central Starlight Park Fountain & Music Gazebo (x: 0, z: 2).',
    position: { x: 0, z: 2 },
    interactionRadius: 20,
    radius: 24,
    fadeDistance: 36,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'market_station',
    name: 'Market Music Station',
    shortLabel: 'Market Station',
    icon: '📻',
    description: 'Neo-Horizon Cyber-Core Market Plaza & Promenade (x: 198, z: 0).',
    position: { x: 198, z: 0 },
    interactionRadius: 26,
    radius: 35,
    fadeDistance: 55,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'restaurant_station',
    name: 'Restaurant Music Station',
    shortLabel: 'Restaurant Station',
    icon: '📻',
    description: 'Sunbeam Espresso Café, Roastery & Bistro Terrace (x: -22, z: 17).',
    position: { x: -22, z: 17 },
    interactionRadius: 18,
    radius: 20,
    fadeDistance: 35,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'residential_station',
    name: 'Residential Music Station',
    shortLabel: 'Residential Station',
    icon: '📻',
    description: 'West Maple Design Loft & Residential District (x: -22, z: -17).',
    position: { x: -22, z: -17 },
    interactionRadius: 18,
    radius: 22,
    fadeDistance: 38,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'shopping_station',
    name: 'Shopping Music Station',
    shortLabel: 'Shopping Station',
    icon: '📻',
    description: 'East Blossom Conservatory & Shopping Lane (x: 22, z: -17).',
    position: { x: 22, z: -17 },
    interactionRadius: 18,
    radius: 22,
    fadeDistance: 38,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'industrial_station',
    name: 'Industrial Music Station',
    shortLabel: 'Industrial Station',
    icon: '📻',
    description: 'Golden Horizon Suspension Bridge & Transit Depot (x: 99, z: 0).',
    position: { x: 99, z: 0 },
    interactionRadius: 24,
    radius: 32,
    fadeDistance: 50,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
  {
    id: 'village_station',
    name: 'Village Music Station',
    shortLabel: 'Village Station',
    icon: '📻',
    description: 'Hearthstone Civic Commons & South Harbor Village (x: 22, z: 18).',
    position: { x: 22, z: 18 },
    interactionRadius: 18,
    radius: 22,
    fadeDistance: 38,
    enabled: true,
    volume: 1.0,
    playbackOrder: 'sequential',
    effects: buildCleanDefaultEffects(),
  },
];

export function buildDefaultStationsMap(): Record<
  WorldStationId,
  MusicStationCustomConfig
> {
  const map = {} as Record<WorldStationId, MusicStationCustomConfig>;
  DEFAULT_WORLD_STATIONS.forEach((st) => {
    map[st.id] = {
      name: st.name,
      enabled: st.enabled,
      position: { ...st.position },
      radius: st.radius,
      fadeDistance: st.fadeDistance,
      volume: st.volume,
      playbackOrder: st.playbackOrder,
      effects: { ...st.effects },
    };
  });
  return map;
}

/**
 * Computes realistic spatial distance attenuation:
 * - Inside `innerRadius`: 1.0 (100% volume)
 * - Between `innerRadius` and `innerRadius + fadeDistance`: smooth cosine curve 1.0 -> 0.0
 * - Beyond `innerRadius + fadeDistance`: 0.0 (COMPLETELY SILENT)
 */
export function computeSpatialDistanceGain(
  distance: number,
  innerRadius: number,
  fadeDistance: number
): number {
  const safeInner = Math.max(1, innerRadius);
  const safeFade = Math.max(1, fadeDistance);
  if (distance <= safeInner) {
    return 1.0;
  }
  if (distance >= safeInner + safeFade) {
    return 0.0;
  }
  const u = (distance - safeInner) / safeFade;
  // Smooth cosine S-curve from 1.0 down to 0.0
  return Math.max(0, Math.min(1, 0.5 * (1 + Math.cos(Math.PI * u))));
}

export class WorldMusicStationManager {
  private stations: Map<WorldStationId, MusicStationRuntimeState> = new Map();

  constructor(
    savedStations?: Partial<Record<WorldStationId, Partial<MusicStationCustomConfig>>>
  ) {
    DEFAULT_WORLD_STATIONS.forEach((def) => {
      const saved = savedStations?.[def.id];
      const merged: MusicStationDefinition = {
        ...def,
        name: saved?.name || def.name,
        enabled: saved?.enabled ?? def.enabled,
        position: {
          x: saved?.position?.x ?? def.position.x,
          z: saved?.position?.z ?? def.position.z,
        },
        radius: saved?.radius ?? def.radius,
        fadeDistance: saved?.fadeDistance ?? def.fadeDistance,
        volume: saved?.volume ?? def.volume,
        playbackOrder: saved?.playbackOrder || def.playbackOrder,
        effects: {
          ...buildCleanDefaultEffects(),
          ...(saved?.effects || {}),
        },
      };

      this.stations.set(def.id, {
        station: merged,
        distance: 999,
        isPlayerInsideZone: false,
        isPlayerAtStationControl: false,
        targetSpatialGain: 0,
        currentSpatialGain: 0,
        effectiveAudibleGain: 0,
        playbackStatus: 'stopped',
        isPlaying: false,
        currentTrack: null,
        currentTrackProgressSec: 0,
        currentTrackDurationSec: 0,
      });
    });
  }

  public syncPreferences(
    savedStations: Partial<Record<WorldStationId, Partial<MusicStationCustomConfig>>>
  ): void {
    DEFAULT_WORLD_STATIONS.forEach((def) => {
      const runtime = this.stations.get(def.id);
      const saved = savedStations?.[def.id];
      if (runtime) {
        runtime.station.name = saved?.name || def.name;
        runtime.station.enabled = saved?.enabled ?? def.enabled;
        runtime.station.position = {
          x: saved?.position?.x ?? def.position.x,
          z: saved?.position?.z ?? def.position.z,
        };
        runtime.station.radius = saved?.radius ?? def.radius;
        runtime.station.fadeDistance = saved?.fadeDistance ?? def.fadeDistance;
        runtime.station.volume = saved?.volume ?? def.volume;
        runtime.station.playbackOrder = saved?.playbackOrder || def.playbackOrder;
        runtime.station.effects = {
          ...buildCleanDefaultEffects(),
          ...(saved?.effects || {}),
        };
      }
    });
  }

  public updateStationConfig(
    stationId: WorldStationId,
    patch: Partial<MusicStationCustomConfig>
  ): MusicStationCustomConfig | null {
    const runtime = this.stations.get(stationId);
    if (!runtime) return null;
    const st = runtime.station;

    if (typeof patch.name === 'string' && patch.name.trim().length > 0) {
      st.name = patch.name.trim();
    }
    if (typeof patch.enabled === 'boolean') {
      st.enabled = patch.enabled;
    }
    if (patch.position) {
      if (typeof patch.position.x === 'number' && Number.isFinite(patch.position.x)) {
        st.position.x = Math.round(patch.position.x * 10) / 10;
      }
      if (typeof patch.position.z === 'number' && Number.isFinite(patch.position.z)) {
        st.position.z = Math.round(patch.position.z * 10) / 10;
      }
    }
    if (typeof patch.radius === 'number' && Number.isFinite(patch.radius)) {
      st.radius = Math.max(5, Math.min(200, Math.round(patch.radius)));
    }
    if (typeof patch.fadeDistance === 'number' && Number.isFinite(patch.fadeDistance)) {
      st.fadeDistance = Math.max(5, Math.min(250, Math.round(patch.fadeDistance)));
    }
    if (typeof patch.volume === 'number' && Number.isFinite(patch.volume)) {
      st.volume = Math.max(0, Math.min(1, patch.volume));
    }
    if (patch.playbackOrder === 'sequential' || patch.playbackOrder === 'shuffle') {
      st.playbackOrder = patch.playbackOrder;
    }
    if (patch.effects) {
      st.effects = {
        ...st.effects,
        ...patch.effects,
      };
    }

    return {
      name: st.name,
      enabled: st.enabled,
      position: { ...st.position },
      radius: st.radius,
      fadeDistance: st.fadeDistance,
      volume: st.volume,
      playbackOrder: st.playbackOrder,
      effects: { ...st.effects },
    };
  }

  public getStation(stationId: WorldStationId): MusicStationRuntimeState | undefined {
    return this.stations.get(stationId);
  }

  public getAllStations(): MusicStationRuntimeState[] {
    return Array.from(this.stations.values());
  }

  public detectInteriorBuilding(
    playerX: number,
    playerZ: number
  ): {
    isInsideBuilding: boolean;
    buildingId: BuildingId | null;
    buildingName: string | null;
  } {
    const buildings = Object.values(CITY_BUILDINGS);
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (b.id === 'park' || b.id === 'neo_plaza') continue;
      const halfW = b.size[0] * 0.62;
      const halfD = b.size[2] * 0.65;
      if (
        Math.abs(playerX - b.position[0]) <= halfW &&
        Math.abs(playerZ - b.position[2]) <= halfD
      ) {
        return {
          isInsideBuilding: true,
          buildingId: b.id,
          buildingName: b.name,
        };
      }
    }
    return {
      isInsideBuilding: false,
      buildingId: null,
      buildingName: null,
    };
  }

  /**
   * Updates all 9 World Music Stations' spatial distances and smoothly crossfades
   * `currentSpatialGain` toward `targetSpatialGain` over `crossfadeDurationSec`.
   */
  public updateSpatialStations(
    playerX: number,
    playerZ: number,
    dtSec: number,
    crossfadeDurationSec: number
  ): {
    dominantStation: MusicStationRuntimeState | null;
    nearbyInteractiveStation: MusicStationRuntimeState | null;
    allStations: MusicStationRuntimeState[];
    isInsideBuilding: boolean;
    activeBuildingId: BuildingId | null;
    activeBuildingName: string | null;
  } {
    const interiorInfo = this.detectInteriorBuilding(playerX, playerZ);
    const safeCrossfade = Math.max(0.5, Math.min(12, crossfadeDurationSec));
    const maxStep = dtSec / safeCrossfade;

    let dominantStation: MusicStationRuntimeState | null = null;
    let bestAudibleScore = -1;

    let nearbyInteractiveStation: MusicStationRuntimeState | null = null;
    let closestInteractiveDist = Infinity;

    this.stations.forEach((runtime) => {
      const st = runtime.station;
      const dist = Math.hypot(playerX - st.position.x, playerZ - st.position.z);
      runtime.distance = Math.round(dist * 10) / 10;

      const maxReach = st.radius + st.fadeDistance;
      runtime.isPlayerInsideZone = st.enabled && dist <= maxReach;
      runtime.isPlayerAtStationControl = dist <= st.interactionRadius;

      if (runtime.isPlayerAtStationControl && dist < closestInteractiveDist) {
        closestInteractiveDist = dist;
        nearbyInteractiveStation = runtime;
      }

      if (!st.enabled) {
        runtime.targetSpatialGain = 0;
      } else {
        runtime.targetSpatialGain = computeSpatialDistanceGain(
          dist,
          st.radius,
          st.fadeDistance
        );
      }

      // Smooth crossfade transition toward targetSpatialGain
      const diff = runtime.targetSpatialGain - runtime.currentSpatialGain;
      if (Math.abs(diff) <= maxStep) {
        runtime.currentSpatialGain = runtime.targetSpatialGain;
      } else {
        runtime.currentSpatialGain += Math.sign(diff) * maxStep;
      }
      runtime.currentSpatialGain = Math.max(
        0,
        Math.min(1, runtime.currentSpatialGain)
      );

      // Determine dominant station (highest currentSpatialGain, or closest if none audible)
      const score =
        runtime.currentSpatialGain > 0.01
          ? 1000 + runtime.currentSpatialGain * 100 - dist * 0.01
          : -dist;
      if (score > bestAudibleScore) {
        bestAudibleScore = score;
        dominantStation = runtime;
      }
    });

    return {
      dominantStation,
      nearbyInteractiveStation,
      allStations: Array.from(this.stations.values()),
      isInsideBuilding: interiorInfo.isInsideBuilding,
      activeBuildingId: interiorInfo.buildingId,
      activeBuildingName: interiorInfo.buildingName,
    };
  }
}
