import { BuildingId, TimePhase, WeatherType } from '../types/game';

export type AudioCategory =
  | 'master'
  | 'music'
  | 'radio'
  | 'ambience'
  | 'environment'
  | 'effects'
  | 'ui';

export type PlaybackOrder = 'sequential' | 'shuffle';

export type PlaybackStatus = 'playing' | 'paused' | 'stopped';

export type WorldStationId =
  | 'cyber_city_station'
  | 'jamaica_city_station'
  | 'downtown_station'
  | 'beach_station'
  | 'market_station'
  | 'park_station'
  | 'restaurant_station'
  | 'residential_station'
  | 'shopping_station'
  | 'industrial_station'
  | 'village_station';

export type MusicStationId = WorldStationId | 'car_radio' | (string & {});

export type AudioPlaylistId = MusicStationId;
export type AudioZoneId = WorldStationId;

/**
 * Advanced Station Effect Settings (DEFAULT: all OFF for 100% clean original natural playback)
 */
export interface StationEffectSettings {
  // Reverb
  reverbEnabled: boolean;
  reverbAmount: number;   // 0 .. 1
  reverbRoomSize: number; // 0 .. 1
  reverbWetDry: number;   // 0 .. 1

  // Slow / Time Effect
  slowEnabled: boolean;
  playbackSpeed: number;  // 0.6 .. 1.0 (default 1.00)
  smoothTransition: boolean;

  // Echo
  echoEnabled: boolean;
  echoAmount: number;     // 0 .. 1
  echoDelaySec: number;   // 0.1 .. 1.0s

  // Filter
  filterEnabled: boolean;
  filterType: 'lowpass' | 'highpass';
  filterAmount: number;   // 0 .. 1

  // Fade
  fadeEnabled: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  fadeDurationSec: number; // 1 .. 10s

  // Station Volume
  stationVolume: number;   // 0 .. 1
}

export interface AudioTrack {
  id: string;
  title: string;
  fileName: string;
  fileType: string; // 'MP3' | 'WAV' | 'OGG' | 'M4A' | etc.
  artist?: string;
  url: string;
  isUserUpload: boolean;
  playlistId: AudioPlaylistId;
  durationSec?: number;
  fileSize?: number;
  mimeType?: string;
  addedAt: number;
}

export interface AudioPlaylist {
  id: AudioPlaylistId;
  name: string;
  description: string;
  tracks: AudioTrack[];
}

export interface MusicStationCustomConfig {
  name: string;
  enabled: boolean;
  position: { x: number; z: number };
  radius: number;       // Inner radius (100% volume inside this distance)
  fadeDistance: number; // Fade distance beyond inner radius (0% volume beyond radius + fadeDistance)
  volume: number;       // 0..1 (station master volume)
  playbackOrder: PlaybackOrder;
  effects: StationEffectSettings;
}

export interface MusicStationDefinition {
  id: WorldStationId;
  name: string;
  shortLabel: string;
  icon: string;
  description: string;
  position: { x: number; z: number };
  interactionRadius: number; // Distance at which in-world "[ Open Station ]" prompt appears
  radius: number;            // Inner radius (100% volume)
  fadeDistance: number;      // Outer fade distance (smoothly attenuates to 0%)
  enabled: boolean;
  volume: number;            // 0..1
  playbackOrder: PlaybackOrder;
  effects: StationEffectSettings;
}

export interface MusicStationRuntimeState {
  station: MusicStationDefinition;
  distance: number;
  isPlayerInsideZone: boolean;
  isPlayerAtStationControl: boolean; // Close enough to interact in-world
  targetSpatialGain: number;         // 0..1 based on distance vs inner/outer radius
  currentSpatialGain: number;        // 0..1 smoothly crossfaded
  effectiveAudibleGain: number;      // Final audible mix percentage
  playbackStatus: PlaybackStatus;
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  currentTrackProgressSec: number;
  currentTrackDurationSec: number;
}

export interface CarRadioState {
  enabled: boolean;
  playbackStatus: PlaybackStatus;
  isPlaying: boolean;
  playbackOrder: PlaybackOrder;
  volume: number; // 0..1
  innerRadius: number; // default 5m
  maxHearingDistance: number; // default 40m (0% volume beyond this!)
  position: { x: number; z: number };
  distanceToPlayer: number;
  spatialGain: number; // 1.0 inside car, distance-attenuated outside, 0 far away
  effectiveAudibleGain: number;
  currentTrack: AudioTrack | null;
  currentTrackProgressSec: number;
  currentTrackDurationSec: number;
  effects: StationEffectSettings;
}

export interface AudioSettings {
  masterVolume: number;      // 0..1
  musicVolume: number;       // 0..1
  radioVolume: number;       // 0..1
  ambienceVolume: number;    // 0..1
  environmentVolume: number; // 0..1
  effectsVolume: number;     // 0..1
  uiVolume: number;          // 0..1
  muted: boolean;

  // Configurable station crossfade duration (default 4.0s, range 1..10s)
  crossfadeDurationSec: number;

  // Global optional effect defaults
  effects: StationEffectSettings;

  // Currently selected station in the Audio Manager UI
  editingStationId: WorldStationId;

  // Independent Car Radio configuration
  carRadio: {
    enabled: boolean;
    volume: number;
    playbackOrder: PlaybackOrder;
    maxHearingDistance: number;
    effects: StationEffectSettings;
  };

  // Per-World-Station saved configurations
  stations: Record<WorldStationId, MusicStationCustomConfig>;
}

export interface VehicleSpatialAudioInput {
  playerX: number;
  playerZ: number;
  isRidingCar: boolean;
  isRidingBus: boolean;
  carX: number;
  carZ: number;
  busX: number;
  busZ: number;
  insideHouseMode?: boolean;
}

export interface AudioManagerSnapshot {
  settings: AudioSettings;
  audioUnlocked: boolean;
  needsUserInteractionPrompt: boolean;

  // SYSTEM 1: Independent Spatial Car Radio State
  carRadio: CarRadioState;

  // SYSTEM 2: Independent Spatial World Music Stations
  stations: MusicStationRuntimeState[];
  editingStationId: WorldStationId;

  // Closest audible or physical station for HUD & In-World "[ Open Station ]" interaction
  dominantStationId: WorldStationId | null;
  dominantStationName: string;
  nearbyInteractiveStation: MusicStationRuntimeState | null;
  inWorldStationModalId: WorldStationId | null;

  // Playlists (User Uploaded Music per Station & Car Radio)
  playlists: Record<AudioPlaylistId, AudioPlaylist>;
  errorBanner: string | null;
  statusToast: string | null;

  // Player & World Context
  playerPosition: { x: number; z: number };
  isInsideVehicle: boolean;
  activeVehicleId: 'cyber_car' | 'bus' | null;
  nearestVehicleDistance: number;
  isInsideBuilding: boolean;
  activeBuildingId: BuildingId | null;
  activeBuildingName: string | null;
  weather: WeatherType;
  timePhase: TimePhase;
}
