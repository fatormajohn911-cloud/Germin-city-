import {
  AudioPlaylist,
  AudioPlaylistId,
  AudioTrack,
  PlaybackOrder,
} from './AudioTypes';
import {
  getBuiltInAmbientTracks,
  getBuiltInRadioTracks,
} from './ProceduralAudioSynthesizer';

const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.flac',
  '.webm',
  '.opus',
  '.mp4',
];

const MAX_SAFE_FILE_BYTES = 180 * 1024 * 1024; // 180 MB safety limit

export class PlaylistManager {
  private playlists: Record<AudioPlaylistId, AudioPlaylist>;
  private createdObjectUrls: Set<string> = new Set();
  private shuffleHistory: string[] = [];

  constructor() {
    this.playlists = {
      car_radio: {
        id: 'car_radio',
        name: 'CAR RADIO (FM 104.9 + Uploads)',
        description: 'Gemini City Car & Bus Radio playlist with built-in synthwave & your uploaded songs.',
        tracks: [...getBuiltInRadioTracks()],
      },
      custom_radio: {
        id: 'custom_radio',
        name: 'MY UPLOADED MUSIC',
        description: 'Your personal uploaded device tracks (.mp3, .wav, .ogg, .m4a).',
        tracks: [],
      },
      world_ambience: {
        id: 'world_ambience',
        name: 'WORLD AMBIENT MUSIC',
        description: 'Peaceful open-world ambient music tracks that fade in and out naturally.',
        tracks: [...getBuiltInAmbientTracks()],
      },
    };
  }

  public getPlaylists(): Record<AudioPlaylistId, AudioPlaylist> {
    return {
      car_radio: {
        ...this.playlists.car_radio,
        tracks: [...this.playlists.car_radio.tracks],
      },
      custom_radio: {
        ...this.playlists.custom_radio,
        tracks: [...this.playlists.custom_radio.tracks],
      },
      world_ambience: {
        ...this.playlists.world_ambience,
        tracks: [...this.playlists.world_ambience.tracks],
      },
    };
  }

  public getPlaylist(id: AudioPlaylistId): AudioPlaylist {
    return this.playlists[id] || this.playlists.car_radio;
  }

  public validateAudioFile(file: File): { valid: boolean; reason?: string } {
    if (!file) {
      return { valid: false, reason: 'Empty file.' };
    }
    const lowerName = file.name.toLowerCase();
    const hasValidExt = SUPPORTED_AUDIO_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );
    const hasAudioMime = file.type.startsWith('audio/') || file.type === 'video/mp4' || file.type === 'video/webm';

    if (!hasValidExt && !hasAudioMime) {
      return {
        valid: false,
        reason: `Unsupported file format "${file.name}". Please choose .mp3, .wav, .ogg, or .m4a.`,
      };
    }

    if (file.size > MAX_SAFE_FILE_BYTES) {
      return {
        valid: false,
        reason: `File "${file.name}" exceeds the 180MB browser memory safety limit.`,
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        reason: `File "${file.name}" is empty (0 bytes).`,
      };
    }

