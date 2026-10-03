import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Upload,
  X,
  Sparkles,
  Sliders,
  ListMusic,
  RotateCcw,
  Radio,
  Music,
  Disc3,
  Waves,
} from 'lucide-react';
import { AudioManager, useAudioManager } from '../audio/AudioManager';
import { AudioTrack, WorldStationId } from '../audio/AudioTypes';
import { buildCleanDefaultEffects } from '../audio/AudioZoneManager';

interface AudioStationHUDProps {
  stationId: WorldStationId;
  onClose: () => void;
}

export const AudioStationHUD: React.FC<AudioStationHUDProps> = ({ stationId, onClose }) => {
  const snap = useAudioManager();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'player' | 'effects'>('player');

  const isCyber = stationId === 'cyber_city_station';
  const stationName = isCyber ? 'Cyber City Audio Station' : 'Jamaica City Audio Station';
  const stationSubtitle = isCyber
    ? 'Neo-Horizon Cyber-Core Plaza · Physical Audio Console'
    : 'Central Starlight Park · Physical Listening Sanctuary';

  // Get current station runtime & memory
  const stationRuntime = snap.stations.find((s) => s.station.id === stationId);
  const playlist = snap.playlists[stationId] || { tracks: [] };
  const tracks = playlist.tracks;
  const isPlayingThisStation =
    snap.dominantStationId === stationId && stationRuntime?.isPlaying;
  const currentTrack = isPlayingThisStation ? stationRuntime?.currentTrack : null;

  const stationMem = AudioManager.getStationMemory(stationId);
  const effects = stationMem.effects;
  const stationVolume = stationMem.stationVolume;

  const formatSeconds = (sec: number): string => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await AudioManager.uploadTrackToStation(stationId, files[i]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSec = Number(e.target.value);
    AudioManager.seek(targetSec);
  };

  const progressSec = stationRuntime?.currentTrackProgressSec || 0;
  const durationSec = stationRuntime?.currentTrackDurationSec || currentTrack?.durationSec || 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-station-title"
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-3 sm:p-5"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm pointer-events-auto transition-opacity"
      />

      {/* Compact, Game-like Audio Station Window */}
      <div
        className={`relative z-10 w-full max-w-lg rounded-3xl border shadow-2xl pointer-events-auto flex flex-col overflow-hidden transition-all duration-200 ${
          isCyber
            ? 'bg-slate-950/95 border-cyan-400/40 shadow-cyan-500/10 text-slate-100'
            : 'bg-slate-950/95 border-amber-400/40 shadow-amber-500/10 text-slate-100'
        }`}
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Hidden File Input for Local Music Only */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* 1. Station Header */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
            isCyber
              ? 'bg-gradient-to-r from-cyan-950/70 via-slate-900 to-fuchsia-950/70 border-cyan-500/25'
              : 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-emerald-950/70 border-amber-500/25'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md shrink-0 ${
                isCyber
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/35'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-400/35'
              }`}
            >
              {isCyber ? '⚡' : '🌴'}
            </span>
            <div className="min-w-0">
              <h2
                id="audio-station-title"
                className="text-sm sm:text-base font-display font-extrabold tracking-wide uppercase truncate"
              >
                {stationName}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {stationSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition active:scale-95"
              title="Close Station"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Mode Navigation Tabs */}
        <div className="flex items-center px-4 sm:px-5 pt-3 border-b border-white/10 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('player')}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'player'
                ? isCyber
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Disc3
              className={`w-3.5 h-3.5 ${
                isPlayingThisStation ? 'animate-spin' : ''
              }`}
            />
            <span>Station Console & Songs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('effects')}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'effects'
                ? isCyber
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Audio Effects</span>
            {(effects.reverbEnabled ||
              effects.slowEnabled ||
              effects.echoEnabled ||
              effects.filterEnabled ||
              effects.fadeEnabled) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* 3. Modal Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {activeTab === 'player' ? (
            <>
              {/* Active Track Playing Deck */}
              <div
                className={`p-4 rounded-2xl border flex flex-col gap-3.5 transition ${
                  isCyber
                    ? 'bg-slate-900/90 border-cyan-500/20'
                    : 'bg-slate-900/90 border-amber-500/20'
                }`}
              >
                {/* Track Info Row */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border relative shadow-md ${
                      isPlayingThisStation
                        ? isCyber
                          ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                          : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                        : 'bg-slate-800 border-white/10 text-slate-400'
                    }`}
                  >
                    <Disc3
                      className={`w-6 h-6 ${
                        isPlayingThisStation ? 'animate-spin' : ''
                      }`}
                    />
                    {isPlayingThisStation && (
                      <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">
                        {currentTrack
                          ? currentTrack.title
                          : tracks.length > 0
                          ? tracks[0].title
                          : 'No song loaded'}
                      </span>
                      {currentTrack && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-white/10 text-slate-300 shrink-0">
                          {currentTrack.fileType}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {currentTrack?.artist || (isCyber ? 'Cyber City Synth Deck' : 'Jamaica Island Sound System')}
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Timestamps */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={durationSec > 0 ? durationSec : 100}
                    value={progressSec}
                    onChange={handleSeek}
                    disabled={!currentTrack}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 disabled:opacity-40"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{formatSeconds(progressSec)}</span>
                    <span>{formatSeconds(durationSec)}</span>
                  </div>
                </div>

                {/* Playback Controls Row */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        AudioManager.setStationPlaybackOrder(
                          stationId,
                          stationMem.playbackOrder === 'shuffle'
                            ? 'sequential'
                            : 'shuffle'
                        )
                      }
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                        stationMem.playbackOrder === 'shuffle'
                          ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      }`}
                      title="Toggle Shuffle vs Sequential order"
                    >
                      {stationMem.playbackOrder === 'shuffle' ? '🔀 Shuffle' : '🔁 Loop All'}
                    </button>
                  </div>

                  {/* Primary Transport Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => AudioManager.previousTrack(stationId)}
                      disabled={tracks.length <= 1}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition active:scale-95 disabled:opacity-40"
                      title="Previous Song"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => AudioManager.togglePlay(stationId)}
                      disabled={tracks.length === 0}
                      className={`p-3 rounded-2xl text-slate-950 font-bold shadow-lg transition active:scale-95 disabled:opacity-40 ${
                        isCyber
                          ? 'bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300'
                          : 'bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300'
                      }`}
                      title={isPlayingThisStation ? 'Pause Song' : 'Play Song'}
                    >
                      {isPlayingThisStation ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => AudioManager.nextTrack(stationId)}
                      disabled={tracks.length <= 1}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition active:scale-95 disabled:opacity-40"
                      title="Next Song"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Station Volume Slider */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => AudioManager.toggleMute()}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition"
                      title="Toggle Mute"
                    >
                      {snap.settings.muted || stationVolume === 0 ? (
                        <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={snap.settings.muted ? 0 : stationVolume}
                      onChange={(e) =>
                        AudioManager.setStationVolume(stationId, Number(e.target.value))
                      }
                      className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      title={`Station Volume: ${Math.round(stationVolume * 100)}%`}
                    />
                    <span className="text-[10px] font-mono text-slate-400 w-7">
                      {Math.round(stationVolume * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Local Music Library & Upload Button */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <ListMusic className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Local Music Library ({tracks.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                    title="Upload local audio files (.mp3, .wav, .ogg, .m4a)"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Upload Local Music</span>
                  </button>
                </div>

                {/* Song List */}
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {tracks.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-dashed border-white/15 text-center space-y-2">
                      <Music className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs text-slate-300 font-semibold">
                        No songs uploaded to this station yet.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Tap <strong className="text-emerald-300">+ Upload Local Music</strong> above to select MP3, WAV, or OGG tracks from your computer!
                      </p>
                    </div>
                  ) : (
                    tracks.map((track, idx) => {
                      const isCurrent =
                        currentTrack?.id === track.id && isPlayingThisStation;
                      return (
                        <div
                          key={track.id}
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition text-left ${
                            isCurrent
                              ? isCyber
                                ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                                : 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                              : 'bg-slate-900/70 hover:bg-slate-900 border-white/10 text-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => AudioManager.play(stationId, track.id)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                          >
                            <span className="w-5 font-mono text-[11px] text-slate-400 text-center shrink-0">
                              {isCurrent ? '▶' : idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">
                                {track.title}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {track.artist || 'Local Upload'} · {track.fileType}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            {track.durationSec && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {formatSeconds(track.durationSec)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => AudioManager.deleteTrack(track.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition"
                              title="Remove track"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : (
            /* 4. Advanced Audio Effects Panel */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Physical Audio Effects Console
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    All effects are optional. Default is clean natural audio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    AudioManager.setStationEffects(stationId, buildCleanDefaultEffects())
                  }
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-300 flex items-center gap-1 transition"
                  title="Reset all effects to OFF"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All OFF</span>
                </button>
              </div>

              {/* 1. REVERB */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-200">Reverb</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-slate-400">
                      {effects.reverbEnabled ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={effects.reverbEnabled}
                      onChange={(e) =>
                        AudioManager.setStationEffects(stationId, {
                          reverbEnabled: e.target.checked,
                        })
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-9 h-5 rounded-full transition relative ${
                        effects.reverbEnabled ? 'bg-sky-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${
                          effects.reverbEnabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {effects.reverbEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Amount</span>
                        <span>{Math.round(effects.reverbAmount * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={effects.reverbAmount}
                        onChange={(e) =>
                          AudioManager.setStationEffects(stationId, {
                            reverbAmount: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-sky-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Room Size</span>
                        <span>{Math.round(effects.reverbRoomSize * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={effects.reverbRoomSize}
                        onChange={(e) =>
                          AudioManager.setStationEffects(stationId, {
                            reverbRoomSize: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-sky-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Wet / Dry</span>
                        <span>{Math.round(effects.reverbWetDry * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={effects.reverbWetDry}
                        onChange={(e) =>
                          AudioManager.setStationEffects(stationId, {
                            reverbWetDry: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-sky-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. SLOW / TIME EFFECT (SMOOTH REAL-TIME RATE ADJUSTMENT) */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Slow / Time Effect
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-slate-400">
                      {effects.slowEnabled ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={effects.slowEnabled}
                      onChange={(e) =>
                        AudioManager.setStationEffects(stationId, {
                          slowEnabled: e.target.checked,
                        })
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-9 h-5 rounded-full transition relative ${
                        effects.slowEnabled ? 'bg-purple-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${
                          effects.slowEnabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {effects.slowEnabled && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Playback Speed (Smooth Pitch/Rate Shift)</span>
                      <span className="font-mono font-bold text-purple-300">
                        {effects.playbackSpeed.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.65}
                      max={1.0}
                      step={0.01}
                      value={effects.playbackSpeed}
                      onChange={(e) =>
                        AudioManager.setStationEffects(stationId, {
                          playbackSpeed: Number(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-purple-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>0.65x (Deep Slow)</span>
                      <span>0.85x (Chilled)</span>
                      <span>1.00x (Normal)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. ECHO */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">Echo / Delay</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-slate-400">
                      {effects.echoEnabled ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={effects.echoEnabled}
                      onChange={(e) =>
                        AudioManager.setStationEffects(stationId, {
                          echoEnabled: e.target.checked,
                        })
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-9 h-5 rounded-full transition relative ${
                        effects.echoEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${
                          effects.echoEnabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {effects.echoEnabled && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Echo Amount</span>
                        <span>{Math.round(effects.echoAmount * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={effects.echoAmount}
                        onChange={(e) =>
                          AudioManager.setStationEffects(stationId, {
                            echoAmount: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-emerald-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Delay Time</span>
                        <span>{effects.echoDelaySec.toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={0.8}
                        step={0.02}
                        value={effects.echoDelaySec}
                        onChange={(e) =>
                          AudioManager.setStationEffects(stationId, {
                            echoDelaySec: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-emerald-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. FILTER */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Frequency Filter
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-slate-400">
                      {effects.filterEnabled ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={effects.filterEnabled}
                      onChange={(e) =>
                        AudioManager.setStationEffects(stationId, {
                          filterEnabled: e.target.checked,
                        })
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-9 h-5 rounded-full transition relative ${
                        effects.filterEnabled ? 'bg-amber-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${
                          effects.filterEnabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {effects.filterEnabled && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          AudioManager.setStationEffects(stationId, {
                            filterType: 'lowpass',
                          })
                        }
                        className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition ${
                          effects.filterType === 'lowpass'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        Low-Pass (Muffled Club)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          AudioManager.setStationEffects(stationId, {
                            filterType: 'highpass',
                          })
                        }
                        className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition ${
                          effects.filterType === 'highpass'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        High-Pass (Radio Transistor)
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Filter Intensity</span>
                        <span>{Math.round(effects.filterAmount * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={effects.filterAmount}
                        onChange={(e) =>
                          AudioManager.setStationEffects(stationId, {
                            filterAmount: Number(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-amber-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 5. FADE */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Disc3 className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-slate-200">Fade In / Out</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-slate-400">
                      {effects.fadeEnabled ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={effects.fadeEnabled}
                      onChange={(e) =>
                        AudioManager.setStationEffects(stationId, {
                          fadeEnabled: e.target.checked,
                        })
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-9 h-5 rounded-full transition relative ${
                        effects.fadeEnabled ? 'bg-teal-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${
                          effects.fadeEnabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {effects.fadeEnabled && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Transition Duration</span>
                      <span className="font-mono text-teal-300">
                        {effects.fadeDurationSec}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={0.5}
                      value={effects.fadeDurationSec}
                      onChange={(e) =>
                        AudioManager.setStationEffects(stationId, {
                          fadeDurationSec: Number(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-teal-400 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
