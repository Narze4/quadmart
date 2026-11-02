import { v2 as cloudinary } from 'cloudinary';
import { MAX_RECOVERY_PHOTO_BYTES, requireValid } from './recovery-schema.mjs';

export function photoDownloader(storage) {
  requireValid(storage.cloud_name === 'digi5pklj' && storage.api_key && storage.api_secret, 'Restricted development storage required');
  return async publicId => {
    requireValid(/^quadmart\/quadmart-development\/[a-f0-9]{24}\/[a-f0-9]{64}$/.test(publicId), 'Photo download outside development scope');
    const url = cloudinary.utils.private_download_url(publicId, 'jpg', { ...storage, type: 'authenticated', resource_type: 'image', secure: true, expires_at: Math.floor(Date.now()/1000) + 300 });
    const target = new URL(url);
    requireValid(target.protocol === 'https:' && target.hostname === 'api.cloudinary.com' && target.pathname === '/v1_1/digi5pklj/image/download', 'Unexpected download destination');
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (response.status === 404) return { missing: true };
    requireValid(response.ok && Number(response.headers.get('content-length') ?? 0) <= MAX_RECOVERY_PHOTO_BYTES, 'Photo download failed');
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        bytes += next.value.length;
        if (bytes > MAX_RECOVERY_PHOTO_BYTES) { await reader.cancel(); throw new Error('Photo download too large'); }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    return { missing: false, bytes: Buffer.concat(chunks, bytes) };
  };
}
