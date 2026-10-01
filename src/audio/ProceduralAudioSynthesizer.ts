import {
  AudioTrack,
  ZoneEnvironmentProfile,
} from './AudioTypes';
import { TimePhase, WeatherType } from '../types/game';

/**
 * Generates a valid 16-bit PCM WAV Blob URL from a procedural musical arrangement
 * so that built-in Car Radio and World Ambience tracks play through standard HTMLAudioElement
 * pipelines identically to user-uploaded .mp3 / .wav / .ogg / .m4a files.
 */
function encodeStereoWavBlobUrl(
  durationSec: number,
  sampleRate: number,
  renderSample: (t: number) => [number, number]
): string {
  const numSamples = Math.floor(durationSec * sampleRate);
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const fadeEdgeSec = Math.min(1.5, durationSec * 0.1);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let env = 1.0;
    if (t < fadeEdgeSec) {
      env = t / fadeEdgeSec;
    } else if (t > durationSec - fadeEdgeSec) {
      env = Math.max(0, (durationSec - t) / fadeEdgeSec);
    }

    const [leftRaw, rightRaw] = renderSample(t);
    const l = Math.max(-1, Math.min(1, leftRaw * env));
    const r = Math.max(-1, Math.min(1, rightRaw * env));

    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

let cachedDefaultRadioTracks: AudioTrack[] | null = null;
let cachedDefaultAmbientTracks: AudioTrack[] | null = null;

export function getBuiltInRadioTracks(): AudioTrack[] {
  if (cachedDefaultRadioTracks) return cachedDefaultRadioTracks;
  const sampleRate = 22050;

  // Song 1: Neon Horizon Synthwave Cruise (Upbeat melodic synth arpeggio + warm bassline)
  const song1Url = encodeStereoWavBlobUrl(24, sampleRate, (t) => {
    const bpm = 116;
    const beat = (t * bpm) / 60;
    const bar = Math.floor(beat / 4) % 4;
    const chords = [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [130.81, 164.81, 196.0], // C
      [196.0, 246.94, 293.66], // G
    ];
    const chord = chords[bar];
    const step = Math.floor(beat * 2) % 3;
    const arpFreq = chord[step] * 2;
    const stepFrac = (beat * 2) % 1;
    const arpEnv = Math.exp(-stepFrac * 4.2);

    // Kick & warm synth bass
    const beatFrac = beat % 1;
    const kickFreq = 52 + 95 * Math.exp(-beatFrac * 18);
    const kick = Math.sin(2 * Math.PI * kickFreq * beatFrac) * Math.exp(-beatFrac * 6.5) * 0.35;
    const bass =
      Math.tanh(Math.sin(2 * Math.PI * (chord[0] * 0.5) * t) * 1.8) *
      (0.22 + 0.1 * Math.sin(2 * Math.PI * beat));

    // Lush stereo pad
    const padL =
      (Math.sin(2 * Math.PI * chord[0] * t) +
        Math.sin(2 * Math.PI * chord[1] * 1.002 * t) +
        Math.sin(2 * Math.PI * chord[2] * t)) *
      0.09;
    const padR =
      (Math.sin(2 * Math.PI * chord[0] * 0.998 * t) +
        Math.sin(2 * Math.PI * chord[1] * t) +
        Math.sin(2 * Math.PI * chord[2] * 1.003 * t)) *
      0.09;

    const lead = Math.sin(2 * Math.PI * arpFreq * t) * arpEnv * 0.2;
    return [kick + bass + padL + lead * 0.9, kick + bass + padR + lead * 1.1];
  });

  // Song 2: Sunbeam Café Lo-Fi Groove (Warm electric piano chords + mellow rhythm)
  const song2Url = encodeStereoWavBlobUrl(26, sampleRate, (t) => {
    const bpm = 86;
    const beat = (t * bpm) / 60;
    const bar = Math.floor(beat / 4) % 4;
    const chords = [
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
      [220.0, 261.63, 329.63, 392.0],  // Am7
    ];
    const c = chords[bar];
    const barFrac = (beat % 4) / 4;
    const rhodesEnv = Math.exp(-barFrac * 2.2);
    const tremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 4.5 * t);

    let ep = 0;
    for (let i = 0; i < c.length; i++) {
      ep += Math.sin(2 * Math.PI * c[i] * t + 0.3 * Math.sin(2 * Math.PI * c[i] * 2 * t));
    }
    ep = (ep / 4) * rhodesEnv * 0.32;

    const subBass = Math.sin(2 * Math.PI * (c[0] * 0.5) * t) * 0.24;
    const melodyStep = Math.floor(beat) % 4;
    const melEnv = Math.exp(-((beat % 1) * 3.5));
    const mel = Math.sin(2 * Math.PI * (c[melodyStep] * 2) * t) * melEnv * 0.14;

    return [
      ep * tremolo + subBass + mel * 0.8,
      ep * (1.6 - tremolo) + subBass + mel * 1.1,
    ];
  });

  // Song 3: Golden Bridge Midnight Drive (Driving electro-cruiser pulse)
  const song3Url = encodeStereoWavBlobUrl(24, sampleRate, (t) => {
    const bpm = 124;
    const beat = (t * bpm) / 60;
    const bar = Math.floor(beat / 4) % 4;
    const roots = [164.81, 130.81, 146.83, 123.47]; // Em - C - D - Bm
    const root = roots[bar];

    const sixteenth = (beat * 4) % 1;
    const pulseEnv = Math.exp(-sixteenth * 5.0);
    const bassFreq = root * ((Math.floor(beat * 4) % 2 === 0) ? 0.5 : 1.0);
    const bass = Math.tanh(Math.sin(2 * Math.PI * bassFreq * t) * 2.2) * pulseEnv * 0.28;

    const arpIntervals = [1, 1.2, 1.5, 2, 1.5, 1.2, 2, 2.4];
    const arpIdx = Math.floor(beat * 2) % arpIntervals.length;
    const arpFreq = root * 2 * arpIntervals[arpIdx];
    const arpEnv = Math.exp(-((beat * 2) % 1) * 3.8);
    const arp = Math.sin(2 * Math.PI * arpFreq * t) * arpEnv * 0.22;

    const shimmer =
      Math.sin(2 * Math.PI * root * 1.5 * t) * 0.12 +
      Math.sin(2 * Math.PI * root * 2.002 * t) * 0.08;

    return [bass + arp + shimmer, bass + arp * 0.9 + shimmer * 1.1];
  });

  // Song 4: Starlight Coastline Horizon (Melodic tropical & coastal chill)
  const song4Url = encodeStereoWavBlobUrl(25, sampleRate, (t) => {
    const bpm = 102;
    const beat = (t * bpm) / 60;
    const bar = Math.floor(beat / 4) % 4;
    const chords = [
      [174.61, 220.0, 261.63], // F
      [196.0, 246.94, 293.66], // G
      [164.81, 196.0, 246.94], // Em
      [220.0, 261.63, 329.63], // Am
    ];
    const c = chords[bar];
    const pluckIdx = Math.floor(beat * 2) % 3;
    const pluckFrac = (beat * 2) % 1;
    const pluckEnv = Math.exp(-pluckFrac * 5.2);
    const pluck =
      (Math.sin(2 * Math.PI * c[pluckIdx] * 2 * t) +
        0.5 * Math.sin(2 * Math.PI * c[pluckIdx] * 4 * t)) *
      pluckEnv *
      0.2;

    const pad =
      (Math.sin(2 * Math.PI * c[0] * t) +
        Math.sin(2 * Math.PI * c[1] * t) +
        Math.sin(2 * Math.PI * c[2] * t)) *
      0.1;
    const warmBass = Math.sin(2 * Math.PI * (c[0] * 0.5) * t) * 0.24;

    return [pad + warmBass + pluck * 1.05, pad + warmBass + pluck * 0.95];
  });

  cachedDefaultRadioTracks = [
    {
      id: 'radio_builtin_1',
      title: 'Song 1 — Neon Horizon Synthwave',
      artist: 'Gemini City FM 104.9',
      url: song1Url,
      isUserUpload: false,
      isBuiltIn: true,
      playlistId: 'car_radio',
      durationSec: 24,
      addedAt: Date.now() - 4000,
    },
    {
      id: 'radio_builtin_2',
      title: 'Song 2 — Sunbeam Café Lo-Fi Groove',
      artist: 'Ephraim’s Roastery Sessions',
      url: song2Url,
      isUserUpload: false,
      isBuiltIn: true,
      playlistId: 'car_radio',
      durationSec: 26,
      addedAt: Date.now() - 3000,
    },
    {
      id: 'radio_builtin_3',
      title: 'Song 3 — Golden Bridge Midnight Drive',
      artist: 'Cyber-Valkyrie GT Audio',
      url: song3Url,
      isUserUpload: false,
      isBuiltIn: true,
      playlistId: 'car_radio',
      durationSec: 24,
      addedAt: Date.now() - 2000,
    },
    {
      id: 'radio_builtin_4',
      title: 'Song 4 — Starlight Coastline Cruise',
      artist: 'Harbor Pier Waves',
      url: song4Url,
      isUserUpload: false,
      isBuiltIn: true,
      playlistId: 'car_radio',
      durationSec: 25,
      addedAt: Date.now() - 1000,
    },
  ];

  return cachedDefaultRadioTracks;
}

