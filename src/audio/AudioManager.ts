import { useEffect, useState } from 'react';
import {
  AmbientFrequency,
  AudioManagerSnapshot,
  AudioPlaylistId,
  AudioSettings,
  AudioTrack,
  AudioZoneId,
  PlaybackOrder,
  VehicleSpatialAudioInput,
} from './AudioTypes';
import { AudioZoneManager, DEFAULT_AUDIO_ZONES } from './AudioZoneManager';
import { PlaylistManager } from './PlaylistManager';
import { ProceduralEnvironmentEngine } from './ProceduralAudioSynthesizer';
import { TimePhase, WeatherType } from '../types/game';

const AUDIO_SETTINGS_STORAGE_KEY = 'gemini_city_audio_settings_v1';

function buildDefaultAudioSettings(): AudioSettings {
  const defaultZones = {} as Record<AudioZoneId, { enabled: boolean; volume: number }>;
  DEFAULT_AUDIO_ZONES.forEach((z) => {
    defaultZones[z.id] = { enabled: z.enabled, volume: z.volume };
  });

  return {
    masterVolume: 0.85,
    musicVolume: 0.8,
    radioVolume: 0.85,
    ambienceVolume: 0.75,
    environmentVolume: 0.75,
    uiVolume: 0.7,
    muted: false,
    radioEnabled: true,
    playbackOrder: 'sequential',
    selectedPlaylistId: 'car_radio',
    ambientMusicEnabled: true,
    ambientFrequency: 'balanced',
    ambientFrequencyValue: 50,
    zoneStates: defaultZones,
  };
}

function loadSavedAudioSettings(): AudioSettings {
  const defaults = buildDefaultAudioSettings();
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      ...defaults,
      ...parsed,
      zoneStates: {
        ...defaults.zoneStates,
        ...(parsed.zoneStates || {}),
      },
    };
  } catch {
    return defaults;
  }
}

class GameAudioManager {
  private settings: AudioSettings;
  private playlistManager: PlaylistManager;
  private zoneManager: AudioZoneManager;
  private envEngine: ProceduralEnvironmentEngine;

  // Single reusable HTMLAudioElements (Zero memory bloat!)
  private radioAudio: HTMLAudioElement;
  private ambientAudio: HTMLAudioElement;

  private audioUnlocked = false;
  private needsUserInteractionPrompt = true;

  // Radio Runtime State
  private isPlayingRadio = false;
  private userPausedRadio = false;
  private currentRadioTrack: AudioTrack | null = null;
  private radioErrorBanner: string | null = null;
  private radioErrorClearTimeout: number | null = null;
  private consecutiveRadioErrors = 0;

  // Vehicle & Spatial Distance State
  private isInsideVehicle = false;
  private activeVehicleId: 'cyber_car' | 'bus' | null = null;
  private nearestVehicleDistance = 12;
  private playerCoords = { x: 0, z: 6.2 };
  private radioPhysicalGain = 0;       // 0..1 smoothly faded
  private radioTargetPhysicalGain = 0; // 0..1

  // World Ambient Music Intermittent State Machine
  private ambientState:
    | 'silent_Disabled'
    | 'waiting_quiet_period'
    | 'fading_in'
    | 'playing'
    | 'fading_out' = 'waiting_quiet_period';
  private currentAmbientTrack: AudioTrack | null = null;
  private ambientQuietCountdownSec = 14;
  private ambientCurrentGain = 0;
  private ambientFadeInDurationSec = 4.5;
  private ambientFadeOutDurationSec = 5.0;

  // Weather & Time-of-Day State
  private weather: WeatherType = 'sunny';
  private timePhase: TimePhase = 'Morning';

  // Mixer Loop & Subscribers
  private mixerIntervalId: number | null = null;
  private lastTickTimeMs = performance.now();
  private listeners: Set<() => void> = new Set();
  private cachedSnapshot: AudioManagerSnapshot | null = null;

