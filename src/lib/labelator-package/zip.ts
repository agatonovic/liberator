import { crc32 } from "./hash";

export type ZipEntry = { path: string; data: Uint8Array };

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function u16(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, value, true);
  return buf;
}

function u32(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value >>> 0, true);
  return buf;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Fixed DOS datetime for deterministic ZIP bytes (2026-09-05 00:00:00). */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 5;

/**
 * Store-only ZIP (no compression). Paths use forward slashes.
 * Suitable for `.labelator` packages without adding a zip dependency.
 */
export function buildStoreZip(entries: ZipEntry[]): Uint8Array {
  const normalized = entries
    .map((entry) => ({
      path: entry.path.replace(/\\/g, "/").replace(/^\/+/, ""),
      data: entry.data,
    }))
    .filter((entry) => entry.path.length > 0)
    .sort((a, b) => a.path.localeCompare(b.path));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of normalized) {
    const name = encodeUtf8(entry.path);
    const checksum = crc32(entry.data);
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(DOS_TIME),
      u16(DOS_DATE),
      u32(checksum),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, entry.data);

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(DOS_TIME),
      u16(DOS_DATE),
      u32(checksum),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    centralParts.push(central);
    offset += localHeader.length + entry.data.length;
  }

  const centralDir = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(normalized.length),
    u16(normalized.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...localParts, centralDir, end]);
}

type ParsedZipEntry = { path: string; data: Uint8Array; compression: number };

/** Read store-only (and deflate-unsupported) ZIP entries produced by buildStoreZip. */
export function readStoreZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ParsedZipEntry[] = [];
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header at offset ${offset}`);
    }
    const compression = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const data = bytes.subarray(dataStart, dataStart + compSize);
    if (compression !== 0) {
      throw new Error(`Unsupported ZIP compression ${compression} for ${name} (store-only packages required)`);
    }
    entries.push({ path: name, data: Uint8Array.from(data), compression });
    offset = dataStart + compSize;
  }

  const map = new Map<string, Uint8Array>();
  for (const entry of entries) map.set(entry.path.replace(/\\/g, "/"), entry.data);
  return map;
}
