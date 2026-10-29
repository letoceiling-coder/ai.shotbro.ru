/** Stable, non-public playback reference stored in message blocks (client resolves via Asset API). */
export const SHOTBRO_ASSET_PLAYBACK_PREFIX = "shotbro-asset://";

export function assetPlaybackRef(assetId: string): string {
  return `${SHOTBRO_ASSET_PLAYBACK_PREFIX}${assetId}`;
}

export function parseAssetPlaybackRef(url: string): string | null {
  if (!url.startsWith(SHOTBRO_ASSET_PLAYBACK_PREFIX)) return null;
  const id = url.slice(SHOTBRO_ASSET_PLAYBACK_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