export function getBuiltInAmbientTracks(): AudioTrack[] {
  if (cachedDefaultAmbientTracks) return cachedDefaultAmbientTracks;
  const sampleRate = 22050;

  // Ambient 1: Emerald Island Breeze (Ethereal open-world piano & warm wind pad)
  const amb1Url = encodeStereoWavBlobUrl(28, sampleRate, (t) => {
    const pad1 = Math.sin(2 * Math.PI * 130.81 * t) * (0.5 + 0.5 * Math.sin(t * 0.35)) * 0.14;
    const pad2 = Math.sin(2 * Math.PI * 196.0 * t) * (0.5 + 0.5 * Math.cos(t * 0.28)) * 0.12;
    const pad3 = Math.sin(2 * Math.PI * 246.94 * t) * (0.5 + 0.5 * Math.sin(t * 0.22 + 1)) * 0.1;
    const bellNotes = [523.25, 659.25, 783.99, 587.33, 493.88];
    const noteIdx = Math.floor(t / 3.5) % bellNotes.length;
    const noteFrac = (t % 3.5) / 3.5;
    const bell =
      Math.sin(2 * Math.PI * bellNotes[noteIdx] * t) * Math.exp(-noteFrac * 4.5) * 0.14;
    return [pad1 + pad2 + bell, pad1 + pad3 + bell * 0.9];
  });

  // Ambient 2: Twilight Over Silverbrook (Warm acoustic fifths & serene reflection)
  const amb2Url = encodeStereoWavBlobUrl(30, sampleRate, (t) => {
    const padA = Math.sin(2 * Math.PI * 146.83 * t) * 0.13;
    const padB = Math.sin(2 * Math.PI * 220.0 * t) * (0.6 + 0.4 * Math.sin(t * 0.4)) * 0.12;
    const padC = Math.sin(2 * Math.PI * 261.63 * t) * (0.6 + 0.4 * Math.cos(t * 0.3)) * 0.1;
    const chimeNotes = [440.0, 523.25, 659.25, 587.33];
    const cIdx = Math.floor(t / 4.0) % chimeNotes.length;
    const cFrac = (t % 4.0) / 4.0;
    const chime =
      Math.sin(2 * Math.PI * chimeNotes[cIdx] * t) * Math.exp(-cFrac * 4.0) * 0.13;
    return [padA + padB + chime * 0.9, padA + padC + chime * 1.05];
  });

  // Ambient 3: Astral Sanctuary Drift (Celestial harmonic textures)
  const amb3Url = encodeStereoWavBlobUrl(26, sampleRate, (t) => {
    const droneL =
      Math.sin(2 * Math.PI * 110.0 * t) * 0.13 +
      Math.sin(2 * Math.PI * 164.81 * t) * (0.5 + 0.5 * Math.sin(t * 0.25)) * 0.12;
    const droneR =
      Math.sin(2 * Math.PI * 110.2 * t) * 0.13 +
      Math.sin(2 * Math.PI * 220.0 * t) * (0.5 + 0.5 * Math.cos(t * 0.3)) * 0.11;
    const crystalNotes = [659.25, 783.99, 987.77, 523.25];
    const nIdx = Math.floor(t / 4.2) % crystalNotes.length;
    const nFrac = (t % 4.2) / 4.2;
    const crystal =
      Math.sin(2 * Math.PI * crystalNotes[nIdx] * t) * Math.exp(-nFrac * 5.0) * 0.11;
    return [droneL + crystal, droneR + crystal];
  });

  cachedDefaultAmbientTracks = [
    {
      id: 'amb_builtin_1',
      title: 'Emerald Island Breeze',
      artist: 'Gemini City World Ambience',
      url: amb1Url,
      isUserUpload: false,
      isBuiltIn: true,
      playlistId: 'world_ambience',
      durationSec: 28,
      addedAt: Date.now() - 3000,
    },
    {
      id: 'amb_builtin_2',
      title: 'Twilight Over Silverbrook',
      artist: 'Gemini City World Ambience',
      url: amb2Url,
      isUserUpload: false,
      isBuiltIn: true,
      playlistId: 'world_ambience',
      durationSec: 30,
      addedAt: Date.now() - 2000,
    },
    {
      id: 'amb_builtin_3',
      title: 'Astral Sanctuary Drift',
      artist: 'Neo-Horizon Atmosphere',
      url: amb3Url,
      isUserUpload: false,
      isBuiltIn: true,
      playlistId: 'world_ambience',
      durationSec: 26,
      addedAt: Date.now() - 1000,
    },
  ];

  return cachedDefaultAmbientTracks;
}

