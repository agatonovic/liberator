/** Designed FIXED-GA style: `73 579 863 30` (10) or `73 579 863 301` (11). */
export function looksLikeGroupedPartNumber(content: string) {
  return /^\d{2}\s+\d{3}\s+\d{3}\s+\d{2,3}$/.test(content.trim());
}

export function formatPartNumber(value: string): string {
  const text = value.trim();
  if (!text) return "";

  const spaced = text.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  if (spaced.length === 4) return spaced.join(" ");

  let digits = text.replace(/\D/g, "");
  if (digits.length === 9) digits = `0${digits}`;
  if (digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return text;
}

export function partNumberGroups(value: string): [string, string, string, string] {
  const parts = formatPartNumber(value).split(/\s+/);
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? "", parts[3] ?? ""];
}

/** If a part-number slot is edited as a full code, stop slicing it to one group. */
export function releasePartSplit(content: string): boolean {
  return content.trim().split(/\s+/).filter(Boolean).length > 1;
}

export const GA_PREFIX_RED = "#FF0000";

/** Seagull `leading_prefix: R` — paint a leading R red when the magacin value starts with R. */
export function gaMagacinPrefixSpans(
  value: string,
  existing?: { start: number; end: number; fill?: string; fontSizeMm?: number }[],
) {
  const spans = existing ? [...existing] : [];
  if (value.length > 1 && value[0].toUpperCase() === "R") {
    spans.push({ start: 0, end: 1, fill: GA_PREFIX_RED });
  }
  return spans;
}

export function parseGaAddress(address: string): {
  magacin: string;
  regalLetter: string;
  regalNumber: string;
  nivo: string;
} {
  const raw = address.trim().replace(/%+$/, "");
  if (!raw) return { magacin: "", regalLetter: "", regalNumber: "", nivo: "" };
  const parts = raw.split(".");
  if (parts.length !== 3) {
    return { magacin: raw, regalLetter: "", regalNumber: "", nivo: "" };
  }
  const [head, shelf, level] = parts.map((part) => part.trim());
  if (head && /[A-Za-z]$/.test(head)) {
    return {
      magacin: head.slice(0, -1),
      regalLetter: head.slice(-1).toUpperCase(),
      regalNumber: shelf,
      nivo: level,
    };
  }
  return { magacin: head, regalLetter: "", regalNumber: shelf, nivo: level };
}

export function parseArrow(value: string): "UP" | "DOWN" | null {
  const text = value.trim().toUpperCase();
  if (!text) return null;
  if (["UP", "↑", "▲", "U", "GORE"].includes(text)) return "UP";
  if (["DOWN", "↓", "▼", "D", "DOLJE"].includes(text)) return "DOWN";
  return "DOWN";
}

export function normalizeArrow(value: string): "UP" | "DOWN" {
  return parseArrow(value) ?? "DOWN";
}

export function arrowSymbol(value: string): string {
  return normalizeArrow(value) === "UP" ? "▲" : "▼";
}
