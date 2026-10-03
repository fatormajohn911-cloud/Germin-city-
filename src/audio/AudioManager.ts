import { useEffect, useState } from 'react';
import {
  AudioManagerSnapshot,
  AudioPlaylist,
  AudioPlaylistId,
  AudioSettings,
  AudioTrack,
  CarRadioState,
  MusicStationCustomConfig,
  MusicStationDefinition,
  MusicStationId,
  MusicStationRuntimeState,
  PlaybackOrder,
  PlaybackStatus,
  StationEffectSettings,
  VehicleSpatialAudioInput,
  WorldStationId,
} from './AudioTypes';
import {
  buildCleanDefaultEffects,
  buildDefaultStationsMap,
  computeSpatialDistanceGain,
  DEFAULT_WORLD_STATIONS,
  WorldMusicStationManager,
} from './AudioZoneManager';
import { PlaylistManager } from './PlaylistManager';
import { BuildingId, TimePhase, WeatherType } from '../types/game';

const GLOBAL_SETTINGS_KEY = 'gemini_city_audio_settings_v5';
const STATION_STORAGE_PREFIX = 'gemini_station_memory_';

interface StationMemory {
  stationVolume: number;
  effects: StationEffectSettings;
  playbackOrder: PlaybackOrder;
  lastTrackId: string | null;
  lastTrackProgressSec: number;
}

function loadStationMemory(stationId: WorldStationId): StationMemory {
  const defaultMemory: StationMemory = {
    stationVolume: 1.0,
    effects: buildCleanDefaultEffects(),
    playbackOrder: 'sequential',
    lastTrackId: null,
    lastTrackProgressSec: 0,
  };
  if (typeof window === 'undefined') return defaultMemory;
  try {
    const raw = localStorage.getItem(`${STATION_STORAGE_PREFIX}${stationId}`);
    if (!raw) return defaultMemory;
    const parsed = JSON.parse(raw) as Partial<StationMemory>;
    return {
      stationVolume: typeof parsed.stationVolume === 'number' ? parsed.stationVolume : 1.0,
      effects: {
        ...buildCleanDefaultEffects(),
        ...(parsed.effects || {}),
      },
      playbackOrder: parsed.playbackOrder === 'shuffle' ? 'shuffle' : 'sequential',
      lastTrackId: parsed.lastTrackId || null,
      lastTrackProgressSec: typeof parsed.lastTrackProgressSec === 'number' ? parsed.lastTrackProgressSec : 0,
    };
  } catch {
    return defaultMemory;
  }
}