/**
 * Real-time Web Audio API Environmental, Weather, Time-of-Day & UI Sound Synthesizer.
 * Uses a single shared noise buffer + lightweight filter nodes to avoid creating unnecessary Audio objects.
 */
export class ProceduralEnvironmentEngine {
  private ctx: AudioContext | null = null;
  private masterEnvGain: GainNode | null = null;
  private weatherRainGain: GainNode | null = null;
  private weatherWindGain: GainNode | null = null;
  private zoneFilterNode: BiquadFilterNode | null = null;
  private zoneGainNode: GainNode | null = null;
  private zoneDroneOsc: OscillatorNode | null = null;
  private zoneDroneGain: GainNode | null = null;
  private chirpIntervalId: number | null = null;

  private currentWeather: WeatherType = 'sunny';
  private currentTimePhase: TimePhase = 'Morning';
  private currentZoneProfile: ZoneEnvironmentProfile | null = null;
  private currentEnvBusGain = 0;
  private currentZoneMixGain = 0;

  public initOrResume(): boolean {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        this.buildGraph();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  public isRunning(): boolean {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  private buildGraph(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.masterEnvGain = ctx.createGain();
    this.masterEnvGain.gain.value = 0;
    this.masterEnvGain.connect(ctx.destination);

    // Create 4-second looping pink/white noise buffer for rain, wind, fountain water, ocean waves & cafe murmur
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    // 1. Weather Rain Layer (Bandpass ~1100Hz)
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1150;
    rainFilter.Q.value = 0.75;
    this.weatherRainGain = ctx.createGain();
    this.weatherRainGain.gain.value = 0;
    rainSource.connect(rainFilter);
    rainFilter.connect(this.weatherRainGain);
    this.weatherRainGain.connect(this.masterEnvGain);
    rainSource.start();

    // 2. Weather & Time-of-Day Wind / City Breeze Layer (Lowpass ~340Hz)
    const windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 340;
    this.weatherWindGain = ctx.createGain();
    this.weatherWindGain.gain.value = 0.08;
    windSource.connect(windFilter);
    windFilter.connect(this.weatherWindGain);
    this.weatherWindGain.connect(this.masterEnvGain);
    windSource.start();

    // 3. Location Zone Filtered Texture Layer (Fountain water / Beach waves / Cafe / Bridge wind)
    const zoneSource = ctx.createBufferSource();
    zoneSource.buffer = noiseBuffer;
    zoneSource.loop = true;
    this.zoneFilterNode = ctx.createBiquadFilter();
    this.zoneFilterNode.type = 'bandpass';
    this.zoneFilterNode.frequency.value = 650;
    this.zoneFilterNode.Q.value = 1.2;
    this.zoneGainNode = ctx.createGain();
    this.zoneGainNode.gain.value = 0;
    zoneSource.connect(this.zoneFilterNode);
    this.zoneFilterNode.connect(this.zoneGainNode);
    this.zoneGainNode.connect(this.masterEnvGain);
    zoneSource.start();

    // 4. Subtle Harmonic Zone Drone (Sanctuary / Cyber Plaza / Cafe warmth)
    this.zoneDroneOsc = ctx.createOscillator();
    this.zoneDroneOsc.type = 'sine';
    this.zoneDroneOsc.frequency.value = 220;
    this.zoneDroneGain = ctx.createGain();
    this.zoneDroneGain.gain.value = 0;
    this.zoneDroneOsc.connect(this.zoneDroneGain);
    this.zoneDroneGain.connect(this.masterEnvGain);
    this.zoneDroneOsc.start();

    // 5. Periodic Nature / Bird / Chime Micro-Events (Morning birds, Park chirps, Sanctuary bells)
    if (this.chirpIntervalId !== null) {
      window.clearInterval(this.chirpIntervalId);
    }
    this.chirpIntervalId = window.setInterval(() => {
      this.triggerPeriodicMicroEvent();
    }, 3200);
  }

  public updateMix(params: {
    effectiveEnvGain: number; // 0..1 (includes master * environment * ducking)
    weather: WeatherType;
    timePhase: TimePhase;
    activeZoneProfile: ZoneEnvironmentProfile | null;
    activeZoneEffectiveGain: number; // 0..1
  }): void {
    this.currentWeather = params.weather;
    this.currentTimePhase = params.timePhase;
    this.currentZoneProfile = params.activeZoneProfile;
    this.currentEnvBusGain = params.effectiveEnvGain;
    this.currentZoneMixGain = params.activeZoneEffectiveGain;

    if (!this.ctx || !this.masterEnvGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    this.masterEnvGain.gain.setTargetAtTime(params.effectiveEnvGain, now, 0.25);

    // Weather targets
    const targetRain =
      params.weather === 'rainy' ? 0.52 : params.weather === 'cloudy' ? 0.04 : 0.0;
    const timeWindFactor =
      params.timePhase === 'Night'
        ? 0.06
        : params.timePhase === 'Evening'
        ? 0.09
        : params.timePhase === 'Morning'
        ? 0.11
        : 0.14;
    const targetWind =
      params.weather === 'rainy'
        ? 0.34
        : params.weather === 'cloudy'
        ? 0.22
        : timeWindFactor;

    this.weatherRainGain?.gain.setTargetAtTime(targetRain, now, 0.6);
    this.weatherWindGain?.gain.setTargetAtTime(targetWind, now, 0.6);

    // Active Location Audio Zone sculpting
    if (!params.activeZoneProfile || params.activeZoneEffectiveGain <= 0.01) {
      this.zoneGainNode?.gain.setTargetAtTime(0, now, 0.4);
      this.zoneDroneGain?.gain.setTargetAtTime(0, now, 0.4);
      return;
    }

    const zGain = params.activeZoneEffectiveGain;
    switch (params.activeZoneProfile) {
      case 'park_nature':
        this.zoneFilterNode?.frequency.setTargetAtTime(880, now, 0.3);
        this.zoneFilterNode?.Q.setTargetAtTime(1.1, now, 0.3);
        this.zoneGainNode?.gain.setTargetAtTime(zGain * 0.24, now, 0.4);
        this.zoneDroneGain?.gain.setTargetAtTime(0, now, 0.4);
        break;
      case 'beach_ocean': {
        // Rhythmic ocean wave swell
        const waveSwell = 0.55 + 0.45 * Math.sin(now * 0.95);
        this.zoneFilterNode?.frequency.setTargetAtTime(320 + waveSwell * 260, now, 0.25);
        this.zoneFilterNode?.Q.setTargetAtTime(0.8, now, 0.3);
        this.zoneGainNode?.gain.setTargetAtTime(zGain * 0.38 * waveSwell, now, 0.3);
        this.zoneDroneGain?.gain.setTargetAtTime(0, now, 0.4);
        break;
      }
      case 'cafe_restaurant':
        this.zoneFilterNode?.frequency.setTargetAtTime(520, now, 0.3);
        this.zoneFilterNode?.Q.setTargetAtTime(1.4, now, 0.3);
        this.zoneGainNode?.gain.setTargetAtTime(zGain * 0.18, now, 0.4);
        this.zoneDroneOsc?.frequency.setTargetAtTime(196.0, now, 0.3);
        this.zoneDroneGain?.gain.setTargetAtTime(zGain * 0.04, now, 0.4);
        break;
      case 'bridge_wind':
        this.zoneFilterNode?.frequency.setTargetAtTime(280, now, 0.3);
        this.zoneFilterNode?.Q.setTargetAtTime(1.8, now, 0.3);
        this.zoneGainNode?.gain.setTargetAtTime(zGain * 0.36, now, 0.4);
        this.zoneDroneOsc?.frequency.setTargetAtTime(110.0, now, 0.3);
        this.zoneDroneGain?.gain.setTargetAtTime(zGain * 0.035, now, 0.4);
        break;
      case 'cyber_market':
        this.zoneFilterNode?.frequency.setTargetAtTime(720, now, 0.3);
        this.zoneGainNode?.gain.setTargetAtTime(zGain * 0.16, now, 0.4);
        this.zoneDroneOsc?.frequency.setTargetAtTime(130.81, now, 0.3);
        this.zoneDroneGain?.gain.setTargetAtTime(zGain * 0.055, now, 0.4);
        break;
      case 'sacred_sanctuary':
        this.zoneFilterNode?.frequency.setTargetAtTime(440, now, 0.3);
        this.zoneGainNode?.gain.setTargetAtTime(zGain * 0.08, now, 0.4);
        this.zoneDroneOsc?.frequency.setTargetAtTime(261.63, now, 0.3);
        this.zoneDroneGain?.gain.setTargetAtTime(zGain * 0.065, now, 0.4);
        break;
      default:
        this.zoneFilterNode?.frequency.setTargetAtTime(480, now, 0.3);
        this.zoneGainNode?.gain.setTargetAtTime(zGain * 0.15, now, 0.4);
        this.zoneDroneGain?.gain.setTargetAtTime(0, now, 0.4);
        break;
    }
  }

  private triggerPeriodicMicroEvent(): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterEnvGain) return;
    if (this.currentEnvBusGain <= 0.02) return;

    const now = this.ctx.currentTime;

    // Morning or Park / Residential -> gentle songbird chirp
    const shouldPlayBird =
      this.currentWeather !== 'rainy' &&
      (this.currentTimePhase === 'Morning' ||
        this.currentZoneProfile === 'park_nature' ||
        this.currentZoneProfile === 'residential_calm');

    if (shouldPlayBird && Math.random() < 0.72) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 1650 + Math.random() * 650;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.18);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterEnvGain);
      osc.start(now);
      osc.stop(now + 0.24);
      return;
    }

    // Sanctuary / Temple / Evening -> soft harmonic bell chime
    if (
      this.currentZoneProfile === 'sacred_sanctuary' ||
      this.currentZoneProfile === 'cafe_restaurant'
    ) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const notes = [523.25, 659.25, 783.99, 1046.5];
      osc.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.04 * Math.max(0.3, this.currentZoneMixGain), now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.1);
      osc.connect(gain);
      gain.connect(this.masterEnvGain);
      osc.start(now);
      osc.stop(now + 1.15);
    }
  }

  public playUiTone(
    kind: 'click' | 'open' | 'close' | 'success' | 'warning',
    effectiveUiGain: number
  ): void {
    if (effectiveUiGain <= 0.01) return;
    if (!this.initOrResume() || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = kind === 'warning' ? 'triangle' : 'sine';

    if (kind === 'click') {
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.045);
      gain.gain.setValueAtTime(0.08 * effectiveUiGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (kind === 'open') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.09);
      gain.gain.setValueAtTime(0.09 * effectiveUiGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (kind === 'close') {
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(390, now + 0.08);
      gain.gain.setValueAtTime(0.08 * effectiveUiGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (kind === 'success') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.07);
      osc.frequency.setValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.1 * effectiveUiGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.setValueAtTime(240, now + 0.09);
      gain.gain.setValueAtTime(0.12 * effectiveUiGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  }
}
