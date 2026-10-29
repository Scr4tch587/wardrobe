const MEDIA_PATH = /^(items|fits)\/[\w-]+\/[0-9a-f-]{36}-(480|1600)\.(webp|jpg)$/;

export function isMediaPath(path: string): boolean {
  return MEDIA_PATH.test(path);
}

export function fitPicDate(path: string): string | null {
  if (!path.startsWith("fits/")) return null;
  return path.split("/")[1] ?? null;
}

export async function deleteImage(env: Env, key: string | null, ext: string | null): Promise<void> {
  if (!key || !ext) return;
  await Promise.all([
    env.MEDIA.delete(`${key}-480.${ext}`),
    env.MEDIA.delete(`${key}-1600.${ext}`),
  ]);
}

export function contentTypeFor(ext: string): string {
  return ext === "jpg" ? "image/jpeg" : "image/webp";
}

export function sniffImage(bytes: Uint8Array): "webp" | "jpg" | null {
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}
