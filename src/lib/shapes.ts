import type { ArrowKind, PolygonType } from "./document";

export function arrowPolygon(kind: ArrowKind, width: number, height: number): number[] {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);

  if (kind === "triangle") {
    return [0, 0, w, h / 2, 0, h];
  }

  if (kind === "pentagon") {
    return [0, 0, w * 0.62, 0, w, h / 2, w * 0.62, h, 0, h];
  }

  if (kind === "barbed") {
    const neck = w * 0.58;
    return [0, 0, neck, 0, w, h / 2, neck, h, 0, h, w * 0.2, h / 2];
  }

  if (kind === "chevron") {
    const t = Math.min(w * 0.38, h * 0.55);
    return [0, 0, t, 0, w, h / 2, t, h, 0, h, w - t, h / 2];
  }

  if (kind === "line") {
    const stem = Math.max(h * 0.18, 1);
    const head = Math.min(w * 0.42, h);
    return [
      0, h / 2 - stem,
      w - head, h / 2 - stem,
      w - head, 0,
      w, h / 2,
      w - head, h,
      w - head, h / 2 + stem,
      0, h / 2 + stem,
    ];
  }

  if (kind === "open") {
    const head = Math.min(w * 0.42, h);
    return [0, h / 2, w, h / 2, w - head, 0, w, h / 2, w - head, h];
  }

  const neck = w * 0.55;
  const stemTop = h * 0.28;
  const stemBot = h * 0.72;
  return [0, stemTop, neck, stemTop, neck, 0, w, h / 2, neck, h, neck, stemBot, 0, stemBot];
}

function starPoints(width: number, height: number, spikes = 5, inner = 0.4): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const points: number[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? 1 : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
    points.push(cx + Math.cos(angle) * (width / 2) * radius);
    points.push(cy + Math.sin(angle) * (height / 2) * radius);
  }
  return points;
}

function regularPolygon(width: number, height: number, sides: number, startAngle = -Math.PI / 2): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const points: number[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    points.push(cx + Math.cos(angle) * (width / 2));
    points.push(cy + Math.sin(angle) * (height / 2));
  }
  return points;
}

function plusPoints(width: number, height: number, thickness = 0.34): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const tw = (width * thickness) / 2;
  const th = (height * thickness) / 2;
  return [
    cx - tw, 0,
    cx + tw, 0,
    cx + tw, cy - th,
    width, cy - th,
    width, cy + th,
    cx + tw, cy + th,
    cx + tw, height,
    cx - tw, height,
    cx - tw, cy + th,
    0, cy + th,
    0, cy - th,
    cx - tw, cy - th,
  ];
}

function rotateAround(points: number[], cx: number, cy: number, radians: number): number[] {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] - cx;
    const y = points[i + 1] - cy;
    out.push(cx + x * cos - y * sin);
    out.push(cy + x * sin + y * cos);
  }
  return out;
}

function fitToBox(points: number[], width: number, height: number, pad = 0.02): number[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  const boxW = Math.max(maxX - minX, 1e-6);
  const boxH = Math.max(maxY - minY, 1e-6);
  const innerW = width * (1 - pad * 2);
  const innerH = height * (1 - pad * 2);
  const scale = Math.min(innerW / boxW, innerH / boxH);
  const ox = (width - boxW * scale) / 2;
  const oy = (height - boxH * scale) / 2;
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push((points[i] - minX) * scale + ox);
    out.push((points[i + 1] - minY) * scale + oy);
  }
  return out;
}

function doubleArrowPolygon(kind: ArrowKind, width: number, height: number): number[] {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const cy = h / 2;

  if (kind === "open") {
    const head = Math.min(w * 0.28, h * 0.95);
    return [
      head, 0,
      0, cy,
      head, h,
      0, cy,
      w, cy,
      w - head, 0,
      w, cy,
      w - head, h,
    ];
  }

  if (kind === "line") {
    const head = Math.min(w * 0.24, h);
    const stem = Math.max(h * 0.12, 1);
    return [
      0, cy,
      head, 0,
      head, cy - stem,
      w - head, cy - stem,
      w - head, 0,
      w, cy,
      w - head, h,
      w - head, cy + stem,
      head, cy + stem,
      head, h,
    ];
  }

  if (kind === "triangle") {
    const head = Math.min(w * 0.34, h);
    const stem = h * 0.2;
    return [
      0, cy,
      head, 0,
      head, cy - stem,
      w - head, cy - stem,
      w - head, 0,
      w, cy,
      w - head, h,
      w - head, cy + stem,
      head, cy + stem,
      head, h,
    ];
  }

  if (kind === "barbed") {
    const head = Math.min(w * 0.3, h * 0.95);
    const indent = head * 0.42;
    const stem = h * 0.28;
    return [
      0, cy,
      head, 0,
      head - indent, cy - stem,
      w - (head - indent), cy - stem,
      w - head, 0,
      w, cy,
      w - head, h,
      w - (head - indent), cy + stem,
      head - indent, cy + stem,
      head, h,
    ];
  }

  if (kind === "chevron") {
    const head = Math.min(w * 0.26, h * 0.95);
    const slant = head * 0.55;
    const stem = h * 0.28;
    return [
      0, cy,
      head, 0,
      head + slant, cy - stem,
      w - head - slant, cy - stem,
      w - head, 0,
      w, cy,
      w - head, h,
      w - head - slant, cy + stem,
      head + slant, cy + stem,
      head, h,
    ];
  }

  if (kind === "pentagon") {
    const head = Math.min(w * 0.3, h * 0.95);
    const flat = head * 0.42;
    const stem = h * 0.3;
    return [
      0, cy,
      flat, 0,
      head, 0,
      head, cy - stem,
      w - head, cy - stem,
      w - head, 0,
      w - flat, 0,
      w, cy,
      w - flat, h,
      w - head, h,
      w - head, cy + stem,
      head, cy + stem,
      head, h,
      flat, h,
    ];
  }

  const head = Math.min(w * 0.28, h * 0.9);
  const stemTop = h * 0.32;
  const stemBot = h * 0.68;
  return [
    0, cy,
    head, 0,
    head, stemTop,
    w - head, stemTop,
    w - head, 0,
    w, cy,
    w - head, h,
    w - head, stemBot,
    head, stemBot,
    head, h,
  ];
}

export function isStrokeArrow(kind: ArrowKind) {
  return kind === "open";
}

export function polygonPoints(
  kind: PolygonType,
  width: number,
  height: number,
  arrowKind: ArrowKind = "block",
): number[] {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);

  if (kind === "arrow") {
    return arrowPolygon(arrowKind, w, h);
  }

  if (kind === "doubleArrow") {
    return doubleArrowPolygon(arrowKind, w, h);
  }

  if (kind === "triangle") {
    return [w / 2, 0, w, h, 0, h];
  }

  if (kind === "diamond") {
    return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
  }

  if (kind === "star") {
    return starPoints(w, h);
  }

  if (kind === "hexagon") {
    return regularPolygon(w, h, 6, -Math.PI / 2);
  }

  if (kind === "plus") {
    return plusPoints(w, h);
  }

  return fitToBox(rotateAround(plusPoints(w, h), w / 2, h / 2, Math.PI / 4), w, h);
}

export function pointsToSvgPath(points: number[], closed = true): string {
  if (points.length < 4) return "";
  let path = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    path += ` L ${points[i]} ${points[i + 1]}`;
  }
  return closed ? `${path} Z` : path;
}