  constructor() {
    this.settings = loadSavedAudioSettings();
    this.playlistManager = new PlaylistManager();
    this.zoneManager = new AudioZoneManager(this.settings.zoneStates);
    this.envEngine = new ProceduralEnvironmentEngine();

    // Initialize single reusable Radio Audio element
    this.radioAudio = new Audio();
    this.radioAudio.preload = 'metadata';
    this.radioAudio.crossOrigin = 'anonymous';

    // Initialize single reusable World Ambient Music Audio element
    this.ambientAudio = new Audio();
    this.ambientAudio.preload = 'metadata';
    this.ambientAudio.crossOrigin = 'anonymous';

    // Select initial radio track without playing until needed
    const initTracks = this.playlistManager.getPlaylist(this.settings.selectedPlaylistId).tracks;
    if (initTracks.length > 0) {
      this.currentRadioTrack = initTracks[0];
    }

    this.scheduleNextAmbientQuietDelay(true);
    this.bindAudioElementEvents();
    this.bindGlobalAutoplayUnlock();
    this.startMixerLoop();
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore storage quota errors
    }
  }

  private bindGlobalAutoplayUnlock(): void {
    if (typeof window === 'undefined') return;
    const handleGesture = () => {
      this.unlockAudio();
    };
    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
  }

  public unlockAudio(): void {
    const running = this.envEngine.initOrResume();
    if (running || !this.audioUnlocked) {
      this.audioUnlocked = true;
      this.needsUserInteractionPrompt = false;

      // If player is already in a vehicle with radio enabled, resume radio
      if (this.isInsideVehicle && this.settings.radioEnabled && !this.userPausedRadio) {
        this.playRadio();
      }
      this.notifyListeners();
    }
  }

  private bindAudioElementEvents(): void {
    // Automatic advance to next song when current radio track finishes!
    this.radioAudio.addEventListener('ended', () => {
      this.consecutiveRadioErrors = 0;
      this.nextTrack(true);
    });

    // Resilient error handling: never crash Gemini City on a broken audio file!
    this.radioAudio.addEventListener('error', () => {
      this.handleRadioTrackError();
    });

    // World Ambient track finished -> enter natural quiet period!
    this.ambientAudio.addEventListener('ended', () => {
      this.ambientCurrentGain = 0;
      this.ambientAudio.pause();
      this.scheduleNextAmbientQuietDelay(false);
      this.notifyListeners();
    });

    this.ambientAudio.addEventListener('error', () => {
      this.ambientCurrentGain = 0;
      this.ambientAudio.pause();
      this.scheduleNextAmbientQuietDelay(false);
      this.notifyListeners();
    });
  }

  private handleRadioTrackError(): void {
    this.showRadioError('⚠️ Unable to play this track');
    this.consecutiveRadioErrors += 1;

    const currentPlaylist = this.playlistManager.getPlaylist(this.settings.selectedPlaylistId);
    if (
      currentPlaylist.tracks.length > 1 &&
      this.consecutiveRadioErrors < currentPlaylist.tracks.length
    ) {
      window.setTimeout(() => {
        this.nextTrack(true);
      }, 350);
    } else {
      this.isPlayingRadio = false;
      this.radioAudio.pause();
      this.notifyListeners();
    }
  }

  private showRadioError(msg: string): void {
    this.radioErrorBanner = msg;
    if (this.radioErrorClearTimeout !== null) {
      window.clearTimeout(this.radioErrorClearTimeout);
    }
    this.radioErrorClearTimeout = window.setTimeout(() => {
      this.radioErrorBanner = null;
      this.notifyListeners();
    }, 4500);
    this.notifyListeners();
  }

  private scheduleNextAmbientQuietDelay(isInitial = false): void {
    if (!this.settings.ambientMusicEnabled) {
      this.ambientState = 'silent_Disabled';
      return;
    }
    this.ambientState = 'waiting_quiet_period';

    // Frequency slider: 0 (Rare: 45..80s) -> 50 (Balanced: 20..40s) -> 100 (Frequent: 8..18s)
    const freqNorm = Math.max(0, Math.min(100, this.settings.ambientFrequencyValue)) / 100;
    const minDelay = isInitial
      ? Math.round(12 - freqNorm * 7) // Initial quiet period 5..12s
      : Math.round(42 - freqNorm * 32); // Subsequent quiet period 10..42s
    const maxDelay = isInitial
      ? Math.round(20 - freqNorm * 10)
      : Math.round(72 - freqNorm * 52);

    this.ambientQuietCountdownSec =
      minDelay + Math.random() * Math.max(4, maxDelay - minDelay);
  }

  private startMixerLoop(): void {
    if (typeof window === 'undefined') return;
    if (this.mixerIntervalId !== null) {
      window.clearInterval(this.mixerIntervalId);
    }
    this.lastTickTimeMs = performance.now();
    // 10Hz (100ms) smooth audio mixer & spatial fade loop
    this.mixerIntervalId = window.setInterval(() => {
      const now = performance.now();
      const dtSec = Math.min(0.5, Math.max(0.02, (now - this.lastTickTimeMs) / 1000));
      this.lastTickTimeMs = now;
      this.tickMixer(dtSec);
    }, 100);
  }

  private tickMixer(dtSec: number): void {
    const masterGain = this.settings.muted ? 0 : this.settings.masterVolume;

    // -------------------------------------------------------------------------
    // 1. VEHICLE RADIO PHYSICAL DISTANCE & FADE MIXING
    // -------------------------------------------------------------------------
    const activePlaylist = this.playlistManager.getPlaylist(this.settings.selectedPlaylistId);
    const hasRadioTracks = activePlaylist.tracks.length > 0;

    if (!this.settings.radioEnabled || !hasRadioTracks || this.userPausedRadio) {
      this.radioTargetPhysicalGain = 0;
    } else if (this.isInsideVehicle) {
      // Inside vehicle: clear & full volume
      this.radioTargetPhysicalGain = 1.0;
    } else if (this.isPlayingRadio) {
      // Outside vehicle while radio is playing: physical distance rolloff (0..22m)
      const maxAudibleDist = 22.0;
      if (this.nearestVehicleDistance < maxAudibleDist) {
        const closeness = 1 - this.nearestVehicleDistance / maxAudibleDist;
        this.radioTargetPhysicalGain = Math.pow(closeness, 1.8) * 0.36;
      } else {
        this.radioTargetPhysicalGain = 0;
      }
    } else {
      this.radioTargetPhysicalGain = 0;
    }

    // Smoothly interpolate radioPhysicalGain (fadeIn / fadeOut)
    const radioFadeSpeed =
      this.radioTargetPhysicalGain > this.radioPhysicalGain ? 1.8 : 1.35;
    this.radioPhysicalGain +=
      (this.radioTargetPhysicalGain - this.radioPhysicalGain) *
      (1 - Math.exp(-radioFadeSpeed * dtSec));

    if (this.radioPhysicalGain < 0.004 && this.radioTargetPhysicalGain === 0) {
      this.radioPhysicalGain = 0;
      // If player exited vehicle and faded all the way to 0, pause element cleanly
      if (!this.isInsideVehicle && this.isPlayingRadio && this.nearestVehicleDistance >= 22) {
        this.radioAudio.pause();
        this.isPlayingRadio = false;
      }
    }

    const effectiveRadioVolume = Math.max(
      0,
      Math.min(
        1,
        masterGain *
          this.settings.musicVolume *
          this.settings.radioVolume *
          this.radioPhysicalGain
      )
    );
    if (Math.abs(this.radioAudio.volume - effectiveRadioVolume) > 0.005) {
      this.radioAudio.volume = effectiveRadioVolume;
    }

    // -------------------------------------------------------------------------
    // 2. LOCATION AUDIO ZONES (Distance-based fadeIn / fadeOut)
    // -------------------------------------------------------------------------
    const { dominantZone } = this.zoneManager.updatePlayerPosition(
      this.playerCoords.x,
      this.playerCoords.z,
      dtSec
    );

    // -------------------------------------------------------------------------
    // 3. PRIORITY DUCKING SYSTEM
    //    Emergency/UI > Vehicle Radio > Location Zone > World Ambience > Environment
    // -------------------------------------------------------------------------
    const radioDuckingFactor = this.isInsideVehicle && this.radioPhysicalGain > 0.1
      ? Math.max(0.14, 1 - this.radioPhysicalGain * 0.82)
      : Math.max(0.45, 1 - this.radioPhysicalGain * 0.5);

    const zoneDuckingFactor = dominantZone
      ? Math.max(0.45, 1 - dominantZone.currentGain * 0.4)
      : 1.0;

    // -------------------------------------------------------------------------
    // 4. WORLD AMBIENT MUSIC INTERMITTENT STATE MACHINE
    // -------------------------------------------------------------------------
    const ambientTracks = this.playlistManager.getPlaylist('world_ambience').tracks;
    if (!this.settings.ambientMusicEnabled || ambientTracks.length === 0) {
      this.ambientState = 'silent_Disabled';
      this.ambientCurrentGain = Math.max(0, this.ambientCurrentGain - dtSec * 0.5);
      if (this.ambientCurrentGain <= 0.01 && !this.ambientAudio.paused) {
        this.ambientAudio.pause();
      }
    } else {
      if (this.ambientState === 'silent_Disabled') {
        this.scheduleNextAmbientQuietDelay(true);
      } else if (this.ambientState === 'waiting_quiet_period') {
        // Pause countdown while inside vehicle with loud radio so ambient waits for quiet open world
        if (!this.isInsideVehicle || !this.settings.radioEnabled) {
          this.ambientQuietCountdownSec = Math.max(
            0,
            this.ambientQuietCountdownSec - dtSec
          );
          if (this.ambientQuietCountdownSec <= 0 && this.audioUnlocked) {
            this.startNextAmbientTrack();
          }
        }
      } else if (this.ambientState === 'fading_in') {
        this.ambientCurrentGain = Math.min(
          1,
          this.ambientCurrentGain + dtSec / Math.max(1, this.ambientFadeInDurationSec)
        );
        if (this.ambientCurrentGain >= 0.99) {
          this.ambientCurrentGain = 1;
          this.ambientState = 'playing';
        }
      } else if (this.ambientState === 'playing') {
        const dur = this.ambientAudio.duration || this.currentAmbientTrack?.durationSec || 26;
        const cur = this.ambientAudio.currentTime || 0;
        if (dur - cur <= this.ambientFadeOutDurationSec) {
          this.ambientState = 'fading_out';
        }
      } else if (this.ambientState === 'fading_out') {
        this.ambientCurrentGain = Math.max(
          0,
          this.ambientCurrentGain - dtSec / Math.max(1, this.ambientFadeOutDurationSec)
        );
        if (this.ambientCurrentGain <= 0.01) {
          this.ambientCurrentGain = 0;
          this.ambientAudio.pause();
          this.scheduleNextAmbientQuietDelay(false);
        }
      }
    }

    const effectiveAmbientMusicVol = Math.max(
      0,
      Math.min(
        1,
        masterGain *
          this.settings.musicVolume *
          this.settings.ambienceVolume *
          this.ambientCurrentGain *
          radioDuckingFactor *
          zoneDuckingFactor
      )
    );
    if (Math.abs(this.ambientAudio.volume - effectiveAmbientMusicVol) > 0.005) {
      this.ambientAudio.volume = effectiveAmbientMusicVol;
    }

    // -------------------------------------------------------------------------
    // 5. ENVIRONMENTAL, WEATHER & TIME-OF-DAY SYNTHESIS MIX
    // -------------------------------------------------------------------------
    const cabinInsulationFactor = this.isInsideVehicle ? 0.35 : 1.0;
    const effectiveEnvGain = Math.max(
      0,
      Math.min(
        1,
        masterGain *
          this.settings.environmentVolume *
          cabinInsulationFactor *
          radioDuckingFactor
      )
    );
    this.envEngine.updateMix({
      effectiveEnvGain,
      weather: this.weather,
      timePhase: this.timePhase,
      activeZoneProfile: dominantZone ? dominantZone.zone.profile : null,
      activeZoneEffectiveGain: dominantZone ? dominantZone.currentGain : 0,
    });

    this.cachedSnapshot = null;
    this.notifyListeners();
  }

  private startNextAmbientTrack(): void {
    const nextAmb = this.playlistManager.getNextTrack(
      'world_ambience',
      this.currentAmbientTrack?.id || null,
      'shuffle',
      'next'
    );
    if (!nextAmb) {
      this.ambientState = 'silent_Disabled';
      return;
    }

    this.currentAmbientTrack = nextAmb;
    this.ambientCurrentGain = 0.02;
    this.ambientState = 'fading_in';
    this.ambientAudio.src = nextAmb.url;
    this.ambientAudio.currentTime = 0;
    this.ambientAudio.volume = 0;
    this.ambientAudio.play().catch(() => {
      // If autoplay blocked, wait for unlock
      this.needsUserInteractionPrompt = true;
      this.scheduleNextAmbientQuietDelay(true);
    });
  }

  // ===========================================================================
  // PUBLIC API (Matches Specification Section 15)
  // ===========================================================================

  public playRadio(): void {
    this.unlockAudio();
    this.userPausedRadio = false;
    if (!this.settings.radioEnabled) {
      this.settings.radioEnabled = true;
      this.saveSettings();
    }

    const playlist = this.playlistManager.getPlaylist(this.settings.selectedPlaylistId);
    if (playlist.tracks.length === 0) {
      this.currentRadioTrack = null;
      this.isPlayingRadio = false;
      this.radioAudio.pause();
      this.notifyListeners();
      return;
    }

    if (
      !this.currentRadioTrack ||
      !playlist.tracks.some((t) => t.id === this.currentRadioTrack?.id)
    ) {
      this.currentRadioTrack = playlist.tracks[0];
    }

    if (this.radioAudio.src !== this.currentRadioTrack.url) {
      this.radioAudio.src = this.currentRadioTrack.url;
    }

    this.isPlayingRadio = true;
    if (this.radioPhysicalGain < 0.08) {
      this.radioPhysicalGain = 0.08;
    }
    this.radioAudio
      .play()
      .then(() => {
        this.consecutiveRadioErrors = 0;
        this.needsUserInteractionPrompt = false;
        this.notifyListeners();
      })
      .catch((err) => {
        if (err && err.name === 'NotAllowedError') {
          this.needsUserInteractionPrompt = true;
          this.notifyListeners();
        } else {
          this.handleRadioTrackError();
        }
      });
  }

  public pauseRadio(): void {
    this.userPausedRadio = true;
    this.isPlayingRadio = false;
    this.radioAudio.pause();
    this.notifyListeners();
  }

  public toggleRadioPlayPause(): void {
    if (this.isPlayingRadio && !this.radioAudio.paused) {
      this.pauseRadio();
    } else {
      this.playRadio();
    }
  }

  public nextTrack(autoAdvance = false): void {
    const next = this.playlistManager.getNextTrack(
      this.settings.selectedPlaylistId,
      this.currentRadioTrack?.id || null,
      this.settings.playbackOrder,
      'next'
    );
    if (!next) {
      this.currentRadioTrack = null;
      this.isPlayingRadio = false;
      this.radioAudio.pause();
      this.notifyListeners();
      return;
    }
    this.currentRadioTrack = next;
    this.radioAudio.src = next.url;
    this.radioAudio.currentTime = 0;
    if (this.isPlayingRadio || !autoAdvance) {
      this.playRadio();
    } else {
      this.notifyListeners();
    }
  }

  public previousTrack(): void {
    if (this.radioAudio.currentTime > 4) {
      this.radioAudio.currentTime = 0;
      this.notifyListeners();
      return;
    }
    const prev = this.playlistManager.getNextTrack(
      this.settings.selectedPlaylistId,
      this.currentRadioTrack?.id || null,
      this.settings.playbackOrder,
      'prev'
    );
    if (!prev) return;
    this.currentRadioTrack = prev;
    this.radioAudio.src = prev.url;
    this.radioAudio.currentTime = 0;
    this.playRadio();
  }

  public selectTrack(trackId: string): void {
    const playlist = this.playlistManager.getPlaylist(this.settings.selectedPlaylistId);
    const found = playlist.tracks.find((t) => t.id === trackId);
    if (!found) return;
    this.currentRadioTrack = found;
    this.radioAudio.src = found.url;
    this.radioAudio.currentTime = 0;
    this.playRadio();
  }

  public setRadioEnabled(enabled: boolean): void {
    this.settings.radioEnabled = enabled;
    this.saveSettings();
    if (!enabled) {
      this.radioTargetPhysicalGain = 0;
      this.isPlayingRadio = false;
      this.radioAudio.pause();
    } else if (this.isInsideVehicle) {
      this.playRadio();
    }
    this.notifyListeners();
  }

  public setPlaybackOrder(order: PlaybackOrder): void {
    this.settings.playbackOrder = order;
    this.saveSettings();
    this.notifyListeners();
  }

  public setSelectedPlaylist(playlistId: AudioPlaylistId): void {
    this.settings.selectedPlaylistId = playlistId;
    this.saveSettings();
    const list = this.playlistManager.getPlaylist(playlistId).tracks;
    this.currentRadioTrack = list[0] || null;
    if (this.currentRadioTrack) {
      this.radioAudio.src = this.currentRadioTrack.url;
      if (this.isPlayingRadio) {
        this.playRadio();
      }
    } else {
      this.isPlayingRadio = false;
      this.radioAudio.pause();
    }
    this.notifyListeners();
  }

  public uploadAudioFiles(
    files: FileList | File[],
    targetPlaylistId?: AudioPlaylistId
  ): { added: number; errors: string[] } {
    this.unlockAudio();
    const pid = targetPlaylistId || this.settings.selectedPlaylistId;
    const { addedTracks, errors } = this.playlistManager.addUploadedFiles(files, pid);
    if (errors.length > 0) {
      this.showRadioError(`⚠️ ${errors[0]}`);
    }
    if (addedTracks.length > 0 && !this.currentRadioTrack) {
      this.currentRadioTrack = addedTracks[0];
    }
    this.notifyListeners();
    return { added: addedTracks.length, errors };
  }

  public removeTrack(trackId: string): void {
    const wasCurrent = this.currentRadioTrack?.id === trackId;
    this.playlistManager.removeTrack(trackId);
    if (wasCurrent) {
      const remaining = this.playlistManager.getPlaylist(this.settings.selectedPlaylistId).tracks;
      this.currentRadioTrack = remaining[0] || null;
      if (this.currentRadioTrack && this.isPlayingRadio) {
        this.radioAudio.src = this.currentRadioTrack.url;
        this.playRadio();
      } else {
        this.isPlayingRadio = false;
        this.radioAudio.pause();
      }
    }
    this.notifyListeners();
  }

  // Vehicle Enter / Exit & Spatial Distance Updates
  public enterVehicle(vehicleId: 'cyber_car' | 'bus'): void {
    const wasInside = this.isInsideVehicle;
    this.isInsideVehicle = true;
    this.activeVehicleId = vehicleId;
    this.nearestVehicleDistance = 0;

    if (!wasInside && this.settings.radioEnabled && !this.userPausedRadio) {
      this.playRadio();
    }
    this.notifyListeners();
  }

  public exitVehicle(): void {
    if (!this.isInsideVehicle) return;
    this.isInsideVehicle = false;
    this.activeVehicleId = null;
    this.notifyListeners();
  }

  public updateSpatialState(input: VehicleSpatialAudioInput): void {
    this.playerCoords.x = input.playerX;
    this.playerCoords.z = input.playerZ;

    const distToCar = Math.hypot(input.playerX - input.carX, input.playerZ - input.carZ);
    const distToBus = Math.hypot(input.playerX - input.busX, input.playerZ - input.busZ);
    this.nearestVehicleDistance = Math.min(distToCar, distToBus);

    const nowInside = input.isRidingCar || input.isRidingBus;
    const vehicleId: 'cyber_car' | 'bus' | null = input.isRidingCar
      ? 'cyber_car'
      : input.isRidingBus
      ? 'bus'
      : null;

    if (nowInside && !this.isInsideVehicle && vehicleId) {
      this.enterVehicle(vehicleId);
    } else if (!nowInside && this.isInsideVehicle) {
      this.exitVehicle();
    }
  }

  // World Ambience Controls
  public playAmbient(): void {
    this.unlockAudio();
    this.settings.ambientMusicEnabled = true;
    this.saveSettings();
    this.startNextAmbientTrack();
    this.notifyListeners();
  }

  public stopAmbient(): void {
    this.settings.ambientMusicEnabled = false;
    this.saveSettings();
    this.ambientState = 'silent_Disabled';
    this.ambientCurrentGain = 0;
    this.ambientAudio.pause();
    this.notifyListeners();
  }

  public setAmbientEnabled(enabled: boolean): void {
    if (enabled) {
      this.settings.ambientMusicEnabled = true;
      this.saveSettings();
      this.scheduleNextAmbientQuietDelay(true);
    } else {
      this.stopAmbient();
    }
    this.notifyListeners();
  }

  public setAmbientFrequencyValue(val: number): void {
    const clamped = Math.max(0, Math.min(100, val));
    this.settings.ambientFrequencyValue = clamped;
    this.settings.ambientFrequency =
      clamped < 34 ? 'rare' : clamped < 67 ? 'balanced' : 'frequent';
    this.saveSettings();
    if (this.ambientState === 'waiting_quiet_period') {
      this.scheduleNextAmbientQuietDelay(false);
    }
    this.notifyListeners();
  }

  // Location Zones Controls
  public enterZone(zoneId: AudioZoneId): void {
    this.zoneManager.enterZone(zoneId);
    this.notifyListeners();
  }

  public exitZone(zoneId: AudioZoneId): void {
    this.zoneManager.exitZone(zoneId);
    this.notifyListeners();
  }

  public setZoneEnabled(zoneId: AudioZoneId, enabled: boolean): void {
    this.zoneManager.setZoneEnabled(zoneId, enabled);
    this.settings.zoneStates[zoneId] = {
      enabled,
      volume: this.settings.zoneStates[zoneId]?.volume ?? 0.8,
    };
    this.saveSettings();
    this.notifyListeners();
  }

  public setZoneVolume(zoneId: AudioZoneId, volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.zoneManager.setZoneVolume(zoneId, v);
    this.settings.zoneStates[zoneId] = {
      enabled: this.settings.zoneStates[zoneId]?.enabled ?? true,
      volume: v,
    };
    this.saveSettings();
    this.notifyListeners();
  }

  // Weather & Time-of-Day Integration
  public setWeather(weather: WeatherType): void {
    if (this.weather !== weather) {
      this.weather = weather;
      this.notifyListeners();
    }
  }

  public setTimeOfDay(timePhase: TimePhase): void {
    if (this.timePhase !== timePhase) {
      this.timePhase = timePhase;
      this.notifyListeners();
    }
  }

  // Volume & Master Controls
  public setMasterVolume(value: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, value));
    if (this.settings.masterVolume > 0 && this.settings.muted) {
      this.settings.muted = false;
    }
    this.saveSettings();
    this.notifyListeners();
  }

  public setMusicVolume(value: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, value));
    this.saveSettings();
    this.notifyListeners();
  }

  public setRadioVolume(value: number): void {
    this.settings.radioVolume = Math.max(0, Math.min(1, value));
    this.saveSettings();
    this.notifyListeners();
  }

  public setAmbienceVolume(value: number): void {
    this.settings.ambienceVolume = Math.max(0, Math.min(1, value));
    this.saveSettings();
    this.notifyListeners();
  }

  public setEnvironmentVolume(value: number): void {
    this.settings.environmentVolume = Math.max(0, Math.min(1, value));
    this.saveSettings();
    this.notifyListeners();
  }

  public setUiVolume(value: number): void {
    this.settings.uiVolume = Math.max(0, Math.min(1, value));
    this.saveSettings();
    this.notifyListeners();
  }

  public setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.saveSettings();
    this.notifyListeners();
  }

  public toggleMute(): void {
    this.setMuted(!this.settings.muted);
  }

  public resetAudioSettings(): void {
    this.settings = buildDefaultAudioSettings();
    this.zoneManager.syncPreferences(this.settings.zoneStates);
    this.saveSettings();
    this.notifyListeners();
  }

  public playUiSound(
    kind: 'click' | 'open' | 'close' | 'success' | 'warning' = 'click'
  ): void {
    if (this.settings.muted) return;
    const effectiveUi = this.settings.masterVolume * this.settings.uiVolume;
    this.envEngine.playUiTone(kind, effectiveUi);
  }

  public getSnapshot(): AudioManagerSnapshot {
    if (this.cachedSnapshot) return this.cachedSnapshot;
    const allZones = this.zoneManager.getAllZones();
    const activeZone = allZones.reduce<typeof allZones[0] | null>((best, cur) => {
      if (cur.currentGain > 0.05 && (!best || cur.currentGain > best.currentGain)) {
        return cur;
      }
      return best;
    }, null);

    const activePlaylist = this.playlistManager.getPlaylist(this.settings.selectedPlaylistId);
    const hasTracks = activePlaylist.tracks.length > 0;

    this.cachedSnapshot = {
      settings: { ...this.settings },
      audioUnlocked: this.audioUnlocked,
      needsUserInteractionPrompt: this.needsUserInteractionPrompt,
      isPlayingRadio: this.isPlayingRadio && !this.radioAudio.paused,
      isInsideVehicle: this.isInsideVehicle,
      activeVehicleId: this.activeVehicleId,
      nearestVehicleDistance: Math.round(this.nearestVehicleDistance * 10) / 10,
      radioPhysicalGain: Math.round(this.radioPhysicalGain * 100) / 100,
      currentTrack: hasTracks ? this.currentRadioTrack : null,
      currentTrackProgressSec: Math.floor(this.radioAudio.currentTime || 0),
      currentTrackDurationSec: Math.floor(
        this.radioAudio.duration || this.currentRadioTrack?.durationSec || 0
      ),
      playlists: this.playlistManager.getPlaylists(),
      radioErrorBanner: this.radioErrorBanner,
      ambientStatus: {
        state: this.ambientState,
        currentAmbientTrackTitle: this.currentAmbientTrack?.title || null,
        nextAmbientCountdownSec: Math.ceil(this.ambientQuietCountdownSec),
        currentAmbientGain: Math.round(this.ambientCurrentGain * 100) / 100,
      },
      activeZoneId: activeZone ? activeZone.zone.id : null,
      activeZoneName: activeZone ? activeZone.zone.name : 'Open Island Breeze',
      zones: allZones.map((z) => ({
        ...z,
        zone: { ...z.zone },
      })),
      weather: this.weather,
      timePhase: this.timePhase,
    };
    return this.cachedSnapshot;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((fn) => fn());
  }
}

export const AudioManager = new GameAudioManager();

export function useAudioManager(): AudioManagerSnapshot {
  const [snapshot, setSnapshot] = useState<AudioManagerSnapshot>(() =>
    AudioManager.getSnapshot()
  );

  useEffect(() => {
    return AudioManager.subscribe(() => {
      setSnapshot(AudioManager.getSnapshot());
    });
  }, []);

  return snapshot;
}
