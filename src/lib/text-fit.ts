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

function plainTextFitsWidth(
  text: string,
  boxW: number,
  size: number,
  letterSpacing: number,
  measure: (text: string, size: number) => number,
) {
  if (size <= 0 || boxW <= 0) return true;
  for (const line of text.split("\n")) {
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
  _boxH: number,
  fontSize: number,
  letterSpacing: number,
  _lineHeight: number,
  measure: (text: string, size: number) => number,
  designed = "",
) {
  if (!isLongerThanDesigned(text, designed)) return false;
  return !plainTextFitsWidth(text, boxW, fontSize, letterSpacing, measure);
}

function longestLineWidth(
  text: string,
  size: number,
  letterSpacing: number,
  measure: (text: string, size: number) => number,
) {
  let widest = 0;
  for (const line of text.split("\n")) {
    widest = Math.max(widest, spacedWidth(line, size, letterSpacing, measure));
  }
  return widest;
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
  const innerW = Math.max(1, boxW);
  if (!text.trim() || max <= min) return max;
  if (!shouldShrinkPlainText(text, innerW, boxH, max, letterSpacing, lineHeight, measure, designed)) return max;
  const widthAtMax = longestLineWidth(text, max, letterSpacing, measure);
  if (widthAtMax <= 0) return max;
  return Math.max(min, Math.min(max, max * (innerW / widthAtMax)));
}
