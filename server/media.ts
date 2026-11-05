import { randomUUID } from 'crypto';
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { DATA_DIR } from './pool';

// Uploaded pictures live next to the pool in DATA_DIR/images and are served
// under /media/<uuid>.<ext>. The random names give nothing away.
const IMAGE_DIR = path.join(DATA_DIR, 'images');
const MAX_IMAGE = 10 * 1024 * 1024;

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};
const EXT_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };

export function isMediaRequest(url: string): boolean {
  return url.startsWith('/media/');
}

export function serveMedia(req: IncomingMessage, res: ServerResponse) {
  const match = (req.url ?? '').match(/^\/media\/([a-f0-9-]+)\.(jpg|jpeg|png|webp|gif|avif)$/);
  const file = match && path.join(IMAGE_DIR, `${match[1]}.${match[2]}`);
  let size = 0;
  try {
    size = file ? statSync(file).size : 0;
  } catch {
    size = 0;
  }
  if (!file || !size) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': EXT_TYPES[match![2]],
    'Content-Length': size,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(res);
}

// Stores the raw request body as an image. Returns its /media path.
export function saveImage(req: IncomingMessage): Promise<{ url: string } | { error: string }> {
  const ext = TYPES[(req.headers['content-type'] ?? '').split(';')[0].trim()];
  if (!ext) return Promise.resolve({ error: 'Nur JPG, PNG, WebP, GIF oder AVIF' });
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_IMAGE) {
        resolve({ error: 'Bild ist größer als 10 MB' });
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (size === 0) return resolve({ error: 'Leere Datei' });
      mkdirSync(IMAGE_DIR, { recursive: true });
      const name = `${randomUUID()}.${ext}`;
      writeFileSync(path.join(IMAGE_DIR, name), Buffer.concat(chunks));
      resolve({ url: `/media/${name}` });
    });
    req.on('error', () => resolve({ error: 'Upload abgebrochen' }));
  });
}
