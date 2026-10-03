import {
  AudioPlaylist,
  AudioPlaylistId,
  AudioTrack,
  PlaybackOrder,
} from './AudioTypes';

const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.flac',
  '.webm',
  '.opus',
];

const MAX_SAFE_FILE_BYTES = 250 * 1024 * 1024; // 250 MB safety limit
const IDB_NAME = 'gemini_city_station_uploads_v2';
const IDB_STORE = 'station_tracks';

interface StoredUploadRecord {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  artist?: string;
  playlistId: AudioPlaylistId;
  durationSec?: number;
  fileSize?: number;
  mimeType?: string;
  addedAt: number;
  blob: Blob;
}

function openStationUploadsDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function detectFileTypeLabel(file: File): string {
  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch && extMatch[1]) {
    return extMatch[1].toUpperCase();
  }
  if (file.type) {
    const parts = file.type.split('/');
    if (parts[1]) return parts[1].toUpperCase();
  }
  return 'AUDIO';
}

export class PlaylistManager {
  private playlists: Record<AudioPlaylistId, AudioPlaylist>;
  private createdObjectUrls: Set<string> = new Set();
  private recentHistoryByPlaylist: Map<AudioPlaylistId, string[]> = new Map();
  private onUpdatedCallback?: (hydratedPlaylistIds?: AudioPlaylistId[]) => void;

  constructor(onUpdated?: (hydratedPlaylistIds?: AudioPlaylistId[]) => void) {
    this.onUpdatedCallback = onUpdated;

    // 100% USER UPLOADED MUSIC ONLY — No generated or external tracks!
    this.playlists = {
      cyber_city_station: {
        id: 'cyber_city_station',
        name: 'Cyber City Audio Station',
        description: 'Neo-Horizon Cyber-Core Plaza Physical Audio Station.',
        tracks: [],
      },
      jamaica_city_station: {
        id: 'jamaica_city_station',
        name: 'Jamaica City Audio Station',
        description: 'Central Starlight Park Physical Audio Station.',
        tracks: [],
      },
      car_radio: {
        id: 'car_radio',
        name: 'Car Radio',
        description: 'Spatial vehicle radio attached to the car/bus.',
        tracks: [],
      },
      downtown_station: {
        id: 'downtown_station',
        name: 'Downtown Music Station',
        description: 'Horizon Civic Academy & Downtown Clocktower Plaza.',
        tracks: [],
      },
      beach_station: {
        id: 'beach_station',
        name: 'Beach Music Station',
        description: 'South Harbor Pier & Golden Coastline.',
        tracks: [],
      },
      market_station: {
        id: 'market_station',
        name: 'Market Music Station',
        description: 'Neo-Horizon Cyber-Core Market Plaza.',
        tracks: [],
      },
      park_station: {
        id: 'park_station',
        name: 'Park Music Station',
        description: 'Central Starlight Park & Fountain.',
        tracks: [],
      },
      restaurant_station: {
        id: 'restaurant_station',
        name: 'Restaurant Music Station',
        description: 'Sunbeam Espresso Café & Bistro.',
        tracks: [],
      },
      residential_station: {
        id: 'residential_station',
        name: 'Residential Music Station',
        description: 'Maple Loft & Hearthstone Residential District.',
        tracks: [],
      },
      shopping_station: {
        id: 'shopping_station',
        name: 'Shopping Music Station',
        description: 'East Promenade & Conservatory Shopping Area.',
        tracks: [],
      },
      industrial_station: {
        id: 'industrial_station',
        name: 'Industrial Music Station',
        description: 'Transit Depot & Golden Horizon Bridge Span.',
        tracks: [],
      },
      village_station: {
        id: 'village_station',
        name: 'Village Music Station',
        description: 'Suburban Villas & Whispering Pines Village.',
        tracks: [],
      },
    };

    this.hydrateUploadedTracksFromIndexedDB();
  }

