const tagPrefix = (tag: string) => `[${tag}]`;

function sanitizeUri(uri: string): string {
  const idx = uri.lastIndexOf('/');
  return idx >= 0 ? `…${uri.slice(idx)}` : uri;
}

export function devLog(tag: string, message: string, data?: unknown): void {
  if (!__DEV__) return;
  if (data !== undefined) {
    console.log(tagPrefix(tag), message, data);
    return;
  }
  console.log(tagPrefix(tag), message);
}

export function devWarn(tag: string, message: string, data?: unknown): void {
  if (!__DEV__) return;
  if (data !== undefined) {
    console.warn(tagPrefix(tag), message, data);
    return;
  }
  console.warn(tagPrefix(tag), message);
}

export function logError(tag: string, message: string, err?: unknown): void {
  console.error(tagPrefix(tag), message, err);
}

export function logUri(tag: string, message: string, uri: string): void {
  devLog(tag, message, { uri: sanitizeUri(uri) });
}