import React, { useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Car,
  MapPin,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AudioManager, useAudioManager } from '../audio/AudioManager';
import { MusicStationId, WorldStationId } from '../audio/AudioTypes';

interface AudioManagerPanelProps {
  mode?: 'drawer_embedded' | 'slideover';
  onClose?: () => void;
}

function formatDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return '--:--';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

export const AudioManagerPanel: React.FC<AudioManagerPanelProps> = ({
  mode = 'drawer_embedded',
  onClose,
}) => {
  const snap = useAudioManager();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<MusicStationId>(
    snap.editingStationId
  );
  const [activeSystemTab, setActiveSystemTab] = useState<
    'world_stations' | 'car_radio'
  >('world_stations');
  const [movingTrackId, setMovingTrackId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] =
    useState<MusicStationId>('beach_station');

  const editingStationRuntime =
    snap.stations.find((s) => s.station.id === snap.editingStationId) ||
    snap.stations[0];
  const editingStation = editingStationRuntime.station;
  const editingPlaylist =
    snap.playlists[editingStation.id] || snap.playlists.downtown_station;

  const carRadio = snap.carRadio;
  const carPlaylist = snap.playlists.car_radio;

  const triggerUploadFor = (targetId: MusicStationId) => {
    setUploadTargetId(targetId);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetLabel =
      uploadTargetId === 'car_radio'
        ? 'Car Radio'
        : snap.stations.find((s) => s.station.id === uploadTargetId)?.station
            .shortLabel || 'Station';

    const result = AudioManager.uploadAudioFiles(files, uploadTargetId);
    if (result.added > 0) {
      AudioManager.playUiSound('success');
      AudioManager.showStatusToast(
        `✓ Added ${result.added} song(s) to ${targetLabel}`
      );
    } else if (result.errors.length > 0) {
      AudioManager.playUiSound('warning');
    }
    e.target.value = '';
  };

  const renderSliderRow = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    formatValue?: (val: number) => string,
    min = 0,
    max = 100,
    step = 1
  ) => {
    const displayText = formatValue
      ? formatValue(value)
      : `${Math.round(value * 100)}%`;
    const sliderVal =
      min === 0 && max === 100 && !formatValue ? Math.round(value * 100) : value;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300 tracking-wide">
            {label}
          </span>
          <span className="font-mono font-bold text-amber-300">
            {displayText}
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderVal}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (min === 0 && max === 100 && !formatValue) {
              onChange(raw / 100);
            } else {
              onChange(raw);
            }
          }}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-amber-400"
        />
      </div>
    );
  };

  const allMoveTargets: { id: MusicStationId; label: string }[] = [
    { id: 'car_radio', label: '🚗 Car Radio' },
    ...snap.stations.map((s) => ({
      id: s.station.id as MusicStationId,
      label: `${s.station.icon} ${s.station.name}`,
    })),
  ];

  const content = (
    <div className="space-y-3.5 text-slate-100">
      {/* Hidden Multi-File Audio Input (.mp3, .wav, .ogg, .m4a, etc.) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus,audio/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Toast & Error Notifications */}
      {snap.statusToast && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 text-[11px] font-bold flex items-center justify-between">
          <span>{snap.statusToast}</span>
        </div>
      )}

      {snap.errorBanner && (
        <div className="px-3 py-2 rounded-xl bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[11px] font-bold">
          {snap.errorBanner}
        </div>
      )}

      {/* =====================================================================
          0. TWO SEPARATE AUDIO SYSTEMS SWITCHER:
             [ 📻 WORLD MUSIC STATIONS ]  vs  [ 🚗 CAR RADIO ]
         ===================================================================== */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-white/10">
        <button
          type="button"
          onClick={() => {
            AudioManager.playUiSound('click');
            setActiveSystemTab('world_stations');
          }}
          className={`py-2 px-2.5 rounded-lg text-[11px] font-display font-extrabold flex items-center justify-center gap-1.5 transition ${
            activeSystemTab === 'world_stations'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>📻 WORLD STATIONS (9)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            AudioManager.playUiSound('click');
            setActiveSystemTab('car_radio');
          }}
          className={`py-2 px-2.5 rounded-lg text-[11px] font-display font-extrabold flex items-center justify-center gap-1.5 transition ${
            activeSystemTab === 'car_radio'
              ? 'bg-cyan-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>🚗 CAR RADIO</span>
          {carRadio.isPlaying && (
            <span className="text-[10px] font-mono">
              ({Math.round(carRadio.spatialGain * 100)}%)
            </span>
          )}
        </button>
      </div>

      {/* =====================================================================
          SYSTEM 1: 🚗 SPATIAL CAR RADIO PANEL
         ===================================================================== */}
      {activeSystemTab === 'car_radio' && (
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-400/45 space-y-3">
          <div className="border-b border-white/10 pb-2.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <span>🚗 SPATIAL CAR RADIO</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Attached to vehicle position · Loud inside car · Silent far away
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('click');
                AudioManager.updateCarRadioSettings({
                  enabled: !carRadio.enabled,
                });
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                carRadio.enabled
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400 border border-white/10'
              }`}
            >
              {carRadio.enabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Live 3D Spatial Vehicle Telemetry */}
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Radio Status:</span>
              <span className="font-bold">
                {carRadio.isPlaying ? (
                  <span className="text-emerald-300">🟢 PLAYING</span>
                ) : carRadio.playbackStatus === 'paused' ? (
                  <span className="text-amber-300">⏸ PAUSED</span>
                ) : (
                  <span className="text-slate-400">⏹ STOPPED</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">
                Spatial Hearing:
              </span>
              <span className="font-mono font-bold text-cyan-300">
                {snap.isInsideVehicle
                  ? '🏎️ Inside Vehicle (100% Clear)'
                  : carRadio.distanceToPlayer <= carRadio.maxHearingDistance
                  ? `${carRadio.distanceToPlayer.toFixed(1)}m away (${Math.round(
                      carRadio.spatialGain * 100
                    )}% Vol)`
                  : `${carRadio.distanceToPlayer.toFixed(1)}m away (0% SILENT)`}
              </span>
            </div>

            <div className="pt-1 border-t border-white/5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="uppercase font-semibold">Current Track:</span>
                {carRadio.currentTrack && (
                  <span className="font-mono text-amber-300">
                    {formatDuration(carRadio.currentTrackProgressSec)} /{' '}
                    {formatDuration(
                      carRadio.currentTrackDurationSec ||
                        carRadio.currentTrack.durationSec
                    )}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-amber-300 truncate mt-0.5">
                {carRadio.currentTrack
                  ? `${carRadio.currentTrack.title} (${carRadio.currentTrack.fileType})`
                  : 'No music uploaded to Car Radio'}
              </div>
            </div>
          </div>

          {/* Car Radio Playlist & [+ ADD MUSIC] */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Car Radio Playlist ({carPlaylist.tracks.length}):
            </span>
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('click');
                triggerUploadFor('car_radio');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 shadow-md transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
              <span>+ ADD MUSIC</span>
            </button>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
            {carPlaylist.tracks.length === 0 ? (
              <div className="text-[11px] text-slate-400 italic text-center py-3 px-2 rounded-xl bg-slate-950/60 border border-white/5">
                No songs in Car Radio — tap <strong>[+ ADD MUSIC]</strong> to
                upload MP3, WAV, OGG, or M4A files.
              </div>
            ) : (
              carPlaylist.tracks.map((track, idx) => {
                const isCurrent = carRadio.currentTrack?.id === track.id;
                const isMovingThis = movingTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    className={`p-2 rounded-xl border text-[11px] transition space-y-1.5 ${
                      isCurrent
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-white'
                        : 'bg-slate-950/85 border-white/10 text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          AudioManager.playUiSound('click');
                          AudioManager.selectTrack(track.id, 'car_radio');
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-bold truncate flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-amber-300">
                            🎵 {idx + 1}.
                          </span>
                          <span className="truncate">{track.title}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                          {track.fileName} · {track.fileType} ·{' '}
                          {formatDuration(track.durationSec)} · Car Radio
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            AudioManager.playUiSound('click');
                            if (isCurrent && carRadio.isPlaying) {
                              AudioManager.pause('car_radio');
                            } else {
                              AudioManager.selectTrack(track.id, 'car_radio');
                            }
                          }}
                          className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 transition"
                        >
                          {isCurrent && carRadio.isPlaying ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            AudioManager.playUiSound('click');
                            if (isMovingThis) {
                              setMovingTrackId(null);
                            } else {
                              setMoveTargetId('downtown_station');
                              setMovingTrackId(track.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition"
                          title="Move song to a World Music Station"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            AudioManager.playUiSound('click');
                            AudioManager.removeTrackFromStation(
                              track.id,
                              'car_radio'
                            );
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isMovingThis && (
                      <div className="pt-1.5 border-t border-white/10 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 shrink-0">
                          Move to:
                        </span>
                        <select
                          value={moveTargetId}
                          onChange={(e) =>
                            setMoveTargetId(e.target.value as MusicStationId)
                          }
                          className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[10px] text-white"
                        >
                          {allMoveTargets
                            .filter((t) => t.id !== 'car_radio')
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            AudioManager.moveTrackToStation(
                              track.id,
                              'car_radio',
                              moveTargetId
                            );
                            setMovingTrackId(null);
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold text-[10px]"
                        >
                          Move
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Car Radio Transport Controls */}
          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.play('car_radio');
                }}
                className={`py-2 px-2 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 shadow-md transition active:scale-95 ${
                  carRadio.isPlaying
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-emerald-500/25 hover:bg-emerald-400 hover:text-slate-950 border border-emerald-400/50 text-emerald-200'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>PLAY</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.pause('car_radio');
                }}
                className={`py-2 px-2 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 border transition active:scale-95 ${
                  carRadio.playbackStatus === 'paused'
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-amber-200 border-amber-400/40'
                }`}
              >
                <Pause className="w-3.5 h-3.5" />
                <span>PAUSE</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.stop('car_radio');
                }}
                className={`py-2 px-2 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 border transition active:scale-95 ${
                  carRadio.playbackStatus === 'stopped'
                    ? 'bg-rose-500/30 text-rose-200 border-rose-400/50'
                    : 'bg-slate-900 hover:bg-rose-500/25 text-slate-200 border-white/15'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>STOP</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.previousTrack('car_radio');
                }}
                className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <SkipBack className="w-3.5 h-3.5" />
                <span>PREVIOUS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.nextTrack(false, 'car_radio');
                }}
                className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span>NEXT</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Car Radio Playback Order & Spatial Distance Settings */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.setPlaybackOrder('sequential', 'car_radio');
                }}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition ${
                  carRadio.playbackOrder === 'sequential'
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                    : 'bg-slate-950 text-slate-300 border-white/10'
                }`}
              >
                <span>
                  {carRadio.playbackOrder === 'sequential' ? '●' : '○'}{' '}
                  Sequential
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.setPlaybackOrder('shuffle', 'car_radio');
                }}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition ${
                  carRadio.playbackOrder === 'shuffle'
                    ? 'bg-fuchsia-400 text-slate-950 border-fuchsia-300'
                    : 'bg-slate-950 text-slate-300 border-white/10'
                }`}
              >
                <Shuffle className="w-3 h-3" />
                <span>
                  {carRadio.playbackOrder === 'shuffle' ? '●' : '○'} Shuffle
                </span>
              </button>
            </div>

            {renderSliderRow(
              'Max Hearing Distance (0% beyond)',
              carRadio.maxHearingDistance,
              (val) =>
                AudioManager.updateCarRadioSettings({
                  maxHearingDistance: val,
                }),
              (v) => `${Math.round(v)}m`,
              15,
              80,
              1
            )}

            {renderSliderRow(
              'Car Radio Volume',
              carRadio.volume,
              (val) => AudioManager.updateCarRadioSettings({ volume: val })
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SYSTEM 2: 📻 9 SPATIAL WORLD MUSIC STATIONS
         ===================================================================== */}
      {activeSystemTab === 'world_stations' && (
        <>
          {/* 1. Map Station Selector & Nearby Interactive Prompt */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-400/35 space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Radio className="w-3.5 h-3.5" />
                <span>📻 WORLD MUSIC STATIONS</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 font-semibold">
                Crossfade: {snap.settings.crossfadeDurationSec.toFixed(1)}s
              </span>
            </div>

            {/* In-World Nearby Station Prompt */}
            {snap.nearbyInteractiveStation && (
              <div className="px-2.5 py-2 rounded-xl bg-amber-400/15 border border-amber-400/45 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-amber-100 truncate">
                    Near:{' '}
                    <strong>
                      {snap.nearbyInteractiveStation.station.name}
                    </strong>{' '}
                    ({snap.nearbyInteractiveStation.distance}m)
                  </span>
                </div>
                {snap.editingStationId !==
                  snap.nearbyInteractiveStation.station.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (snap.nearbyInteractiveStation) {
                        AudioManager.playUiSound('click');
                        AudioManager.setEditingStation(
                          snap.nearbyInteractiveStation.station.id
                        );
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-extrabold text-[10px] shrink-0"
                  >
                    Open Station
                  </button>
                )}
              </div>
            )}

            {/* Grid of All 9 Physical World Music Stations */}
            <div className="grid grid-cols-3 gap-1.5">
              {snap.stations.map((stRuntime) => {
                const st = stRuntime.station;
                const isEditing = snap.editingStationId === st.id;
                const isPlayingThis = stRuntime.isPlaying;
                const audiblePct = Math.round(
                  stRuntime.currentSpatialGain * 100
                );
                const trackCount = snap.playlists[st.id]?.tracks.length ?? 0;

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      AudioManager.playUiSound('click');
                      AudioManager.setEditingStation(st.id);
                    }}
                    className={`p-2 rounded-xl border text-left transition flex flex-col justify-between gap-0.5 ${
                      isEditing
                        ? 'bg-amber-400/25 border-amber-300 text-white shadow-sm'
                        : isPlayingThis && audiblePct > 0
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-900/85 border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-[10px] font-bold truncate flex items-center justify-between gap-1">
                      <span className="truncate">
                        {st.shortLabel.replace(' Station', '')}
                      </span>
                      {isPlayingThis && (
                        <span className="text-[9px] text-emerald-300 shrink-0">
                          🟢
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono flex items-center justify-between">
                      <span>{trackCount}♪</span>
                      <span
                        className={
                          audiblePct > 0 ? 'text-amber-300 font-bold' : ''
                        }
                      >
                        {audiblePct > 0
                          ? `${audiblePct}%`
                          : `${Math.round(stRuntime.distance)}m`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SELECTED WORLD MUSIC STATION EDITOR */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-400/40 space-y-3">
            {/* Station Header & Enabled Toggle */}
            <div className="border-b border-white/10 pb-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 truncate">
                  <span>{editingStation.icon}</span>
                  <span className="truncate">
                    {editingStation.name.toUpperCase()}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {editingStation.description}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  AudioManager.updateStationSettings(editingStation.id, {
                    enabled: !editingStation.enabled,
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 ${
                  editingStation.enabled
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-400 border border-white/10'
                }`}
              >
                {editingStation.enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Live Spatial Zone Status & Current Track */}
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Status:</span>
                <span className="font-bold">
                  {editingStationRuntime.isPlaying ? (
                    <span className="text-emerald-300">🟢 PLAYING</span>
                  ) : editingStationRuntime.playbackStatus === 'paused' ? (
                    <span className="text-amber-300">⏸ PAUSED</span>
                  ) : (
                    <span className="text-slate-400">⏹ STOPPED</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">
                  Spatial Distance:
                </span>
                <span className="font-mono font-bold text-cyan-300">
                  {editingStationRuntime.distance.toFixed(1)}m ·{' '}
                  {editingStationRuntime.distance <= editingStation.radius
                    ? 'Inside Zone (100%)'
                    : editingStationRuntime.distance <=
                      editingStation.radius + editingStation.fadeDistance
                    ? `Fade Zone (${Math.round(
                        editingStationRuntime.currentSpatialGain * 100
                      )}%)`
                    : 'Outside Range (0% Silent)'}
                </span>
              </div>

              <div className="pt-1 border-t border-white/5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="uppercase font-semibold">
                    Current Track:
                  </span>
                  {editingStationRuntime.currentTrack && (
                    <span className="font-mono text-amber-300">
                      {formatDuration(
                        editingStationRuntime.currentTrackProgressSec
                      )}{' '}
                      /{' '}
                      {formatDuration(
                        editingStationRuntime.currentTrackDurationSec ||
                          editingStationRuntime.currentTrack.durationSec
                      )}
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-amber-300 truncate mt-0.5">
                  {editingStationRuntime.currentTrack
                    ? `${editingStationRuntime.currentTrack.title} (${editingStationRuntime.currentTrack.fileType})`
                    : editingPlaylist.tracks[0]
                    ? editingPlaylist.tracks[0].title
                    : 'No music in station'}
                </div>
              </div>
            </div>

            {/* [ + ADD MUSIC ] Button */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Playlist ({editingPlaylist.tracks.length}):
              </span>
              <button
                type="button"
                onClick={() => {
                  AudioManager.playUiSound('click');
                  triggerUploadFor(editingStation.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 shadow-md transition active:scale-95"
                title="Upload .mp3, .wav, .ogg, or .m4a files directly to this Music Station (100% clean original audio)"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                <span>+ ADD MUSIC</span>
              </button>
            </div>

            {/* Station Playlist Tracklist */}
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
              {editingPlaylist.tracks.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic text-center py-3 px-2 rounded-xl bg-slate-950/60 border border-white/5">
                  No songs in {editingStation.name} — tap{' '}
                  <strong>[+ ADD MUSIC]</strong> to upload MP3, WAV, OGG, or M4A
                  files.
                </div>
              ) : (
                editingPlaylist.tracks.map((track, idx) => {
                  const isCurrent =
                    editingStationRuntime.currentTrack?.id === track.id;
                  const isMovingThis = movingTrackId === track.id;

                  return (
                    <div
                      key={track.id}
                      className={`p-2 rounded-xl border text-[11px] transition space-y-1.5 ${
                        isCurrent
                          ? 'bg-cyan-500/20 border-cyan-400/60 text-white'
                          : 'bg-slate-950/85 border-white/10 text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            AudioManager.playUiSound('click');
                            AudioManager.selectTrack(
                              track.id,
                              editingStation.id
                            );
                          }}
                          className="flex-1 text-left min-w-0"
                          title="Click to play this song on this station"
                        >
                          <div className="font-bold truncate flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-amber-300">
                              🎵 {idx + 1}.
                            </span>
                            <span className="truncate">{track.title}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                            {track.fileName} · {track.fileType} ·{' '}
                            {formatDuration(track.durationSec)} ·{' '}
                            {editingStation.shortLabel.replace(' Station', '')}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              AudioManager.playUiSound('click');
                              if (
                                isCurrent &&
                                editingStationRuntime.isPlaying
                              ) {
                                AudioManager.pause(editingStation.id);
                              } else {
                                AudioManager.selectTrack(
                                  track.id,
                                  editingStation.id
                                );
                              }
                            }}
                            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 transition"
                          >
                            {isCurrent && editingStationRuntime.isPlaying ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              AudioManager.playUiSound('click');
                              if (isMovingThis) {
                                setMovingTrackId(null);
                              } else {
                                setMoveTargetId('car_radio');
                                setMovingTrackId(track.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition"
                            title="Move song to another Music Station or Car Radio"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              AudioManager.playUiSound('click');
                              AudioManager.removeTrackFromStation(
                                track.id,
                                editingStation.id
                              );
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 transition"
                            title="Remove song from station"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isMovingThis && (
                        <div className="pt-1.5 border-t border-white/10 flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 shrink-0">
                            Move to:
                          </span>
                          <select
                            value={moveTargetId}
                            onChange={(e) =>
                              setMoveTargetId(e.target.value as MusicStationId)
                            }
                            className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[10px] text-white"
                          >
                            {allMoveTargets
                              .filter((t) => t.id !== editingStation.id)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              AudioManager.moveTrackToStation(
                                track.id,
                                editingStation.id,
                                moveTargetId
                              );
                              setMovingTrackId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold text-[10px]"
                          >
                            Move
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Transport Controls: [ ▶ PLAY ] [ ⏸ PAUSE ] [ ⏹ STOP ] & [ ⏮ PREVIOUS ] [ ⏭ NEXT ] */}
            <div className="space-y-1.5 pt-1">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    AudioManager.playUiSound('click');
                    AudioManager.play(editingStation.id);
                  }}
                  className={`py-2 px-2 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 shadow-md transition active:scale-95 ${
                    editingStationRuntime.isPlaying
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-emerald-500/25 hover:bg-emerald-400 hover:text-slate-950 border border-emerald-400/50 text-emerald-200'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>PLAY</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    AudioManager.playUiSound('click');
                    AudioManager.pause(editingStation.id);
                  }}
                  className={`py-2 px-2 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 border transition active:scale-95 ${
                    editingStationRuntime.playbackStatus === 'paused'
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900 hover:bg-slate-800 text-amber-200 border-amber-400/40'
                  }`}
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>PAUSE</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    AudioManager.playUiSound('click');
                    AudioManager.stop(editingStation.id);
                  }}
                  className={`py-2 px-2 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 border transition active:scale-95 ${
                    editingStationRuntime.playbackStatus === 'stopped'
                      ? 'bg-rose-500/30 text-rose-200 border-rose-400/50'
                      : 'bg-slate-900 hover:bg-rose-500/25 text-slate-200 border-white/15'
                  }`}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>STOP</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    AudioManager.playUiSound('click');
                    AudioManager.previousTrack(editingStation.id);
                  }}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                  <span>PREVIOUS</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    AudioManager.playUiSound('click');
                    AudioManager.nextTrack(false, editingStation.id);
                  }}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <span>NEXT</span>
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Playback Order: ○ Sequential  ○ Shuffle */}
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Playback:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    AudioManager.playUiSound('click');
                    AudioManager.setPlaybackOrder(
                      'sequential',
                      editingStation.id
                    );
                  }}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    editingStation.playbackOrder === 'sequential'
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : 'bg-slate-950 text-slate-300 border-white/10 hover:bg-slate-900'
                  }`}
                >
                  <span>
                    {editingStation.playbackOrder === 'sequential' ? '●' : '○'}{' '}
                    Sequential
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    AudioManager.playUiSound('click');
                    AudioManager.setPlaybackOrder('shuffle', editingStation.id);
                  }}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    editingStation.playbackOrder === 'shuffle'
                      ? 'bg-fuchsia-400 text-slate-950 border-fuchsia-300'
                      : 'bg-slate-950 text-slate-300 border-white/10 hover:bg-slate-900'
                  }`}
                >
                  <Shuffle className="w-3 h-3" />
                  <span>
                    {editingStation.playbackOrder === 'shuffle' ? '●' : '○'}{' '}
                    Shuffle
                  </span>
                </button>
              </div>
            </div>

            {/* Spatial Zone Configuration: Radius, Fade Distance, Crossfade & World Coordinates */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Spatial Zone Settings:
              </div>

              {renderSliderRow(
                'Inner Zone Radius (100% Vol)',
                editingStation.radius,
                (val) =>
                  AudioManager.updateStationSettings(editingStation.id, {
                    radius: val,
                  }),
                (v) => `${Math.round(v)}m`,
                10,
                120,
                1
              )}

              {renderSliderRow(
                'Outer Fade Distance (0% beyond)',
                editingStation.fadeDistance,
                (val) =>
                  AudioManager.updateStationSettings(editingStation.id, {
                    fadeDistance: val,
                  }),
                (v) => `${Math.round(v)}m`,
                10,
                160,
                1
              )}

              {renderSliderRow(
                'Station Crossfade Duration',
                snap.settings.crossfadeDurationSec,
                (val) => AudioManager.setCrossfadeDurationSec(val),
                (v) => `${v.toFixed(1)}s`,
                1,
                10,
                0.5
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Pos X:</span>
                  <input
                    type="number"
                    value={editingStation.position.x}
                    onChange={(e) =>
                      AudioManager.updateStationSettings(editingStation.id, {
                        position: {
                          x: Number(e.target.value) || 0,
                          z: editingStation.position.z,
                        },
                      })
                    }
                    className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-white/15 text-right font-mono text-amber-300 text-[11px]"
                  />
                </div>
                <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Pos Z:</span>
                  <input
                    type="number"
                    value={editingStation.position.z}
                    onChange={(e) =>
                      AudioManager.updateStationSettings(editingStation.id, {
                        position: {
                          x: editingStation.position.x,
                          z: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-white/15 text-right font-mono text-amber-300 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Optional Effects: Slow: OFF | Reverb: OFF | Filter: OFF */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Effects (Optional — Default Clean):
                </span>
                {(editingStation.effects.slowEnabled ||
                  editingStation.effects.reverbEnabled ||
                  editingStation.effects.filterEnabled) && (
                  <button
                    type="button"
                    onClick={() => {
                      AudioManager.playUiSound('click');
                      AudioManager.updateStationEffects(editingStation.id, {
                        slowEnabled: false,
                        playbackSpeed: 1.0,
                        reverbEnabled: false,
                        reverbAmount: 0,
                        filterEnabled: false,
                        filterAmount: 0,
                      });
                    }}
                    className="text-[10px] text-amber-300 hover:underline font-semibold"
                  >
                    Reset to Clean (OFF)
                  </button>
                )}
              </div>

              {/* 1. SLOW EFFECT */}
              <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">
                    Slow (Playback Speed):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      AudioManager.playUiSound('click');
                      const nextOn = !editingStation.effects.slowEnabled;
                      AudioManager.updateStationEffects(editingStation.id, {
                        slowEnabled: nextOn,
                        playbackSpeed: nextOn
                          ? editingStation.effects.playbackSpeed === 1.0
                            ? 0.88
                            : editingStation.effects.playbackSpeed
                          : 1.0,
                      });
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      editingStation.effects.slowEnabled
                        ? 'bg-fuchsia-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300 border border-white/10'
                    }`}
                  >
                    {editingStation.effects.slowEnabled
                      ? `ON (${editingStation.effects.playbackSpeed.toFixed(2)}x)`
                      : 'OFF (1.00x)'}
                  </button>
                </div>
                {editingStation.effects.slowEnabled &&
                  renderSliderRow(
                    'Playback Speed',
                    editingStation.effects.playbackSpeed,
                    (val) =>
                      AudioManager.updateStationEffects(editingStation.id, {
                        playbackSpeed: val,
                      }),
                    (v) => `${v.toFixed(2)}x`,
                    0.75,
                    1.2,
                    0.01
                  )}
              </div>

              {/* 2. REVERB EFFECT */}
              <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">Reverb:</span>
                  <button
                    type="button"
                    onClick={() => {
                      AudioManager.playUiSound('click');
                      const nextOn = !editingStation.effects.reverbEnabled;
                      AudioManager.updateStationEffects(editingStation.id, {
                        reverbEnabled: nextOn,
                        reverbAmount: nextOn
                          ? editingStation.effects.reverbAmount <= 0.02
                            ? 0.3
                            : editingStation.effects.reverbAmount
                          : 0,
                      });
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      editingStation.effects.reverbEnabled
                        ? 'bg-fuchsia-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300 border border-white/10'
                    }`}
                  >
                    {editingStation.effects.reverbEnabled
                      ? `ON (${Math.round(
                          editingStation.effects.reverbAmount * 100
                        )}%)`
                      : 'OFF (0%)'}
                  </button>
                </div>
                {editingStation.effects.reverbEnabled &&
                  renderSliderRow(
                    'Reverb Amount',
                    editingStation.effects.reverbAmount,
                    (val) =>
                      AudioManager.updateStationEffects(editingStation.id, {
                        reverbAmount: val,
                      })
                  )}
              </div>

              {/* 3. FILTER EFFECT */}
              <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">Filter:</span>
                  <button
                    type="button"
                    onClick={() => {
                      AudioManager.playUiSound('click');
                      const nextOn = !editingStation.effects.filterEnabled;
                      AudioManager.updateStationEffects(editingStation.id, {
                        filterEnabled: nextOn,
                        filterAmount: nextOn
                          ? editingStation.effects.filterAmount <= 0.02
                            ? 0.35
                            : editingStation.effects.filterAmount
                          : 0,
                      });
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      editingStation.effects.filterEnabled
                        ? 'bg-fuchsia-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300 border border-white/10'
                    }`}
                  >
                    {editingStation.effects.filterEnabled
                      ? `ON (${Math.round(
                          editingStation.effects.filterAmount * 100
                        )}%)`
                      : 'OFF (0%)'}
                  </button>
                </div>
                {editingStation.effects.filterEnabled &&
                  renderSliderRow(
                    'Low-Pass Filter Amount',
                    editingStation.effects.filterAmount,
                    (val) =>
                      AudioManager.updateStationEffects(editingStation.id, {
                        filterAmount: val,
                      })
                  )}
              </div>
            </div>

            {/* Station Volume Slider */}
            <div className="pt-2 border-t border-white/10">
              {renderSliderRow(
                'Station Volume',
                editingStation.volume,
                (val) =>
                  AudioManager.updateStationSettings(editingStation.id, {
                    volume: val,
                  })
              )}
            </div>

            {/* [ SAVE STATION ] Button */}
            <button
              type="button"
              onClick={() => {
                AudioManager.playUiSound('success');
                AudioManager.saveStationConfiguration(editingStation.id);
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-display font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
            >
              <Save className="w-3.5 h-3.5" />
              <span>SAVE STATION</span>
            </button>
          </div>
        </>
      )}

      {/* =====================================================================
          3. MASTER MIXER (Controls Master, World Stations, Car Radio & UI)
         ===================================================================== */}
      <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Sliders className="w-3.5 h-3.5" />
            <span>🎵 MASTER SPATIAL MIXER</span>
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
        {renderSliderRow(
          'WORLD STATIONS BUS',
          snap.settings.musicVolume,
          (v) => AudioManager.setMusicVolume(v)
        )}
        {renderSliderRow('CAR RADIO BUS', snap.settings.radioVolume, (v) =>
          AudioManager.setRadioVolume(v)
        )}
        {renderSliderRow('UI SOUNDS', snap.settings.uiVolume, (v) =>
          AudioManager.setUiVolume(v)
        )}

        {/* Mute All & Reset Audio Settings */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => AudioManager.toggleMute()}
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
    <div className="fixed top-14 left-0 z-35 w-[88vw] max-w-[385px] max-h-[84dvh] rounded-r-2xl bg-slate-950/95 backdrop-blur-xl border border-l-0 border-amber-400/50 shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      <div className="px-4 py-3 border-b border-white/10 bg-slate-900/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="font-display text-xs font-bold text-white">
              Gemini City Spatial Music Stations &amp; Car Radio
            </h3>
            <p className="text-[10px] text-slate-400">
              3D Spatial World Stations · Independent Car Radio
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
            title="Collapse Music Station Manager"
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
 * Unobtrusive Quick Audio & In-World Nearby Music Station Prompt Button
 */
export const GameAudioQuickControls: React.FC<{
  isAudioPanelOpen: boolean;
  onToggleAudioPanel: () => void;
}> = ({ isAudioPanelOpen, onToggleAudioPanel }) => {
  const snap = useAudioManager();

  const dominantRuntime = snap.dominantStationId
    ? snap.stations.find((s) => s.station.id === snap.dominantStationId)
    : null;
  const isDominantAudible =
    dominantRuntime &&
    dominantRuntime.isPlaying &&
    dominantRuntime.currentSpatialGain > 0.02;

  const isCarRadioAudible =
    snap.carRadio.isPlaying && snap.carRadio.spatialGain > 0.02;

  const handleOpenSpecificStation = (stationId: WorldStationId) => {
    AudioManager.unlockAudio();
    AudioManager.setEditingStation(stationId);
    AudioManager.playUiSound('open');
    if (!isAudioPanelOpen) {
      onToggleAudioPanel();
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-1.5">
        {snap.needsUserInteractionPrompt && (
          <button
            type="button"
            onClick={() => {
              AudioManager.unlockAudio();
            }}
            className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 text-[11px] font-display font-extrabold shadow-lg flex items-center gap-1.5 transition active:scale-95 animate-pulse"
            title="Tap once to enable 3D spatial audio playback"
          >
            <span>🎵 ENABLE AUDIO</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            AudioManager.unlockAudio();
            if (snap.nearbyInteractiveStation && !isAudioPanelOpen) {
              AudioManager.setEditingStation(
                snap.nearbyInteractiveStation.station.id
              );
            }
            AudioManager.playUiSound('open');
            onToggleAudioPanel();
          }}
          className={`h-8 px-2.5 rounded-r-xl backdrop-blur-xl border border-l-0 shadow-lg flex items-center gap-1.5 text-[11px] font-display font-bold transition active:scale-95 ${
            isAudioPanelOpen
              ? 'bg-amber-400 text-slate-950 border-amber-300'
              : isCarRadioAudible || isDominantAudible
              ? 'bg-slate-950/90 hover:bg-slate-900 text-emerald-300 border-emerald-400/50'
              : 'bg-slate-950/90 hover:bg-slate-900 text-amber-300 border-amber-400/50'
          }`}
          title="Open or collapse Spatial Music Stations & Car Radio Manager"
        >
          <span>
            {snap.settings.muted
              ? '🔇 Audio'
              : isCarRadioAudible && snap.isInsideVehicle
              ? `🚗 Car Radio (${Math.round(snap.carRadio.spatialGain * 100)}%) ♪`
              : isDominantAudible && dominantRuntime
              ? `🟢 ${dominantRuntime.station.shortLabel.replace(
                  ' Station',
                  ''
                )} (${Math.round(
                  dominantRuntime.currentSpatialGain * 100
                )}%) ♪`
              : isCarRadioAudible
              ? `🚗 Car Radio (${Math.round(snap.carRadio.spatialGain * 100)}%) ♪`
              : '📻 Music Stations'}
          </span>
          <span className="text-[10px] opacity-80">
            {isAudioPanelOpen ? '◂' : '▸'}
          </span>
        </button>
      </div>

      {/* In-World Nearby Music Station Prompt: "📻 Downtown Music Station — [ Open Station ]" */}
      {snap.nearbyInteractiveStation && !isAudioPanelOpen && (
        <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-r-xl bg-slate-950/92 backdrop-blur-xl border border-l-0 border-cyan-400/55 shadow-xl text-[10px]">
          <span className="text-cyan-200 font-semibold truncate max-w-[165px]">
            📻 {snap.nearbyInteractiveStation.station.name}
          </span>
          <button
            type="button"
            onClick={() =>
              handleOpenSpecificStation(
                snap.nearbyInteractiveStation!.station.id
              )
            }
            className="px-2 py-0.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold transition active:scale-95 shrink-0"
          >
            [ Open Station ]
          </button>
        </div>
      )}
    </div>
  );
};