  private async hydrateUploadedTracksFromIndexedDB(): Promise<void> {
    const db = await openStationUploadsDb();
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as StoredUploadRecord[];
        if (!Array.isArray(records) || records.length === 0) return;

        const hydratedPids = new Set<AudioPlaylistId>();
        records.forEach((rec) => {
          if (!rec || !rec.blob || !rec.id) return;
          let pid: AudioPlaylistId = this.playlists[rec.playlistId]
            ? rec.playlistId
            : 'jamaica_city_station';

          // Migrate legacy stations to the new physical stations
          if (rec.playlistId === 'market_station' || rec.playlistId === 'cyber_city_station') {
            pid = 'cyber_city_station';
          } else if (
            rec.playlistId === 'downtown_station' ||
            rec.playlistId === 'beach_station' ||
            rec.playlistId === 'park_station' ||
            rec.playlistId === 'restaurant_station' ||
            rec.playlistId === 'residential_station' ||
            rec.playlistId === 'shopping_station' ||
            rec.playlistId === 'industrial_station' ||
            rec.playlistId === 'village_station' ||
            rec.playlistId === 'jamaica_city_station'
          ) {
            pid = 'jamaica_city_station';
          }

          if (this.playlists[pid].tracks.some((t) => t.id === rec.id)) return;

          const objectUrl = URL.createObjectURL(rec.blob);
          this.createdObjectUrls.add(objectUrl);

          const track: AudioTrack = {
            id: rec.id,
            title: rec.title || rec.fileName || 'Uploaded Song',
            fileName: rec.fileName || rec.title || 'uploaded_audio.mp3',
            fileType: rec.fileType || 'MP3',
            artist: rec.artist || 'Uploaded Audio',
            url: objectUrl,
            isUserUpload: true,
            playlistId: pid,
            durationSec: rec.durationSec,
            fileSize: rec.fileSize,
            mimeType: rec.mimeType,
            addedAt: rec.addedAt || Date.now(),
          };

          this.playlists[pid].tracks.push(track);
          hydratedPids.add(pid);

          if (!track.durationSec) {
            this.probeTrackDuration(track);
          }
        });

        if (hydratedPids.size > 0 && this.onUpdatedCallback) {
          this.onUpdatedCallback(Array.from(hydratedPids));
        }
      };
    } catch {
      // ignore IndexedDB read errors
    }
  }

  private async saveUploadRecordToIndexedDB(
    record: StoredUploadRecord
  ): Promise<void> {
    const db = await openStationUploadsDb();
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
    } catch {
      // ignore quota errors
    }
  }

  private async deleteUploadRecordFromIndexedDB(trackId: string): Promise<void> {
    const db = await openStationUploadsDb();
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(trackId);
    } catch {
      // ignore
    }
  }

  private async updateUploadRecordStationInIndexedDB(
    trackId: string,
    newStationId: AudioPlaylistId,
    durationSec?: number
  ): Promise<void> {
    const db = await openStationUploadsDb();
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(trackId);
      getReq.onsuccess = () => {
        const existing = getReq.result as StoredUploadRecord | undefined;
        if (existing) {
          store.put({
            ...existing,
            playlistId: newStationId,
            durationSec: durationSec ?? existing.durationSec,
          });
        }
      };
    } catch {
      // ignore
    }
  }

  private probeTrackDuration(track: AudioTrack): void {
    if (typeof window === 'undefined' || !track.url) return;
    try {
      const probe = new Audio();
      probe.preload = 'metadata';
      const cleanup = () => {
        probe.removeAttribute('src');
      };
      probe.onloadedmetadata = () => {
        if (Number.isFinite(probe.duration) && probe.duration > 0) {
          track.durationSec = Math.round(probe.duration);
          this.updateUploadRecordStationInIndexedDB(
            track.id,
            track.playlistId,
            track.durationSec
          );
          if (this.onUpdatedCallback) {
            this.onUpdatedCallback();
          }
        }
        cleanup();
      };
      probe.onerror = () => cleanup();
      probe.src = track.url;
    } catch {
      // ignore
    }
  }

  public getPlaylists(): Record<AudioPlaylistId, AudioPlaylist> {
    const copy = {} as Record<AudioPlaylistId, AudioPlaylist>;
    (Object.keys(this.playlists) as AudioPlaylistId[]).forEach((pid) => {
      copy[pid] = {
        ...this.playlists[pid],
        tracks: [...this.playlists[pid].tracks],
      };
    });
    return copy;
  }

  public getPlaylist(id: AudioPlaylistId): AudioPlaylist {
    return this.playlists[id] || this.playlists.downtown_station;
  }

  public isValidAudioFile(file: File): { valid: boolean; reason?: string } {
    if (!file) return { valid: false, reason: 'No file provided.' };
    if (file.size <= 0) return { valid: false, reason: `"${file.name}" is empty.` };
    if (file.size > MAX_SAFE_FILE_BYTES) {
      return { valid: false, reason: `"${file.name}" exceeds 250MB limit.` };
    }

    const lowerName = file.name.toLowerCase();
    const hasValidExt = SUPPORTED_AUDIO_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );
    const hasAudioMime =
      file.type.startsWith('audio/') ||
      file.type === 'video/mp4' ||
      file.type === 'video/webm';

    if (!hasValidExt && !hasAudioMime) {
      return {
        valid: false,
        reason: `"${file.name}" is not a supported audio format (.mp3, .wav, .ogg, .m4a).`,
      };
    }

    return { valid: true };
  }

  /**
   * Adds uploaded files ONLY to the target station's playlist (or Car Radio).
   * Never alters the file or adds it to other stations.
   */
  public addUploadedFiles(
    files: FileList | File[],
    targetStationId: AudioPlaylistId = 'downtown_station'
  ): { addedTracks: AudioTrack[]; errors: string[] } {
    const addedTracks: AudioTrack[] = [];
    const errors: string[] = [];
    const fileArray = Array.from(files);
    const safeStationId = this.playlists[targetStationId]
      ? targetStationId
      : 'downtown_station';

    fileArray.forEach((file, idx) => {
      const check = this.isValidAudioFile(file);
      if (!check.valid) {
        if (check.reason) errors.push(check.reason);
        return;
      }

      try {
        const objectUrl = URL.createObjectURL(file);
        this.createdObjectUrls.add(objectUrl);

        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[_-]+/g, ' ')
          .trim();

        const fileType = detectFileTypeLabel(file);
        const trackId = `user_track_${Date.now()}_${idx}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;

        const newTrack: AudioTrack = {
          id: trackId,
          title: cleanTitle || file.name,
          fileName: file.name,
          fileType,
          artist: 'Uploaded Audio',
          url: objectUrl,
          isUserUpload: true,
          playlistId: safeStationId,
          fileSize: file.size,
          mimeType: file.type || 'audio/mpeg',
          addedAt: Date.now() + idx,
        };

        this.playlists[safeStationId].tracks.push(newTrack);
        this.probeTrackDuration(newTrack);

        this.saveUploadRecordToIndexedDB({
          id: trackId,
          title: newTrack.title,
          fileName: newTrack.fileName,
          fileType: newTrack.fileType,
          artist: newTrack.artist,
          playlistId: safeStationId,
          fileSize: newTrack.fileSize,
          mimeType: newTrack.mimeType,
          addedAt: newTrack.addedAt,
          blob: file,
        });

        addedTracks.push(newTrack);
      } catch {
        errors.push(`Failed to load "${file.name}".`);
      }
    });

    return { addedTracks, errors };
  }

  public moveTrackToStation(
    trackId: string,
    fromStationId: AudioPlaylistId,
    toStationId: AudioPlaylistId
  ): boolean {
    if (fromStationId === toStationId) return false;
    const fromPl = this.playlists[fromStationId];
    const toPl = this.playlists[toStationId];
    if (!fromPl || !toPl) return false;

    const trackIndex = fromPl.tracks.findIndex((t) => t.id === trackId);
    if (trackIndex < 0) return false;

    const [track] = fromPl.tracks.splice(trackIndex, 1);
    const movedTrack: AudioTrack = {
      ...track,
      playlistId: toStationId,
    };

    if (!toPl.tracks.some((t) => t.id === trackId)) {
      toPl.tracks.push(movedTrack);
    }

    this.updateUploadRecordStationInIndexedDB(
      trackId,
      toStationId,
      movedTrack.durationSec
    );
    return true;
  }

  public removeTrackFromStation(
    trackId: string,
    stationId: AudioPlaylistId
  ): void {
    const pl = this.playlists[stationId];
    if (!pl) return;
    const found = pl.tracks.find((t) => t.id === trackId);
    pl.tracks = pl.tracks.filter((t) => t.id !== trackId);

    if (found) {
      this.deleteUploadRecordFromIndexedDB(trackId);
      const stillUsedElsewhere = (
        Object.keys(this.playlists) as AudioPlaylistId[]
      ).some((pid) =>
        this.playlists[pid].tracks.some((t) => t.url === found.url)
      );

      if (!stillUsedElsewhere && this.createdObjectUrls.has(found.url)) {
        try {
          URL.revokeObjectURL(found.url);
        } catch {
          // ignore
        }
        this.createdObjectUrls.delete(found.url);
      }
    }
  }

  public async uploadTrack(
    stationId: AudioPlaylistId,
    file: File
  ): Promise<AudioTrack | null> {
    const result = this.addUploadedFiles([file], stationId);
    if (result.addedTracks.length > 0) {
      return result.addedTracks[0];
    }
    return null;
  }

  public async deleteTrack(trackId: string): Promise<void> {
    (Object.keys(this.playlists) as AudioPlaylistId[]).forEach((pid) => {
      this.removeTrackFromStation(trackId, pid);
    });
  }

  public moveTrack(trackId: string, toStation: AudioPlaylistId): void {
    (Object.keys(this.playlists) as AudioPlaylistId[]).forEach((pid) => {
      if (pid !== toStation && this.playlists[pid].tracks.some((t) => t.id === trackId)) {
        this.moveTrackToStation(trackId, pid, toStation);
      }
    });
  }

  /**
   * Continuous Track Selection (Song 1 -> Song 2 -> Song 3 -> Song 1)
   */
  public getNextTrack(
    playlistId: AudioPlaylistId,
    currentTrackId: string | null,
    order: PlaybackOrder,
    direction: 'next' | 'prev' = 'next'
  ): AudioTrack | null {
    const list = this.getPlaylist(playlistId).tracks;
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];

    let history = this.recentHistoryByPlaylist.get(playlistId);
    if (!history) {
      history = [];
      this.recentHistoryByPlaylist.set(playlistId, history);
    }

    const currentIndex = currentTrackId
      ? list.findIndex((t) => t.id === currentTrackId)
      : -1;

    if (direction === 'prev') {
      if (order === 'shuffle' && history.length > 1) {
        history.pop();
        const prevId = history[history.length - 1];
        const foundPrev = list.find((t) => t.id === prevId);
        if (foundPrev) return foundPrev;
      }
      const prevIdx =
        currentIndex <= 0 ? list.length - 1 : (currentIndex - 1) % list.length;
      return list[prevIdx];
    }

    if (order === 'shuffle') {
      const nonCurrent = list.filter((t) => t.id !== currentTrackId);
      const maxRecentToAvoid = Math.max(
        1,
        Math.min(list.length - 1, Math.floor(list.length * 0.6))
      );
      const recentSet = new Set(history.slice(-maxRecentToAvoid));
      const freshCandidates = nonCurrent.filter((t) => !recentSet.has(t.id));
      const pool = freshCandidates.length > 0 ? freshCandidates : nonCurrent;

      const chosen =
        pool[Math.floor(Math.random() * pool.length)] ||
        nonCurrent[0] ||
        list[0];
      history.push(chosen.id);
      if (history.length > 30) {
        history.shift();
      }
      return chosen;
    }

    // Sequential mode: Song 1 -> Song 2 -> Song 3 -> Song 1 ...
    const nextIdx = currentIndex < 0 ? 0 : (currentIndex + 1) % list.length;
    const nextTrack = list[nextIdx];
    history.push(nextTrack.id);
    if (history.length > 30) {
      history.shift();
    }
    return nextTrack;
  }

  public disposeAllObjectUrls(): void {
    this.createdObjectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    this.createdObjectUrls.clear();
  }
}
