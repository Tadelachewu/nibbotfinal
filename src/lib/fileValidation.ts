const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

export function getAllowedImageType(mimeType: string): string | undefined {
  return ALLOWED_IMAGE_TYPES.get(mimeType.toLowerCase());
}

export function isAllowedImageExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return !ext || ALLOWED_EXTENSIONS.has(ext);
}

export function hasPngSignature(bytes: Buffer): boolean {
  return bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
}

export function hasJpegSignature(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function hasGifSignature(bytes: Buffer): boolean {
  if (bytes.length < 6) return false;
  const header = bytes.subarray(0, 6).toString('ascii');
  return header === 'GIF87a' || header === 'GIF89a';
}

export function hasWebpSignature(bytes: Buffer): boolean {
  return bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

export function hasValidImageSignature(ext: string, bytes: Buffer): boolean {
  switch (ext) {
    case 'png': return hasPngSignature(bytes);
    case 'jpg': case 'jpeg': return hasJpegSignature(bytes);
    case 'gif': return hasGifSignature(bytes);
    case 'webp': return hasWebpSignature(bytes);
    default: return false;
  }
}

export function detectImageType(bytes: Buffer): string | null {
  if (hasPngSignature(bytes)) return 'png';
  if (hasJpegSignature(bytes)) return 'jpg';
  if (hasWebpSignature(bytes)) return 'webp';
  if (hasGifSignature(bytes)) return 'gif';
  return null;
}

export function hasAnyImageSignature(bytes: Buffer): boolean {
  return detectImageType(bytes) !== null;
}
