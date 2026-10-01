import { TimePhase, WeatherType } from '../types/game';

export type AudioCategory =
  | 'master'
  | 'music'
  | 'radio'
  | 'ambience'
  | 'environment'
  | 'ui';

export type PlaybackOrder = 'sequential' | 'shuffle';

export type AmbientFrequency = 'rare' | 'balanced' | 'frequent';

export type AudioPlaylistId = 'car_radio' | 'custom_radio' | 'world_ambience';

export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  url: string;
  isUserUpload: boolean;
  isBuiltIn?: boolean;
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

export type AudioZoneId =
  | 'park'
  | 'cafe'
  | 'downtown_school'
  | 'beach_harbor'
  | 'residential'
  | 'suspension_bridge'
  | 'neo_plaza_market'
  | 'sanctuary_temple'
  | 'vehicle_depot';

export type ZoneEnvironmentProfile =
  | 'park_nature'
  | 'cafe_restaurant'
  | 'downtown_city'
  | 'beach_ocean'
  | 'residential_calm'
  | 'bridge_wind'
  | 'cyber_market'
  | 'sacred_sanctuary'
  | 'transit_depot';

export interface AudioZoneDefinition {
  id: AudioZoneId;
  name: string;
  shortLabel: string;
  icon: string;
  description: string;
  centers: { x: number; z: number }[];
  radius: number;
  fadeDistance: number;
  priority: number;
  enabled: boolean;
  volume: number; // 0..1
  profile: ZoneEnvironmentProfile;
}

export interface AudioZoneRuntimeState {
  zone: AudioZoneDefinition;
  distance: number;
  targetWeight: number; // 0..1 based on distance & fadeDistance
  currentGain: number;  // 0..1 smoothly interpolated
  isInside: boolean;
}

export interface AudioSettings {
  masterVolume: number;      // 0..1
  musicVolume: number;       // 0..1
  radioVolume: number;       // 0..1
  ambienceVolume: number;    // 0..1
  environmentVolume: number; // 0..1
  uiVolume: number;          // 0..1
  muted: boolean;
  radioEnabled: boolean;
  playbackOrder: PlaybackOrder;
  selectedPlaylistId: AudioPlaylistId;
  ambientMusicEnabled: boolean;
  ambientFrequency: AmbientFrequency; // 0 (rare) -> 1 (balanced) -> 2 (frequent)
  ambientFrequencyValue: number;      // 0..100 continuous slider value
  zoneStates: Record<AudioZoneId, { enabled: boolean; volume: number }>;
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
}

export interface AudioManagerSnapshot {
  settings: AudioSettings;
  audioUnlocked: boolean;
  needsUserInteractionPrompt: boolean;
  isPlayingRadio: boolean;
  isInsideVehicle: boolean;
  activeVehicleId: 'cyber_car' | 'bus' | null;
  nearestVehicleDistance: number;
  radioPhysicalGain: number;
  currentTrack: AudioTrack | null;
  currentTrackProgressSec: number;
  currentTrackDurationSec: number;
  playlists: Record<AudioPlaylistId, AudioPlaylist>;
  radioErrorBanner: string | null;
  ambientStatus: {
    state: 'silent_Disabled' | 'waiting_quiet_period' | 'fading_in' | 'playing' | 'fading_out';
    currentAmbientTrackTitle: string | null;
    nextAmbientCountdownSec: number;
    currentAmbientGain: number;
  };
  activeZoneId: AudioZoneId | null;
  activeZoneName: string;
  zones: AudioZoneRuntimeState[];
  weather: WeatherType;
  timePhase: TimePhase;
}