    return { valid: true };
  }

  public addUploadedFiles(
    files: FileList | File[],
    targetPlaylistId: AudioPlaylistId = 'car_radio'
  ): { addedTracks: AudioTrack[]; errors: string[] } {
    const fileArray = Array.from(files);
    const addedTracks: AudioTrack[] = [];
    const errors: string[] = [];

    fileArray.forEach((file, idx) => {
      const check = this.validateAudioFile(file);
      if (!check.valid) {
        if (check.reason) errors.push(check.reason);
        return;
      }

      try {
        const objectUrl = URL.createObjectURL(file);
        this.createdObjectUrls.add(objectUrl);

        // Clean display title from filename
        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[_-]+/g, ' ')
          .trim();

        const newTrack: AudioTrack = {
          id: `user_track_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
          title: cleanTitle || file.name,
          artist: 'Uploaded Device Track',
          url: objectUrl,
          isUserUpload: true,
          isBuiltIn: false,
          playlistId: targetPlaylistId,
          fileSize: file.size,
          mimeType: file.type || 'audio/mpeg',
          addedAt: Date.now() + idx,
        };

        this.playlists[targetPlaylistId].tracks.push(newTrack);

        // If user uploaded into car_radio, also mirror in custom_radio for convenience (sharing same objectUrl)
        if (targetPlaylistId === 'car_radio') {
          this.playlists.custom_radio.tracks.push({
            ...newTrack,
            playlistId: 'custom_radio',
          });
        } else if (targetPlaylistId === 'custom_radio') {
          this.playlists.car_radio.tracks.push({
            ...newTrack,
            playlistId: 'car_radio',
          });
        }

        addedTracks.push(newTrack);
      } catch {
        errors.push(`Failed to load "${file.name}".`);
      }
    });

    return { addedTracks, errors };
  }

  public removeTrack(trackId: string): void {
    let urlToMaybeRevoke: string | null = null;
    (Object.keys(this.playlists) as AudioPlaylistId[]).forEach((pid) => {
      const found = this.playlists[pid].tracks.find((t) => t.id === trackId);
      if (found && found.isUserUpload) {
        urlToMaybeRevoke = found.url;
      }
      this.playlists[pid].tracks = this.playlists[pid].tracks.filter(
        (t) => t.id !== trackId
      );
    });

    if (urlToMaybeRevoke && this.createdObjectUrls.has(urlToMaybeRevoke)) {
      const stillUsed = (Object.keys(this.playlists) as AudioPlaylistId[]).some((pid) =>
        this.playlists[pid].tracks.some((t) => t.url === urlToMaybeRevoke)
      );
      if (!stillUsed) {
        try {
          URL.revokeObjectURL(urlToMaybeRevoke);
        } catch {
          // ignore
        }
        this.createdObjectUrls.delete(urlToMaybeRevoke);
      }
    }
  }

  public clearPlaylistTracks(playlistId: AudioPlaylistId): void {
    const tracks = this.playlists[playlistId]?.tracks || [];
    tracks.forEach((t) => {
      if (t.isUserUpload && this.createdObjectUrls.has(t.url)) {
        try {
          URL.revokeObjectURL(t.url);
        } catch {
          // ignore
        }
        this.createdObjectUrls.delete(t.url);
      }
    });
    if (this.playlists[playlistId]) {
      this.playlists[playlistId].tracks = [];
    }
  }

  public restoreDefaultTracks(): void {
    const existingUploads = this.playlists.car_radio.tracks.filter((t) => t.isUserUpload);
    this.playlists.car_radio.tracks = [...getBuiltInRadioTracks(), ...existingUploads];
    const existingAmbUploads = this.playlists.world_ambience.tracks.filter((t) => t.isUserUpload);
    this.playlists.world_ambience.tracks = [...getBuiltInAmbientTracks(), ...existingAmbUploads];
  }

  public getNextTrack(
    playlistId: AudioPlaylistId,
    currentTrackId: string | null,
    order: PlaybackOrder,
    direction: 'next' | 'prev' = 'next'
  ): AudioTrack | null {
    const list = this.playlists[playlistId]?.tracks || [];
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];

    const currentIndex = currentTrackId
      ? list.findIndex((t) => t.id === currentTrackId)
      : -1;

    if (order === 'shuffle' && direction === 'next') {
      const candidates = list.filter((t) => t.id !== currentTrackId);
      const chosen =
        candidates[Math.floor(Math.random() * candidates.length)] || list[0];
      this.shuffleHistory.push(chosen.id);
      if (this.shuffleHistory.length > 25) {
        this.shuffleHistory.shift();
      }
      return chosen;
    }

    if (direction === 'prev') {
      if (order === 'shuffle' && this.shuffleHistory.length > 1) {
        this.shuffleHistory.pop();
        const prevId = this.shuffleHistory[this.shuffleHistory.length - 1];
        const foundPrev = list.find((t) => t.id === prevId);
        if (foundPrev) return foundPrev;
      }
      const prevIdx =
        currentIndex <= 0 ? list.length - 1 : (currentIndex - 1) % list.length;
      return list[prevIdx];
    }

    const nextIdx = currentIndex < 0 ? 0 : (currentIndex + 1) % list.length;
    return list[nextIdx];
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