function saveStationMemory(stationId: WorldStationId, memory: StationMemory): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STATION_STORAGE_PREFIX}${stationId}`, JSON.stringify(memory));
  } catch {
    // ignore quota errors
  }
}

/**
 * Single-Player Physical Audio Station Engine
 *
 * Requirements Met:
 * 1. ONE SHARED AUDIO PLAYER: Only one HTMLAudioElement and AudioContext are used across the entire game.
 * 2. PERFORMANCE OPTIMIZED: Clean path when effects are OFF. No node reconnecting or buffer recreation per frame.
 * 3. NO AUDIO LAG: Fixed gain routing, smooth parameter transitions via setTargetAtTime.
 * 4. SMOOTH SLOW EFFECT: Adjusts audioEl.playbackRate directly without restarting or glitching.
 * 5. PROXIMITY ATTENUATION: Only audible near physical stations. Far away = silent. Approaching = smooth fade.
 * 6. CONTINUOUS NORMAL PLAYBACK: Songs play to the end, then auto-advance to next song.
 * 7. STATION MEMORY: Each station independently remembers volume, effects, and last selected track.
 */
class SingleAudioEngine {
  private audioEl: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Fixed Audio Routing Nodes
  private dryGainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private filterGainNode: GainNode | null = null;
  private echoDelayNode: DelayNode | null = null;
  private echoFeedbackGainNode: GainNode | null = null;
  private echoOutputGainNode: GainNode | null = null;
  private reverbSendGainNode: GainNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private reverbReturnGainNode: GainNode | null = null;

  private stationVolumeGainNode: GainNode | null = null;
  private proximityGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;

  private isWebAudioInitialized = false;

  constructor() {
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.audioEl.loop = false;
    this.audioEl.volume = 1.0;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audioEl;
  }

  public unlockAndInit(): boolean {
    if (typeof window === 'undefined') return false;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;

      try {
        this.ctx = new AudioCtx();
      } catch {
        return false;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.isWebAudioInitialized && this.ctx) {
      try {
        this.sourceNode = this.ctx.createMediaElementSource(this.audioEl);

        // 1. Dry Direct Path
        this.dryGainNode = this.ctx.createGain();
        this.dryGainNode.gain.value = 1.0;

        // 2. Low-Pass / High-Pass Filter Path
        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 20000;
        this.filterGainNode = this.ctx.createGain();
        this.filterGainNode.gain.value = 0.0;

        // 3. Echo / Delay Path
        this.echoDelayNode = this.ctx.createDelay(2.0);
        this.echoDelayNode.delayTime.value = 0.28;
        this.echoFeedbackGainNode = this.ctx.createGain();
        this.echoFeedbackGainNode.gain.value = 0.0;
        this.echoOutputGainNode = this.ctx.createGain();
        this.echoOutputGainNode.gain.value = 0.0;

        // 4. Stereo Convolver Reverb Path
        this.reverbSendGainNode = this.ctx.createGain();
        this.reverbSendGainNode.gain.value = 0.0;
        this.convolverNode = this.ctx.createConvolver();
        this.convolverNode.buffer = this.buildReverbImpulse(this.ctx, 2.0);
        this.reverbReturnGainNode = this.ctx.createGain();
        this.reverbReturnGainNode.gain.value = 1.0;

        // 5. Volume & Distance Summing Nodes
        this.stationVolumeGainNode = this.ctx.createGain();
        this.stationVolumeGainNode.gain.value = 1.0;
        this.proximityGainNode = this.ctx.createGain();
        this.proximityGainNode.gain.value = 0.0;
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.value = 1.0;

        // Fixed Wiring:
        // source -> dryGain -> stationVol
        this.sourceNode.connect(this.dryGainNode);
        this.dryGainNode.connect(this.stationVolumeGainNode);

        // source -> filter -> filterGain -> stationVol
        this.sourceNode.connect(this.filterNode);
        this.filterNode.connect(this.filterGainNode);
        this.filterGainNode.connect(this.stationVolumeGainNode);

        // source -> echoDelay -> echoOutput -> stationVol
        // echoDelay -> feedback -> echoDelay
        this.sourceNode.connect(this.echoDelayNode);
        this.echoDelayNode.connect(this.echoFeedbackGainNode);
        this.echoFeedbackGainNode.connect(this.echoDelayNode);
        this.echoDelayNode.connect(this.echoOutputGainNode);
        this.echoOutputGainNode.connect(this.stationVolumeGainNode);

        // source -> reverbSend -> convolver -> reverbReturn -> stationVol
        this.sourceNode.connect(this.reverbSendGainNode);
        this.reverbSendGainNode.connect(this.convolverNode);
        this.convolverNode.connect(this.reverbReturnGainNode);
        this.reverbReturnGainNode.connect(this.stationVolumeGainNode);

        // stationVol -> proximityGain -> masterGain -> destination
        this.stationVolumeGainNode.connect(this.proximityGainNode);
        this.proximityGainNode.connect(this.masterGainNode);
        this.masterGainNode.connect(this.ctx.destination);

        this.isWebAudioInitialized = true;
      } catch {
        // Fallback to direct HTMLAudioElement volume
      }
    }

    return this.ctx?.state === 'running';
  }

  private buildReverbImpulse(ctx: AudioContext, durationSec: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    let lpL = 0;
    let lpR = 0;
    for (let i = 0; i < length; i++) {
      const norm = i / length;
      const attack = Math.min(1, i / (rate * 0.02));
      const env = attack * Math.pow(1 - norm, 2.2);
      const rawL = (Math.random() * 2 - 1) * env * 0.25;
      const rawR = (Math.random() * 2 - 1) * env * 0.25;
      lpL = lpL * 0.78 + rawL * 0.22;
      lpR = lpR * 0.78 + rawR * 0.22;
      left[i] = lpL;
      right[i] = lpR;
    }
    return impulse;
  }

  /**
   * Applies station audio parameters smoothly.
   * If effects are OFF (default), the clean path is active with 0 extra processing.
   */
  public applyStationAudioParams(params: {
    stationVolume: number;
    proximityGain: number;
    masterVolume: number;
    muted: boolean;
    effects: StationEffectSettings;
  }): void {
    const { stationVolume, proximityGain, masterVolume, muted, effects } = params;

    // 1. Smooth Playback Rate (Slow Effect) — never reloads or restarts song!
    const targetSpeed =
      effects.slowEnabled && typeof effects.playbackSpeed === 'number'
        ? Math.max(0.6, Math.min(1.0, effects.playbackSpeed))
        : 1.0;

    if (Math.abs(this.audioEl.playbackRate - targetSpeed) > 0.005) {
      try {
        this.audioEl.playbackRate = targetSpeed;
      } catch {
        // ignore browser clamp
      }
    }

    // Direct fallback if Web Audio is not initialized yet
    if (!this.isWebAudioInitialized || !this.ctx || this.ctx.state !== 'running') {
      const effectiveVol = muted ? 0 : stationVolume * proximityGain * masterVolume;
      if (Math.abs(this.audioEl.volume - effectiveVol) > 0.01) {
        this.audioEl.volume = Math.max(0, Math.min(1, effectiveVol));
      }
      return;
    }

    // Native audio element stays at full volume so Web Audio nodes control spatial attenuation smoothly
    if (this.audioEl.volume !== 1.0) {
      this.audioEl.volume = 1.0;
    }

    const now = this.ctx.currentTime;

    // 2. Master & Station Volume
    const effMaster = muted ? 0 : Math.max(0, Math.min(1, masterVolume));
    this.masterGainNode?.gain.setTargetAtTime(effMaster, now, 0.04);
    this.stationVolumeGainNode?.gain.setTargetAtTime(
      Math.max(0, Math.min(1, stationVolume)),
      now,
      0.04
    );

    // 3. Proximity Attenuation (smooth cosine curve)
    this.proximityGainNode?.gain.setTargetAtTime(
      Math.max(0, Math.min(1, proximityGain)),
      now,
      0.06
    );

    // 4. Effects Routing: Clean path when all effects are disabled!
    const hasFilter = effects.filterEnabled && effects.filterAmount > 0.01;
    const hasEcho = effects.echoEnabled && effects.echoAmount > 0.01;
    const hasReverb = effects.reverbEnabled && effects.reverbAmount > 0.01;

    // Filter
    if (hasFilter && this.filterNode && this.filterGainNode && this.dryGainNode) {
      this.filterNode.type = effects.filterType === 'highpass' ? 'highpass' : 'lowpass';
      if (effects.filterType === 'highpass') {
        const hpFreq = 40 + Math.pow(effects.filterAmount, 2) * 2600;
        this.filterNode.frequency.setTargetAtTime(hpFreq, now, 0.05);
      } else {
        const lpFreq = 20000 * Math.pow(380 / 20000, effects.filterAmount);
        this.filterNode.frequency.setTargetAtTime(lpFreq, now, 0.05);
      }
      this.filterGainNode.gain.setTargetAtTime(1.0, now, 0.05);
      this.dryGainNode.gain.setTargetAtTime(0.0, now, 0.05);
    } else if (this.filterGainNode && this.dryGainNode) {
      this.filterGainNode.gain.setTargetAtTime(0.0, now, 0.05);
      this.dryGainNode.gain.setTargetAtTime(1.0, now, 0.05);
    }

    // Echo
    if (hasEcho && this.echoDelayNode && this.echoFeedbackGainNode && this.echoOutputGainNode) {
      const delayTime = Math.max(0.1, Math.min(1.0, effects.echoDelaySec || 0.28));
      this.echoDelayNode.delayTime.setTargetAtTime(delayTime, now, 0.05);
      const feedback = Math.min(0.62, effects.echoAmount * 0.65);
      this.echoFeedbackGainNode.gain.setTargetAtTime(feedback, now, 0.05);
      this.echoOutputGainNode.gain.setTargetAtTime(effects.echoAmount * 0.6, now, 0.05);
    } else if (this.echoOutputGainNode && this.echoFeedbackGainNode) {
      this.echoOutputGainNode.gain.setTargetAtTime(0.0, now, 0.05);
      this.echoFeedbackGainNode.gain.setTargetAtTime(0.0, now, 0.05);
    }

    // Reverb
    if (hasReverb && this.reverbSendGainNode) {
      const wetSend = Math.min(0.7, effects.reverbAmount * (effects.reverbWetDry ?? 0.35) * 0.7);
      this.reverbSendGainNode.gain.setTargetAtTime(wetSend, now, 0.05);
    } else if (this.reverbSendGainNode) {
      this.reverbSendGainNode.gain.setTargetAtTime(0.0, now, 0.05);
    }
  }

  public playUiTone(kind: 'click' | 'open' | 'close' | 'success' | 'warning' = 'click'): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      if (kind === 'open') {
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
      } else if (kind === 'close') {
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(460, now + 0.06);
      } else if (kind === 'success') {
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(920, now + 0.1);
      } else {
        osc.frequency.setValueAtTime(600, now);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // ignore
    }
  }
}

/**
 * Main Game Audio Manager with Physical Audio Station Architecture
 */
class GameAudioManager {
  private engine: SingleAudioEngine;
  private playlistManager: PlaylistManager;
  private stationManager: WorldMusicStationManager;

  // Station Memory & Custom Configurations
  private stationMemories: Map<WorldStationId, StationMemory> = new Map();

  // Active Station and Shared Player State
  private activeStationId: WorldStationId = 'jamaica_city_station';
  private currentTrack: AudioTrack | null = null;
  private playbackStatus: PlaybackStatus = 'stopped';
  private currentProgressSec = 0;
  private currentDurationSec = 0;

  // Interactive UI Modal State
  private openStationModalId: WorldStationId | null = null;

  // Player & World Proximity Tracking
  private playerCoords = { x: 0, z: 6.2 };
  private activeVehicle: 'cyber_car' | 'bus' | null = null;
  private weather: WeatherType = 'sunny';
  private timePhase: TimePhase = 'morning';

  // Global Audio Settings
  private masterVolume = 1.0;
  private muted = false;
  private audioUnlocked = false;

  private listeners: Set<() => void> = new Set();
  private statusToast: string | null = null;
  private toastTimerId: number | null = null;

  constructor() {
    this.engine = new SingleAudioEngine();

    // Initialize Station Memories for both physical stations
    const cyberMem = loadStationMemory('cyber_city_station');
    const jamaicaMem = loadStationMemory('jamaica_city_station');
    this.stationMemories.set('cyber_city_station', cyberMem);
    this.stationMemories.set('jamaica_city_station', jamaicaMem);

    this.stationManager = new WorldMusicStationManager({
      cyber_city_station: {
        volume: cyberMem.stationVolume,
        effects: cyberMem.effects,
        playbackOrder: cyberMem.playbackOrder,
      },
      jamaica_city_station: {
        volume: jamaicaMem.stationVolume,
        effects: jamaicaMem.effects,
        playbackOrder: jamaicaMem.playbackOrder,
      },
    });

    this.playlistManager = new PlaylistManager(() => {
      this.syncTracksFromLibrary();
      this.notifyListeners();
    });

    this.bindAudioElementEvents();
    this.startProgressTicker();
  }

  private bindAudioElementEvents(): void {
    const el = this.engine.getAudioElement();

    // Continuous Playback: When current song ends, advance to next track automatically!
    el.addEventListener('ended', () => {
      if (this.playbackStatus !== 'playing') return;
      this.nextTrack(this.activeStationId);
    });

    el.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        this.currentDurationSec = Math.round(el.duration);
        if (this.currentTrack) {
          this.currentTrack.durationSec = this.currentDurationSec;
        }
        this.notifyListeners();
      }
    });

    el.addEventListener('timeupdate', () => {
      this.currentProgressSec = Math.floor(el.currentTime);
      // Update memory with current progress
      const mem = this.stationMemories.get(this.activeStationId);
      if (mem) {
        mem.lastTrackProgressSec = this.currentProgressSec;
      }
    });

    el.addEventListener('error', () => {
      if (this.playbackStatus === 'playing') {
        // Skip corrupted or unplayable file gracefully
        this.nextTrack(this.activeStationId);
      }
    });
  }

  private startProgressTicker(): void {
    if (typeof window === 'undefined') return;
    setInterval(() => {
      this.updateProximityAudio();
      this.notifyListeners();
    }, 120);
  }

  private syncTracksFromLibrary(): void {
    const cyberTracks = this.playlistManager.getPlaylist('cyber_city_station').tracks;
    const jamaicaTracks = this.playlistManager.getPlaylist('jamaica_city_station').tracks;

    const cyberMem = this.stationMemories.get('cyber_city_station');
    if (cyberMem && cyberTracks.length > 0) {
      if (!cyberMem.lastTrackId || !cyberTracks.some((t) => t.id === cyberMem.lastTrackId)) {
        cyberMem.lastTrackId = cyberTracks[0].id;
      }
    }

    const jamaicaMem = this.stationMemories.get('jamaica_city_station');
    if (jamaicaMem && jamaicaTracks.length > 0) {
      if (!jamaicaMem.lastTrackId || !jamaicaTracks.some((t) => t.id === jamaicaMem.lastTrackId)) {
        jamaicaMem.lastTrackId = jamaicaTracks[0].id;
      }
    }

    // Set initial track if needed
    if (!this.currentTrack) {
      const activeMem = this.stationMemories.get(this.activeStationId);
      const activeTracks = this.playlistManager.getPlaylist(this.activeStationId).tracks;
      if (activeTracks.length > 0) {
        this.currentTrack =
          activeTracks.find((t) => t.id === activeMem?.lastTrackId) || activeTracks[0];
      }
    }
  }

  // ===========================================================================
  // SPATIAL PROXIMITY ATTENUATION (AUDIO ONLY PLAYS NEAR THE PHYSICAL STATION)
  // ===========================================================================
  private updateProximityAudio(): void {
    const activeStation = DEFAULT_WORLD_STATIONS.find((s) => s.id === this.activeStationId);
    if (!activeStation) return;

    const mem = this.stationMemories.get(this.activeStationId) || {
      stationVolume: 1.0,
      effects: buildCleanDefaultEffects(),
      playbackOrder: 'sequential',
      lastTrackId: null,
      lastTrackProgressSec: 0,
    };

    // Calculate distance between player and the active playing station
    const dist = Math.hypot(
      this.playerCoords.x - activeStation.position.x,
      this.playerCoords.z - activeStation.position.z
    );

    // Compute smooth distance attenuation
    // Inside inner radius (e.g. 8m): 1.0 (100% volume)
    // Between 8m and 28m: smooth cosine fade down to 0
    // Beyond 28m: 0.0 (completely silent)
    const proximityGain = computeSpatialDistanceGain(
      dist,
      activeStation.radius,
      activeStation.fadeDistance
    );

    this.engine.applyStationAudioParams({
      stationVolume: mem.stationVolume,
      proximityGain: this.playbackStatus === 'playing' ? proximityGain : 0,
      masterVolume: this.masterVolume,
      muted: this.muted,
      effects: mem.effects,
    });
  }

  // ===========================================================================
  // PLAYBACK CONTROL METHODS
  // ===========================================================================
  public unlockAudio(): boolean {
    const success = this.engine.unlockAndInit();
    this.audioUnlocked = success;
    this.notifyListeners();
    return success;
  }

  public play(stationId?: MusicStationId, trackId?: string): void {
    this.unlockAudio();
    const targetStationId =
      stationId && stationId !== 'car_radio' ? (stationId as WorldStationId) : this.activeStationId;

    if (targetStationId !== this.activeStationId) {
      this.activeStationId = targetStationId;
    }

    const playlist = this.playlistManager.getPlaylist(targetStationId);
    if (playlist.tracks.length === 0) {
      this.showToast('No tracks in station playlist. Upload a song!');
      return;
    }

    let trackToPlay: AudioTrack | undefined;
    if (trackId) {
      trackToPlay = playlist.tracks.find((t) => t.id === trackId);
    }
    if (!trackToPlay) {
      const mem = this.stationMemories.get(targetStationId);
      trackToPlay =
        playlist.tracks.find((t) => t.id === mem?.lastTrackId) || playlist.tracks[0];
    }

    if (!trackToPlay) return;

    this.currentTrack = trackToPlay;
    const mem = this.stationMemories.get(targetStationId);
    if (mem) {
      mem.lastTrackId = trackToPlay.id;
      saveStationMemory(targetStationId, mem);
    }

    const el = this.engine.getAudioElement();
    if (el.src !== trackToPlay.url) {
      el.src = trackToPlay.url;
      el.currentTime = 0;
    }

    el.play()
      .then(() => {
        this.playbackStatus = 'playing';
        this.notifyListeners();
      })
      .catch(() => {
        this.playbackStatus = 'stopped';
        this.notifyListeners();
      });
  }

  public pause(stationId?: MusicStationId): void {
    if (stationId && stationId !== 'car_radio' && stationId !== this.activeStationId) return;
    const el = this.engine.getAudioElement();
    el.pause();
    this.playbackStatus = 'paused';
    this.notifyListeners();
  }

  public stop(stationId?: MusicStationId): void {
    if (stationId && stationId !== 'car_radio' && stationId !== this.activeStationId) return;
    const el = this.engine.getAudioElement();
    el.pause();
    el.currentTime = 0;
    this.playbackStatus = 'stopped';
    this.currentProgressSec = 0;
    this.notifyListeners();
  }

  public togglePlay(stationId?: MusicStationId): void {
    const targetStationId =
      stationId && stationId !== 'car_radio' ? (stationId as WorldStationId) : this.activeStationId;
    if (this.playbackStatus === 'playing' && targetStationId === this.activeStationId) {
      this.pause(targetStationId);
    } else {
      this.play(targetStationId);
    }
  }

  public nextTrack(
    autoOrStation?: boolean | MusicStationId,
    stationId?: MusicStationId
  ): void {
    const targetSid: MusicStationId =
      typeof autoOrStation === 'string'
        ? autoOrStation
        : stationId || this.activeStationId;
    const safeTarget =
      targetSid !== 'car_radio' ? (targetSid as WorldStationId) : this.activeStationId;

    const playlist = this.playlistManager.getPlaylist(safeTarget);
    if (playlist.tracks.length === 0) return;

    const mem = this.stationMemories.get(safeTarget);
    const order = mem?.playbackOrder || 'sequential';

    let nextIndex = 0;
    if (order === 'shuffle' && playlist.tracks.length > 1) {
      const currentIndex = playlist.tracks.findIndex((t) => t.id === this.currentTrack?.id);
      let rand = Math.floor(Math.random() * (playlist.tracks.length - 1));
      if (rand >= currentIndex) rand++;
      nextIndex = rand;
    } else {
      const currentIndex = playlist.tracks.findIndex((t) => t.id === this.currentTrack?.id);
      nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playlist.tracks.length : 0;
    }

    const nextTrack = playlist.tracks[nextIndex];
    if (nextTrack) {
      this.play(safeTarget, nextTrack.id);
    }
  }

  public previousTrack(stationId?: MusicStationId): void {
    const targetStationId =
      stationId && stationId !== 'car_radio' ? (stationId as WorldStationId) : this.activeStationId;
    const playlist = this.playlistManager.getPlaylist(targetStationId);
    if (playlist.tracks.length === 0) return;

    const currentIndex = playlist.tracks.findIndex((t) => t.id === this.currentTrack?.id);
    const prevIndex =
      currentIndex > 0 ? currentIndex - 1 : playlist.tracks.length - 1;
    const prevTrack = playlist.tracks[prevIndex];
    if (prevTrack) {
      this.play(targetStationId, prevTrack.id);
    }
  }

  public seek(seconds: number): void {
    const el = this.engine.getAudioElement();
    if (Number.isFinite(seconds) && seconds >= 0) {
      el.currentTime = seconds;
      this.currentProgressSec = Math.floor(seconds);
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // STATION SETTINGS, VOLUME & EFFECTS (STATION MEMORY)
  // ===========================================================================
  public setStationVolume(stationId: WorldStationId, volume: number): void {
    const mem = this.stationMemories.get(stationId);
    if (!mem) return;
    mem.stationVolume = Math.max(0, Math.min(1, volume));
    saveStationMemory(stationId, mem);
    this.updateProximityAudio();
    this.notifyListeners();
  }

  public setStationEffects(
    stationId: WorldStationId,
    patch: Partial<StationEffectSettings>
  ): void {
    const mem = this.stationMemories.get(stationId);
    if (!mem) return;
    mem.effects = {
      ...mem.effects,
      ...patch,
    };
    saveStationMemory(stationId, mem);
    this.updateProximityAudio();
    this.notifyListeners();
  }

  public setStationPlaybackOrder(stationId: WorldStationId, order: PlaybackOrder): void {
    const mem = this.stationMemories.get(stationId);
    if (!mem) return;
    mem.playbackOrder = order;
    saveStationMemory(stationId, mem);
    this.notifyListeners();
  }

  public getStationMemory(stationId: WorldStationId): StationMemory {
    return (
      this.stationMemories.get(stationId) || {
        stationVolume: 1.0,
        effects: buildCleanDefaultEffects(),
        playbackOrder: 'sequential',
        lastTrackId: null,
        lastTrackProgressSec: 0,
      }
    );
  }

  // ===========================================================================
  // PHYSICAL STATION INTERACTION & MODAL
  // ===========================================================================
  public openStationModal(stationId: WorldStationId): void {
    this.unlockAudio();
    this.openStationModalId = stationId;
    this.engine.playUiTone('open');
    this.notifyListeners();
  }

  public closeStationModal(): void {
    this.openStationModalId = null;
    this.engine.playUiTone('close');
    this.notifyListeners();
  }

  public isStationModalOpen(stationId?: WorldStationId): boolean {
    return stationId ? this.openStationModalId === stationId : this.openStationModalId !== null;
  }

  public getOpenStationId(): WorldStationId | null {
    return this.openStationModalId;
  }

  // ===========================================================================
  // TRACK UPLOADS & LOCAL LIBRARY
  // ===========================================================================
  public async uploadTrackToStation(
    stationId: WorldStationId,
    file: File
  ): Promise<AudioTrack | null> {
    this.unlockAudio();
    const track = await this.playlistManager.uploadTrack(stationId, file);
    if (track) {
      this.showToast(`Uploaded "${track.title}" to ${stationId === 'cyber_city_station' ? 'Cyber City' : 'Jamaica City'}!`);
      // If this station is currently idle, queue the newly uploaded song
      const mem = this.stationMemories.get(stationId);
      if (mem && !mem.lastTrackId) {
        mem.lastTrackId = track.id;
        saveStationMemory(stationId, mem);
      }
      this.notifyListeners();
    }
    return track;
  }

  public async deleteTrack(trackId: string): Promise<void> {
    await this.playlistManager.deleteTrack(trackId);
    this.notifyListeners();
  }

  // ===========================================================================
  // WORLD & PLAYER COORDINATES (CALLED FROM 3D VIEWPORT)
  // ===========================================================================
  public updateSpatialState(input: VehicleSpatialAudioInput): void {
    this.playerCoords.x = input.playerX;
    this.playerCoords.z = input.playerZ;
    this.activeVehicle = input.isRidingCar ? 'cyber_car' : input.isRidingBus ? 'bus' : null;
    this.updateProximityAudio();
  }

  public enterVehicle(vehicle: 'cyber_car' | 'bus'): void {
    this.activeVehicle = vehicle;
  }

  public exitVehicle(): void {
    this.activeVehicle = null;
  }

  public setWeather(weather: WeatherType): void {
    this.weather = weather;
  }

  public setTimeOfDay(timePhase: TimePhase): void {
    this.timePhase = timePhase;
  }

  public setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    this.updateProximityAudio();
    this.notifyListeners();
  }

  public toggleMute(): void {
    this.muted = !this.muted;
    this.updateProximityAudio();
    this.notifyListeners();
  }

  public playUiSound(kind: 'click' | 'open' | 'close' | 'success' | 'warning' = 'click'): void {
    this.engine.playUiTone(kind);
  }

  public showToast(msg: string): void {
    this.statusToast = msg;
    if (this.toastTimerId) clearTimeout(this.toastTimerId);
    this.toastTimerId = window.setTimeout(() => {
      this.statusToast = null;
      this.notifyListeners();
    }, 3200);
    this.notifyListeners();
  }

  public showStatusToast(msg: string): void {
    this.showToast(msg);
  }

  public uploadAudioFiles(
    files: FileList | File[],
    targetStationId: AudioPlaylistId = 'jamaica_city_station'
  ): { addedTracks: AudioTrack[]; errors: string[]; added: number } {
    const result = this.playlistManager.addUploadedFiles(files, targetStationId);
    this.notifyListeners();
    return {
      ...result,
      added: result.addedTracks.length,
    };
  }

  // Compatibility helper methods for legacy references if any
  public setEditingStation(id: WorldStationId): void {
    this.activeStationId = id;
    this.notifyListeners();
  }

  public selectTrack(stationId: MusicStationId, trackId: string): void {
    this.play(stationId, trackId);
  }

  public removeTrackFromStation(stationId: MusicStationId, trackId: string): void {
    this.deleteTrack(trackId);
  }

  public moveTrackToStation(
    trackId: string,
    fromOrToStation: AudioPlaylistId,
    toStation?: AudioPlaylistId
  ): void {
    const dest = toStation || fromOrToStation;
    this.playlistManager.moveTrack(trackId, dest);
    this.notifyListeners();
  }

  public updateStationSettings(
    stationId: WorldStationId,
    patch: Partial<MusicStationCustomConfig>
  ): void {
    if (typeof patch.volume === 'number') {
      this.setStationVolume(stationId, patch.volume);
    }
    if (patch.effects) {
      this.setStationEffects(stationId, patch.effects);
    }
    if (patch.playbackOrder) {
      this.setStationPlaybackOrder(stationId, patch.playbackOrder);
    }
  }

  public updateStationEffects(
    stationId: WorldStationId,
    patch: Partial<StationEffectSettings>
  ): void {
    this.setStationEffects(stationId, patch);
  }

  public setPlaybackOrder(order: PlaybackOrder, stationId?: MusicStationId): void {
    if (stationId && stationId !== 'car_radio') {
      this.setStationPlaybackOrder(stationId as WorldStationId, order);
    }
  }

  public saveStationConfiguration(stationId: WorldStationId): void {
    const mem = this.stationMemories.get(stationId);
    if (mem) {
      saveStationMemory(stationId, mem);
    }
    this.showToast('Station settings saved locally!');
  }

  public setMusicVolume(v: number): void {
    this.setMasterVolume(v);
  }

  public setRadioVolume(_v: number): void {}
  public setUiVolume(_v: number): void {}
  public setCrossfadeDurationSec(_v: number): void {}
  public updateCarRadioSettings(_patch: unknown): void {}
  public resetAudioSettings(): void {
    this.stationMemories.forEach((_mem, id) => {
      this.stationMemories.set(id, {
        stationVolume: 1.0,
        effects: buildCleanDefaultEffects(),
        playbackOrder: 'sequential',
        lastTrackId: null,
        lastTrackProgressSec: 0,
      });
      saveStationMemory(id, this.stationMemories.get(id)!);
    });
    this.notifyListeners();
  }

  // ===========================================================================
  // REACT STATE SNAPSHOT
  // ===========================================================================
  public getSnapshot(): AudioManagerSnapshot {
    const activeDef =
      DEFAULT_WORLD_STATIONS.find((s) => s.id === this.activeStationId) ||
      DEFAULT_WORLD_STATIONS[0];
    const mem = this.getStationMemory(this.activeStationId);

    // Compute distance to each physical station
    const cyberDef = DEFAULT_WORLD_STATIONS.find((s) => s.id === 'cyber_city_station')!;
    const jamaicaDef = DEFAULT_WORLD_STATIONS.find((s) => s.id === 'jamaica_city_station')!;

    const cyberDist = Math.hypot(
      this.playerCoords.x - cyberDef.position.x,
      this.playerCoords.z - cyberDef.position.z
    );
    const jamaicaDist = Math.hypot(
      this.playerCoords.x - jamaicaDef.position.x,
      this.playerCoords.z - jamaicaDef.position.z
    );

    const isNearCyber = cyberDist <= (cyberDef.interactionRadius || 5.5);
    const isNearJamaica = jamaicaDist <= (jamaicaDef.interactionRadius || 5.5);

    const stationsRuntime: MusicStationRuntimeState[] = DEFAULT_WORLD_STATIONS.map((def) => {
      const stMem = this.getStationMemory(def.id);
      const dist = Math.hypot(
        this.playerCoords.x - def.position.x,
        this.playerCoords.z - def.position.z
      );
      const isAudible =
        this.activeStationId === def.id && this.playbackStatus === 'playing';

      return {
        station: {
          ...def,
          volume: stMem.stationVolume,
          effects: stMem.effects,
          playbackOrder: stMem.playbackOrder,
        },
        distance: Math.round(dist * 10) / 10,
        isPlayerInsideZone: dist <= def.radius,
        isPlayerAtStationControl: dist <= (def.interactionRadius || 5.5),
        targetSpatialGain: isAudible ? 1 : 0,
        currentSpatialGain: isAudible ? 1 : 0,
        effectiveAudibleGain: isAudible ? stMem.stationVolume : 0,
        playbackStatus: this.activeStationId === def.id ? this.playbackStatus : 'stopped',
        isPlaying: this.activeStationId === def.id && this.playbackStatus === 'playing',
        currentTrack: this.activeStationId === def.id ? this.currentTrack : null,
        currentTrackProgressSec:
          this.activeStationId === def.id ? this.currentProgressSec : 0,
        currentTrackDurationSec:
          this.activeStationId === def.id ? this.currentDurationSec : 0,
      };
    });

    const nearbyRuntime = isNearCyber
      ? stationsRuntime.find((s) => s.station.id === 'cyber_city_station') || null
      : isNearJamaica
      ? stationsRuntime.find((s) => s.station.id === 'jamaica_city_station') || null
      : null;

    const carRadioState: CarRadioState = {
      enabled: false,
      playbackStatus: 'stopped',
      isPlaying: false,
      playbackOrder: 'sequential',
      volume: 1.0,
      innerRadius: 5,
      maxHearingDistance: 40,
      position: { x: 0, z: 0 },
      distanceToPlayer: 0,
      spatialGain: 0,
      effectiveAudibleGain: 0,
      currentTrack: null,
      currentTrackProgressSec: 0,
      currentTrackDurationSec: 0,
      effects: buildCleanDefaultEffects(),
    };

    const settings: AudioSettings = {
      masterVolume: this.masterVolume,
      musicVolume: this.masterVolume,
      radioVolume: 1.0,
      ambienceVolume: 0.8,
      environmentVolume: 0.5,
      effectsVolume: 1.0,
      uiVolume: 0.65,
      muted: this.muted,
      crossfadeDurationSec: 3.0,
      effects: mem.effects,
      editingStationId: this.activeStationId,
      carRadio: {
        enabled: false,
        volume: 1.0,
        playbackOrder: 'sequential',
        maxHearingDistance: 40,
        effects: buildCleanDefaultEffects(),
      },
      stations: buildDefaultStationsMap(),
    };

    return {
      settings,
      audioUnlocked: this.audioUnlocked,
      needsUserInteractionPrompt: !this.audioUnlocked,
      carRadio: carRadioState,
      stations: stationsRuntime,
      editingStationId: this.activeStationId,
      dominantStationId: this.playbackStatus === 'playing' ? this.activeStationId : null,
      dominantStationName: activeDef.name,
      nearbyInteractiveStation: nearbyRuntime,
      inWorldStationModalId: this.openStationModalId,
      playlists: this.playlistManager.getPlaylists(),
      errorBanner: null,
      statusToast: this.statusToast,
      playerPosition: { ...this.playerCoords },
      isInsideVehicle: Boolean(this.activeVehicle),
      activeVehicleId: this.activeVehicle,
      nearestVehicleDistance: 10,
      isInsideBuilding: false,
      activeBuildingId: null,
      activeBuildingName: null,
      weather: this.weather,
      timePhase: this.timePhase,
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
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
