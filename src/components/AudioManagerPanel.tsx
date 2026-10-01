import React, { useRef, useState } from 'react';
import {
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AudioManager, useAudioManager } from '../audio/AudioManager';
import { AudioPlaylistId } from '../audio/AudioTypes';

interface AudioManagerPanelProps {
  mode?: 'drawer_embedded' | 'slideover';
  onClose?: () => void;
}

export const AudioManagerPanel: React.FC<AudioManagerPanelProps> = ({
  mode = 'drawer_embedded',
  onClose,
}) => {
  const snap = useAudioManager();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isManageZonesOpen, setIsManageZonesOpen] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const activePlaylist =
    snap.playlists[snap.settings.selectedPlaylistId] || snap.playlists.car_radio;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const result = AudioManager.uploadAudioFiles(
      files,
      snap.settings.selectedPlaylistId
    );
    if (result.added > 0) {
      AudioManager.playUiSound('success');
      setUploadFeedback(`✓ Added ${result.added} song(s) to playlist`);
      window.setTimeout(() => setUploadFeedback(null), 3500);
    } else if (result.errors.length > 0) {
      AudioManager.playUiSound('warning');
    }
    e.target.value = '';
  };

  const renderSliderRow = (
    label: string,
    value: number,
    onChange: (val: number) => void
  ) => {
    const pct = Math.round(value * 100);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300 tracking-wide">
            {label}
          </span>
          <span className="font-mono font-bold text-amber-300">{pct}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-amber-400"
        />
      </div>
    );
  };

  const content = (
    <div className="space-y-3.5 text-slate-100">
      {/* Hidden Multi-File Audio Input (.mp3, .wav, .ogg, .m4a, etc.) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus,audio/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 1. VOLUME MIXER SECTION */}
      <div className="p-3 rounded-xl bg-slate-950/85 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Music className="w-3.5 h-3.5" />
            <span>🎵 AUDIO MANAGER</span>
          </div>
          {snap.settings.muted && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[10px] font-bold">
              MUTED
            </span>
          )}
        </div>

        {renderSliderRow('MASTER VOLUME', snap.settings.masterVolume, (v) =>
          AudioManager.setMasterVolume(v)
        )}
        {renderSliderRow('MUSIC', snap.settings.musicVolume, (v) =>
          AudioManager.setMusicVolume(v)
        )}
        {renderSliderRow('RADIO', snap.settings.radioVolume, (v) =>
          AudioManager.setRadioVolume(v)
        )}
        {renderSliderRow('AMBIENCE', snap.settings.ambienceVolume, (v) =>
          AudioManager.setAmbienceVolume(v)
        )}
        {renderSliderRow('ENVIRONMENT', snap.settings.environmentVolume, (v) =>
          AudioManager.setEnvironmentVolume(v)
        )}
        {renderSliderRow('UI SOUNDS', snap.settings.uiVolume, (v) =>
          AudioManager.setUiVolume(v)
        )}
      </div>

      {/* 2. CAR & VEHICLE RADIO SECTION */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/15 via-slate-950 to-amber-500/10 border border-cyan-400/35 space-y-2.5">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <Radio className="w-3.5 h-3.5" />
            <span>🚗 CAR RADIO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Radio:</span>
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('click');
                AudioManager.setRadioEnabled(!snap.settings.radioEnabled);
              }}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold transition active:scale-95 ${
                snap.settings.radioEnabled
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-white/15'
              }`}
            >
              {snap.settings.radioEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Physical Vehicle Proximity / Cabin Indicator */}
        <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded-lg bg-slate-900/90 border border-white/10">
          <span className="text-slate-300">
            {snap.isInsideVehicle
              ? `Seated in ${snap.activeVehicleId === 'cyber_car' ? '🏎️ Cyber Car' : '🚌 Bus'} (Cabin Clear)`
              : `Outside Vehicle (${snap.nearestVehicleDistance}m away)`}
          </span>
          <span className="font-mono font-bold text-cyan-300">
            Mix: {Math.round(snap.radioPhysicalGain * 100)}%
          </span>
        </div>

        {/* Playlist Selector & [+ Add Music] Upload Button */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-semibold">Playlist:</span>
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('click');
                fileInputRef.current?.click();
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-sm transition active:scale-95"
              title="Upload .mp3, .wav, .ogg, or .m4a music files from your device"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.6]" />
              <span>+ Add Music</span>
            </button>
          </div>

          <select
            value={snap.settings.selectedPlaylistId}
            onChange={(e) => {
              AudioManager.playUiSound('click');
              AudioManager.setSelectedPlaylist(e.target.value as AudioPlaylistId);
            }}
            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="car_radio">
              CAR RADIO ({snap.playlists.car_radio.tracks.length} songs)
            </option>
            <option value="custom_radio">
              MY UPLOADED MUSIC ({snap.playlists.custom_radio.tracks.length} songs)
            </option>
            <option value="world_ambience">
              WORLD AMBIENT ({snap.playlists.world_ambience.tracks.length} songs)
            </option>
          </select>
        </div>

        {uploadFeedback && (
          <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold">
            {uploadFeedback}
          </div>
        )}

        {snap.radioErrorBanner && (
          <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[11px] font-bold">
            {snap.radioErrorBanner}
          </div>
        )}

        {/* Playback Order: [ Sequential ] [ Shuffle ] */}
        <div className="space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold">Playback:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('click');
                AudioManager.setPlaybackOrder('sequential');
              }}
              className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition active:scale-95 ${
                snap.settings.playbackOrder === 'sequential'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                  : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
              }`}
            >
              <span>Sequential</span>
            </button>
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('click');
                AudioManager.setPlaybackOrder('shuffle');
              }}
              className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition active:scale-95 ${
                snap.settings.playbackOrder === 'shuffle'
                  ? 'bg-fuchsia-400 text-slate-950 border-fuchsia-300'
                  : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
              }`}
            >
              <Shuffle className="w-3 h-3" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

        {/* Transport Controls: [ Previous ] [ Play/Pause ] [ Next ] */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => {
              AudioManager.playUiSound('click');
              AudioManager.previousTrack();
            }}
            className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1 transition active:scale-95"
          >
            <SkipBack className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <button
            type="button"
            onClick={() => {
              AudioManager.playUiSound('click');
              AudioManager.toggleRadioPlayPause();
            }}
            className={`py-2 px-2 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 shadow-md transition active:scale-95 ${
              snap.isPlayingRadio
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
            }`}
          >
            {snap.isPlayingRadio ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              AudioManager.playUiSound('click');
              AudioManager.nextTrack(false);
            }}
            className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1 transition active:scale-95"
          >
            <span>Next</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Current Track Display */}
        <div className="p-2.5 rounded-xl bg-slate-950/90 border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Current Track:
          </div>
          <div className="text-xs font-bold text-amber-300 truncate mt-0.5">
            {activePlaylist.tracks.length === 0
              ? 'No music added'
              : snap.currentTrack
              ? snap.currentTrack.title
              : activePlaylist.tracks[0]?.title || 'No music added'}
          </div>
          {snap.currentTrack?.artist && activePlaylist.tracks.length > 0 && (
            <div className="text-[10px] text-slate-400 truncate">
              {snap.currentTrack.artist}
            </div>
          )}
        </div>

        {/* Tracklist in Active Playlist */}
        <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
          {activePlaylist.tracks.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic text-center py-2">
              No music added — tap [+ Add Music] to upload .mp3/.wav/.ogg/.m4a files.
            </div>
          ) : (
            activePlaylist.tracks.map((track, idx) => {
              const isCurrent = snap.currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition ${
                    isCurrent
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 font-bold'
                      : 'bg-slate-900/80 border-white/5 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => AudioManager.selectTrack(track.id)}
                    className="flex-1 text-left truncate flex items-center gap-1.5"
                  >
                    <span className="font-mono text-[10px] text-slate-400">
                      {idx + 1}.
                    </span>
                    <span className="truncate">{track.title}</span>
                    {track.isUserUpload && (
                      <span className="px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[9px] shrink-0">
                        Uploaded
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => AudioManager.removeTrack(track.id)}
                    className="p-1 rounded hover:bg-rose-500/25 text-slate-400 hover:text-rose-300 transition shrink-0"
                    title="Remove track from playlist"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. WORLD AMBIENCE SECTION */}
      <div className="p-3 rounded-xl bg-slate-950/85 border border-emerald-400/30 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            🌎 WORLD AMBIENCE
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Ambient Music:</span>
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('click');
                AudioManager.setAmbientEnabled(!snap.settings.ambientMusicEnabled);
              }}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold transition active:scale-95 ${
                snap.settings.ambientMusicEnabled
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-white/15'
              }`}
            >
              {snap.settings.ambientMusicEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-semibold">Frequency:</span>
            <span className="font-mono text-[10px] text-emerald-300 uppercase">
              {snap.settings.ambientFrequency}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>Rare</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={snap.settings.ambientFrequencyValue}
              onChange={(e) =>
                AudioManager.setAmbientFrequencyValue(Number(e.target.value))
              }
              className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-emerald-400"
            />
            <span>Frequent</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-[10px]">
          <span className="text-slate-300 truncate">
            {snap.ambientStatus.state === 'silent_Disabled'
              ? 'Ambient Music OFF'
              : snap.ambientStatus.state === 'waiting_quiet_period'
              ? `Quiet Period · Next in ~${snap.ambientStatus.nextAmbientCountdownSec}s`
              : `${snap.ambientStatus.currentAmbientTrackTitle || 'Ambient Track'} (${snap.ambientStatus.state.replace('_', ' ')})`}
          </span>
          {snap.settings.ambientMusicEnabled && (
            <button
              type="button"
              onClick={() => AudioManager.playAmbient()}
              className="px-2 py-0.5 rounded bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 font-bold shrink-0 transition"
            >
              Trigger Now
            </button>
          )}
        </div>
      </div>

      {/* 4. LOCATION AUDIO ZONES SECTION */}
      <div className="p-3 rounded-xl bg-slate-950/85 border border-amber-400/30 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              📍 LOCATION AUDIO
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Active Zone:{' '}
              <span className="text-white font-semibold">{snap.activeZoneName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              AudioManager.playUiSound('click');
              setIsManageZonesOpen((prev) => !prev);
            }}
            className="px-2.5 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/45 text-amber-200 text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
          >
            <Sliders className="w-3 h-3" />
            <span>{isManageZonesOpen ? 'Hide Zones' : 'Manage'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="px-2 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300">
            Weather Audio:{' '}
            <span className="text-sky-300 font-bold uppercase">{snap.weather}</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300">
            Time Audio:{' '}
            <span className="text-amber-300 font-bold">{snap.timePhase}</span>
          </div>
        </div>

        {isManageZonesOpen && (
          <div className="space-y-1.5 pt-1 max-h-52 overflow-y-auto pr-0.5">
            {snap.zones.map((zState) => {
              const z = zState.zone;
              const pct = Math.round(z.volume * 100);
              return (
                <div
                  key={z.id}
                  className={`p-2 rounded-lg border text-[11px] space-y-1 ${
                    zState.currentGain > 0.05
                      ? 'bg-amber-500/15 border-amber-400/50'
                      : 'bg-slate-900/90 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white truncate">
                      {z.icon} {z.shortLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => AudioManager.setZoneEnabled(z.id, !z.enabled)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        z.enabled
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {z.enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={(e) =>
                        AudioManager.setZoneVolume(z.id, Number(e.target.value) / 100)
                      }
                      className="flex-1 h-1 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-amber-400"
                    />
                    <span className="font-mono text-[10px] text-slate-300 w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. MASTER MUTE & RESET SECTION */}
      <div className="p-3 rounded-xl bg-slate-950/85 border border-white/10 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
          🔊 MASTER
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              AudioManager.toggleMute();
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition active:scale-95 ${
              snap.settings.muted
                ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/15'
            }`}
          >
            {snap.settings.muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Unmute All</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mute All</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              AudioManager.resetAudioSettings();
              AudioManager.playUiSound('click');
            }}
            className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Audio</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === 'drawer_embedded') {
    return content;
  }

  return (
    <div className="fixed top-14 left-0 z-35 w-[88vw] max-w-[360px] max-h-[82dvh] rounded-r-2xl bg-slate-950/95 backdrop-blur-xl border border-l-0 border-amber-400/50 shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      <div className="px-4 py-3 border-b border-white/10 bg-slate-900/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="font-display text-xs font-bold text-white">
              Gemini City Audio &amp; Radio Manager
            </h3>
            <p className="text-[10px] text-slate-400">
              Car Radio · Uploads · Ambience · Audio Zones
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
            title="Collapse Audio Manager"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-3.5 overflow-y-auto">{content}</div>
    </div>
  );
};

/**
 * Unobtrusive Autoplay Unlock & Quick Audio Toggle Pill
 */
export const GameAudioQuickControls: React.FC<{
  isAudioPanelOpen: boolean;
  onToggleAudioPanel: () => void;
}> = ({ isAudioPanelOpen, onToggleAudioPanel }) => {
  const snap = useAudioManager();

  return (
    <div className="flex items-center gap-1.5">
      {snap.needsUserInteractionPrompt && (
        <button
          type="button"
          onClick={() => {
            AudioManager.unlockAudio();
            AudioManager.playUiSound('success');
          }}
          className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 text-[11px] font-display font-extrabold shadow-lg flex items-center gap-1.5 transition active:scale-95 animate-pulse"
          title="Tap once to enable Gemini City game audio, vehicle radio, and environmental sound"
        >
          <span>🎵 Enable Game Audio</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          AudioManager.unlockAudio();
          AudioManager.playUiSound('open');
          onToggleAudioPanel();
        }}
        className={`h-8 px-2.5 rounded-r-xl backdrop-blur-xl border border-l-0 shadow-lg flex items-center gap-1.5 text-[11px] font-display font-bold transition active:scale-95 ${
          isAudioPanelOpen
            ? 'bg-amber-400 text-slate-950 border-amber-300'
            : 'bg-slate-950/90 hover:bg-slate-900 text-amber-300 border-amber-400/50'
        }`}
        title="Open or collapse the Gemini City Audio Manager (Car Radio, Upload Music, World Ambience & Audio Zones)"
      >
        <span>
          {snap.settings.muted
            ? '🔇 Audio'
            : snap.isPlayingRadio
            ? '📻 Radio ♪'
            : '🎵 Audio'}
        </span>
        <span className="text-[10px] opacity-80">{isAudioPanelOpen ? '◂' : '▸'}</span>
      </button>
    </div>
  );
};
