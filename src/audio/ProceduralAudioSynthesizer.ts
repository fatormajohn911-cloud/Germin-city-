import { StationEffectSettings } from './AudioTypes';

interface SpatialChannelNodes {
  sourceNode: MediaElementAudioSourceNode;
  pannerNode: PannerNode;
  filterNode: BiquadFilterNode;
  dryGainNode: GainNode;
  wetSendGainNode: GainNode;
  channelGainNode: GainNode;
}

/**
 * Realistic Open-World 3D Spatial Web Audio Engine
 *
 * Implements the exact required architecture:
 * AudioContext (with AudioListener at Player position & orientation)
 *   ↓
 * Audio Source (Car Radio or World Station HTMLAudioElement)
 *   ↓
 * Spatial PannerNode (Vehicle live world coords OR Station fixed world coords)
 *   ↓
 * Optional Effect Chain (Slow speed, Low-pass Filter, Subtle Stable Convolver Reverb — all OFF by default)
 *   ↓
 * Zone / Vehicle Spatial GainNode
 *   ↓
 * Master GainNode
 *   ↓
 * Destination
 */
export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private sharedConvolverNode: ConvolverNode | null = null;
  private reverbReturnGainNode: GainNode | null = null;
  private channels = new WeakMap<HTMLAudioElement, SpatialChannelNodes>();
  private hasWebAudioError = false;

  private ensureContext(): AudioContext | null {
    if (this.hasWebAudioError || typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        this.ctx = new AudioCtx();
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.value = 1.0;
        this.masterGainNode.connect(this.ctx.destination);

        // Create ONE shared, stable stereo reverb convolver once and reuse forever
        this.sharedConvolverNode = this.ctx.createConvolver();
        this.sharedConvolverNode.buffer = this.createStableImpulseBuffer(
          this.ctx,
          2.1
        );

        this.reverbReturnGainNode = this.ctx.createGain();
        this.reverbReturnGainNode.gain.value = 1.0;

        this.sharedConvolverNode.connect(this.reverbReturnGainNode);
        this.reverbReturnGainNode.connect(this.masterGainNode);
      } catch {
        this.hasWebAudioError = true;
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAndResume(): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx.state === 'running';
  }

  private createStableImpulseBuffer(
    ctx: AudioContext,
    durationSec: number
  ): AudioBuffer {
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
      const env = attack * Math.pow(1 - norm, 2.5);
      const rawL = (Math.random() * 2 - 1) * env * 0.28;
      const rawR = (Math.random() * 2 - 1) * env * 0.28;
      // Warm low-pass damping so reverb never sounds harsh or metallic
      lpL = lpL * 0.76 + rawL * 0.24;
      lpR = lpR * 0.76 + rawR * 0.24;
      left[i] = lpL;
      right[i] = lpR;
    }
    return impulse;
  }

  /**
   * Updates the 3D AudioListener position and forward orientation from the Player's
   * world coordinates and movement direction.
   */
  public updateListenerTransform(
    playerX: number,
    playerY: number,
    playerZ: number,
    forwardX: number,
    forwardY: number,
    forwardZ: number
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;

    try {
      if ('positionX' in listener && listener.positionX) {
        listener.positionX.setTargetAtTime(playerX, now, 0.04);
        listener.positionY.setTargetAtTime(playerY, now, 0.04);
        listener.positionZ.setTargetAtTime(playerZ, now, 0.04);
      } else if ('setPosition' in listener) {
        (
          listener as unknown as {
            setPosition: (x: number, y: number, z: number) => void;
          }
        ).setPosition(playerX, playerY, playerZ);
      }

      if ('forwardX' in listener && listener.forwardX) {
        listener.forwardX.setTargetAtTime(forwardX, now, 0.05);
        listener.forwardY.setTargetAtTime(forwardY, now, 0.05);
        listener.forwardZ.setTargetAtTime(forwardZ, now, 0.05);
        listener.upX.setTargetAtTime(0, now, 0.05);
        listener.upY.setTargetAtTime(1, now, 0.05);
        listener.upZ.setTargetAtTime(0, now, 0.05);
      } else if ('setOrientation' in listener) {
        (
          listener as unknown as {
            setOrientation: (
              fx: number,
              fy: number,
              fz: number,
              ux: number,
              uy: number,
              uz: number
            ) => void;
          }
        ).setOrientation(forwardX, forwardY, forwardZ, 0, 1, 0);
      }
    } catch {
      // Ignore browser-specific AudioListener quirks
    }
  }

  public updateMasterGain(masterVol: number, muted: boolean): void {
    if (!this.ctx || !this.masterGainNode || this.ctx.state !== 'running') return;
    const target = muted ? 0 : Math.max(0, Math.min(1, masterVol));
    this.masterGainNode.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  /**
   * Lazily attaches a spatial PannerNode + Effect Chain + Channel GainNode to an HTMLAudioElement
   * once and reuses it forever.
   */
  private getOrCreateSpatialChannel(
    audioEl: HTMLAudioElement
  ): SpatialChannelNodes | null {
    const existing = this.channels.get(audioEl);
    if (existing) return existing;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGainNode || !this.sharedConvolverNode) return null;

    try {
      const sourceNode = ctx.createMediaElementSource(audioEl);

      // 3D Spatial PannerNode positioned in world space.
      // rolloffFactor = 0 so PannerNode handles realistic 3D left/right/front/back directional panning
      // while our channelGainNode applies the exact Inner Radius / Fade Distance / Crossfade curve.
      const pannerNode = ctx.createPanner();
      pannerNode.panningModel = 'equalpower';
      pannerNode.distanceModel = 'linear';
      pannerNode.refDistance = 1;
      pannerNode.maxDistance = 10000;
      pannerNode.rolloffFactor = 0;

      // Optional Low-Pass Filter (20,000 Hz flat by default when Filter = OFF)
      const filterNode = ctx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 20000;
      filterNode.Q.value = 0.0001;

      const dryGainNode = ctx.createGain();
      dryGainNode.gain.value = 1.0;

      const wetSendGainNode = ctx.createGain();
      wetSendGainNode.gain.value = 0.0;

      const channelGainNode = ctx.createGain();
      channelGainNode.gain.value = 1.0;

      // Graph:
      // sourceNode -> pannerNode -> filterNode -> dryGainNode -> channelGainNode -> masterGainNode -> destination
      //                                        -> wetSendGainNode -> channelGainNode (wet path) -> sharedConvolver
      sourceNode.connect(pannerNode);
      pannerNode.connect(filterNode);

      filterNode.connect(dryGainNode);
      dryGainNode.connect(channelGainNode);

      filterNode.connect(wetSendGainNode);
      // Scale wet reverb send by the channel's spatial gain so distant silent stations never bleed into reverb!
      const wetSpatialGain = ctx.createGain();
      wetSpatialGain.gain.value = 1.0;
      wetSendGainNode.connect(wetSpatialGain);
      wetSpatialGain.connect(this.sharedConvolverNode);

      // Keep wetSendGainNode reference pointing to the combined send
      channelGainNode.connect(this.masterGainNode);

      const nodes: SpatialChannelNodes = {
        sourceNode,
        pannerNode,
        filterNode,
        dryGainNode,
        wetSendGainNode,
        channelGainNode,
      };
      this.channels.set(audioEl, nodes);
      return nodes;
    } catch {
      return null;
    }
  }

  /**
   * Updates a spatial audio channel (Car Radio or World Station):
   * - 3D World Position (x, y, z)
   * - Effective Audible Gain (includes spatial distance attenuation, crossfade, station/radio volume, ducking)
   * - Optional Effects (Slow speed, Reverb, Filter — clean original audio when OFF)
   */
  public updateSpatialChannel(params: {
    audioEl: HTMLAudioElement;
    worldX: number;
    worldY: number;
    worldZ: number;
    effectiveChannelGain: number; // 0..1 (before masterVolume)
    masterVolume: number;         // 0..1
    muted: boolean;
    effects: StationEffectSettings;
    effectsBusVolume: number;     // 0..1
  }): void {
    const {
      audioEl,
      worldX,
      worldY,
      worldZ,
      effectiveChannelGain,
      masterVolume,
      muted,
      effects,
      effectsBusVolume,
    } = params;

    // 1. Playback Speed (Slow effect) — applied smoothly without restarting the song
    const targetSpeed =
      effects.slowEnabled && effects.playbackSpeed !== 1.0
        ? Math.max(0.75, Math.min(1.25, effects.playbackSpeed))
        : 1.0;

    try {
      if (Math.abs(audioEl.playbackRate - targetSpeed) > 0.005) {
        audioEl.playbackRate = targetSpeed;
      }
      if (Math.abs(audioEl.defaultPlaybackRate - targetSpeed) > 0.005) {
        audioEl.defaultPlaybackRate = targetSpeed;
      }
    } catch {
      audioEl.playbackRate = 1.0;
    }

    const finalAudibleGain = muted
      ? 0
      : Math.max(0, Math.min(1, effectiveChannelGain * masterVolume));

    // Only instantiate Web Audio nodes if the element is actually playing or has a source loaded
    if (audioEl.paused && finalAudibleGain <= 0.001) {
      if (Math.abs(audioEl.volume - finalAudibleGain) > 0.005) {
        audioEl.volume = finalAudibleGain;
      }
      return;
    }

    const nodes = this.getOrCreateSpatialChannel(audioEl);
    if (!nodes || !this.ctx || this.ctx.state !== 'running') {
      // Clean fallback if Web Audio context is not yet running: control volume directly on HTMLAudioElement
      if (Math.abs(audioEl.volume - finalAudibleGain) > 0.004) {
        audioEl.volume = finalAudibleGain;
      }
      return;
    }

    // Keep native element volume at 1.0 so Web Audio GainNodes control spatial volume smoothly
    if (Math.abs(audioEl.volume - 1.0) > 0.01) {
      audioEl.volume = 1.0;
    }

    const now = this.ctx.currentTime;

    // 2. Update 3D Spatial Panner Position (Vehicle or Station world coordinates)
    try {
      if ('positionX' in nodes.pannerNode && nodes.pannerNode.positionX) {
        nodes.pannerNode.positionX.setTargetAtTime(worldX, now, 0.05);
        nodes.pannerNode.positionY.setTargetAtTime(worldY, now, 0.05);
        nodes.pannerNode.positionZ.setTargetAtTime(worldZ, now, 0.05);
      } else if ('setPosition' in nodes.pannerNode) {
        (
          nodes.pannerNode as unknown as {
            setPosition: (x: number, y: number, z: number) => void;
          }
        ).setPosition(worldX, worldY, worldZ);
      }
    } catch {
      // ignore
    }

    // 3. Update Optional Low-Pass Filter (OFF = 20,000 Hz clean)
    const wantFilter = effects.filterEnabled && effects.filterAmount > 0.01;
    if (wantFilter) {
      const amt = Math.max(0, Math.min(1, effects.filterAmount));
      const cutoffHz = Math.round(18000 * Math.pow(800 / 18000, amt));
      nodes.filterNode.frequency.setTargetAtTime(cutoffHz, now, 0.06);
    } else {
      nodes.filterNode.frequency.setTargetAtTime(20000, now, 0.06);
    }

    // 4. Update Spatial & Channel Gain + Optional Reverb Send
    const clampedChannelGain = muted
      ? 0
      : Math.max(0, Math.min(1, effectiveChannelGain));
    nodes.channelGainNode.gain.setTargetAtTime(clampedChannelGain, now, 0.05);

    const wantReverb =
      effects.reverbEnabled &&
      effects.reverbAmount > 0.01 &&
      effectsBusVolume > 0.01 &&
      clampedChannelGain > 0.002;

    if (wantReverb) {
      const wetLevel =
        Math.max(0, Math.min(0.65, effects.reverbAmount * effectsBusVolume * 0.65)) *
        clampedChannelGain;
      nodes.dryGainNode.gain.setTargetAtTime(1.0, now, 0.06);
      nodes.wetSendGainNode.gain.setTargetAtTime(wetLevel, now, 0.06);
    } else {
      nodes.dryGainNode.gain.setTargetAtTime(1.0, now, 0.05);
      nodes.wetSendGainNode.gain.setTargetAtTime(0.0, now, 0.05);
    }
  }

  public playUiTone(
    kind: 'click' | 'open' | 'close' | 'success' | 'warning' = 'click',
    uiGain: number
  ): void {
    if (uiGain <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      if (kind === 'open') {
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
      } else if (kind === 'close') {
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.07);
      } else if (kind === 'success') {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
      } else if (kind === 'warning') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(260, now + 0.06);
      } else {
        osc.frequency.setValueAtTime(640, now);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.min(0.09, uiGain * 0.07), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore
    }
  }
}
