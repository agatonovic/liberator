const FIT_PASSES = 14;
const MIN_SHRINK_CHARS = 8;

function spacedWidth(text: string, size: number, letterSpacing: number, measure: (text: string, size: number) => number) {
  if (!text) return 0;
  return measure(text, size) + letterSpacing * Math.max(0, text.length - 1);
}

export function wrapPlainLines(
  text: string,
  maxWidth: number,
  size: number,
  letterSpacing: number,
  measure: (text: string, size: number) => number,
): string[] {
  const widthOf = (value: string) => spacedWidth(value, size, letterSpacing, measure);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (!current || widthOf(next) <= maxWidth) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function plainTextFits(
  text: string,
  boxW: number,
  boxH: number,
  size: number,
  letterSpacing: number,
  lineHeight: number,
  measure: (text: string, size: number) => number,
) {
  if (size <= 0 || boxW <= 0 || boxH <= 0) return true;
  const lines = wrapPlainLines(text, boxW, size, letterSpacing, measure);
  if (lines.length * size * lineHeight > boxH) return false;
  for (const line of lines) {
    if (spacedWidth(line, size, letterSpacing, measure) > boxW) return false;
  }
  return true;
}

function compactLength(text: string) {
  return text.replace(/\s/g, "").length;
}

export function isLongerThanDesigned(text: string, designed: string) {
  const live = compactLength(text);
  const sample = compactLength(designed);
  if (!sample) return live >= MIN_SHRINK_CHARS;
  return live > sample;
}

export function shouldShrinkPlainText(
  text: string,
  boxW: number,
  boxH: number,
  fontSize: number,
  letterSpacing: number,
  lineHeight: number,
  measure: (text: string, size: number) => number,
  designed = "",
) {
  if (!isLongerThanDesigned(text, designed)) return false;
  if (plainTextFits(text, boxW, boxH, fontSize, letterSpacing, lineHeight, measure)) return false;
  const lines = wrapPlainLines(text, boxW, fontSize, letterSpacing, measure);
  if (lines.length > 1 && lines.length * fontSize * lineHeight > boxH) return true;
  const longest = lines.reduce((max, line) => Math.max(max, compactLength(line)), 0);
  return longest >= MIN_SHRINK_CHARS;
}

export function fitPlainFontSize({
  text,
  designed = "",
  boxW,
  boxH,
  fontSize,
  minFontSize,
  letterSpacing,
  lineHeight,
  measure,
}: {
  text: string;
  designed?: string;
  boxW: number;
  boxH: number;
  fontSize: number;
  minFontSize: number;
  letterSpacing: number;
  lineHeight: number;
  measure: (text: string, size: number) => number;
}) {
  const max = Math.max(0, fontSize);
  const min = Math.min(max, Math.max(0.5, minFontSize));
  const innerW = Math.max(1, boxW - Math.max(2, boxW * 0.02));
  const innerH = Math.max(1, boxH - 1);
  if (!text.trim() || max <= min) return max;
  if (!shouldShrinkPlainText(text, innerW, innerH, max, letterSpacing, lineHeight, measure, designed)) return max;
  let lo = min;
  let hi = max;
  for (let i = 0; i < FIT_PASSES; i += 1) {
    const mid = (lo + hi) / 2;
    if (plainTextFits(text, innerW, innerH, mid, letterSpacing, lineHeight, measure)) lo = mid;
    else hi = mid;
  }
  return lo;
}
