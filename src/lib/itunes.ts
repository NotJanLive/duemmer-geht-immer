'use client';

import { SongItem } from '@/types/pool';

// Song search straight from the browser against Apple's iTunes Search API
// (free, no login, CORS open). Each player searches from their own IP, so the
// API's rate limit (about 20 requests a minute) is per person, not per show.

export type SongHit = Omit<SongItem, 'offset'>;

const cache = new Map<string, Promise<SongHit[]>>();

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  previewUrl?: string;
  kind?: string;
}

export function searchSongs(term: string): Promise<SongHit[]> {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return Promise.resolve([]);
  if (!cache.has(q)) {
    const url = `https://itunes.apple.com/search?${new URLSearchParams({ term: q, entity: 'song', limit: '12', country: 'DE' })}`;
    cache.set(
      q,
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { results: ItunesTrack[] }) =>
          d.results
            .filter((t) => t.kind === 'song' && t.previewUrl)
            .map((t) => ({
              trackId: t.trackId,
              title: t.trackName,
              artist: t.artistName,
              cover: (t.artworkUrl100 ?? '').replace('100x100', '300x300'),
              preview: t.previewUrl!,
            })),
        )
        .catch((err) => {
          cache.delete(q);
          throw err;
        }),
    );
  }
  return cache.get(q)!;
}
