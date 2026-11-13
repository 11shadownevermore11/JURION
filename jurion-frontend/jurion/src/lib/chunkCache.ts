import { api } from "../api/client";
import type { SourceChunk } from "../api/types";

// Фрагменты неизменны в пределах снимка, поэтому кэшируем по snapshot+chunk.
const cache = new Map<string, Promise<SourceChunk>>();
const originals = new Map<string, Promise<string>>();

export function loadChunk(snapshotId: string, chunkId: string): Promise<SourceChunk> {
  const key = `${snapshotId}/${chunkId}`;
  let p = cache.get(key);
  if (!p) {
    p = api.getChunk(snapshotId, chunkId);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export function loadOriginal(url: string): Promise<string> {
  let p = originals.get(url);
  if (!p) {
    p = api.getOriginalText(url);
    originals.set(url, p);
    p.catch(() => originals.delete(url));
  }
  return p;
}
