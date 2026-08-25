import { formatMm, roundMm } from "./units";
import { isHorizontalLine, type LabelElement } from "./document";

export type GuideBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AlignMark = {
  kind: "align";
  axis: "x" | "y";
  at: number;
  start: number;
  end: number;
};

export type GapMark = {
  kind: "gap";
  axis: "x" | "y";
  start: number;
  end: number;
  along: number;
  equal: boolean;
};

export type GuideMark = AlignMark | GapMark;

export type GuideResult = {
  x: number;
  y: number;
  marks: GuideMark[];
};

type Snap = {
  pos: number;
  dist: number;
  priority: number;
};

function left(b: GuideBox) {
  return b.x;
}
function right(b: GuideBox) {
  return b.x + b.w;
}
function top(b: GuideBox) {
  return b.y;
}
function bottom(b: GuideBox) {
  return b.y + b.h;
}
function cx(b: GuideBox) {
  return b.x + b.w / 2;
}
function cy(b: GuideBox) {
  return b.y + b.h / 2;
}

function overlapRange(a0: number, a1: number, b0: number, b1: number, pad: number) {
  return a0 < b1 + pad && b0 < a1 + pad;
}

function relatedY(a: GuideBox, b: GuideBox) {
  return overlapRange(top(a), bottom(a), top(b), bottom(b), 6);
}

function relatedX(a: GuideBox, b: GuideBox) {
  return overlapRange(left(a), right(a), left(b), right(b), 6);
}

function overlapAlong(a0: number, a1: number, b0: number, b1: number) {
  const start = Math.max(a0, b0);
  const end = Math.min(a1, b1);
  if (end - start > 0.2) return (start + end) / 2;
  return (a0 + a1) / 2;
}

function artboardBoxes(page: { width: number; height: number }): GuideBox[] {
  const wall = 10_000;
  return [
    { id: "__artboard-left__", x: -wall, y: 0, w: wall, h: page.height },
    { id: "__artboard-right__", x: page.width, y: 0, w: wall, h: page.height },
    { id: "__artboard-top__", x: 0, y: -wall, w: page.width, h: wall },
    { id: "__artboard-bottom__", x: 0, y: page.height, w: page.width, h: wall },
  ];
}

function nearestLeft(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    if (!relatedY(moving, other)) continue;
    const edge = right(other);
    if (edge > left(moving) + 0.05) continue;
    if (!best || edge > right(best)) best = other;
  }
  return best;
}

function nearestRight(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    if (!relatedY(moving, other)) continue;
    const edge = left(other);
    if (edge < right(moving) - 0.05) continue;
    if (!best || edge < left(best)) best = other;
  }
  return best;
}

function nearestTop(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    if (!relatedX(moving, other)) continue;
    const edge = bottom(other);
    if (edge > top(moving) + 0.05) continue;
    if (!best || edge > bottom(best)) best = other;
  }
  return best;
}

function nearestBottom(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    if (!relatedX(moving, other)) continue;
    const edge = top(other);
    if (edge < bottom(moving) - 0.05) continue;
    if (!best || edge < top(best)) best = other;
  }
  return best;
}

function pickSnap(snaps: Snap[], current: number) {
  if (!snaps.length) return current;
  snaps.sort((a, b) => a.dist - b.dist || a.priority - b.priority);
  return roundMm(snaps[0].pos);
}

function addSnap(snaps: Snap[], current: number, next: number, threshold: number, priority: number) {
  const dist = Math.abs(next - current);
  if (dist > threshold) return;
  snaps.push({ pos: next, dist, priority });
}

function collectXSnaps(
  moving: GuideBox,
  others: GuideBox[],
  page: { width: number; height: number },
  threshold: number,
) {
  const snaps: Snap[] = [];
  const leftN = nearestLeft(moving, others);
  const rightN = nearestRight(moving, others);
  if (leftN && rightN) {
    const span = left(rightN) - right(leftN);
    if (span > moving.w + 0.05) {
      addSnap(snaps, moving.x, right(leftN) + (span - moving.w) / 2, threshold, 0);
    }
  }
  addSnap(snaps, moving.x, (page.width - moving.w) / 2, threshold, 1);
  addSnap(snaps, moving.x, 0, threshold, 3);
  addSnap(snaps, moving.x, page.width - moving.w, threshold, 3);
  for (const other of others) {
    if (other.id.startsWith("__artboard-")) continue;
    addSnap(snaps, moving.x, other.x, threshold, 2);
    addSnap(snaps, moving.x, right(other) - moving.w, threshold, 2);
    addSnap(snaps, moving.x, cx(other) - moving.w / 2, threshold, 1);
    addSnap(snaps, moving.x, right(other), threshold, 2);
    addSnap(snaps, moving.x, left(other) - moving.w, threshold, 2);
  }
  return pickSnap(snaps, moving.x);
}

function collectYSnaps(
  moving: GuideBox,
  others: GuideBox[],
  page: { width: number; height: number },
  threshold: number,
) {
  const snaps: Snap[] = [];
  const topN = nearestTop(moving, others);
  const bottomN = nearestBottom(moving, others);
  if (topN && bottomN) {
    const span = top(bottomN) - bottom(topN);
    if (span > moving.h + 0.05) {
      addSnap(snaps, moving.y, bottom(topN) + (span - moving.h) / 2, threshold, 0);
    }
  }
  addSnap(snaps, moving.y, (page.height - moving.h) / 2, threshold, 1);
  addSnap(snaps, moving.y, 0, threshold, 3);
  addSnap(snaps, moving.y, page.height - moving.h, threshold, 3);
  for (const other of others) {
    if (other.id.startsWith("__artboard-")) continue;
    addSnap(snaps, moving.y, other.y, threshold, 2);
    addSnap(snaps, moving.y, bottom(other) - moving.h, threshold, 2);
    addSnap(snaps, moving.y, cy(other) - moving.h / 2, threshold, 1);
    addSnap(snaps, moving.y, bottom(other), threshold, 2);
    addSnap(snaps, moving.y, top(other) - moving.h, threshold, 2);
  }
  return pickSnap(snaps, moving.y);
}

function gapMark(
  axis: "x" | "y",
  start: number,
  end: number,
  along: number,
  opposite: number | null,
): GapMark | null {
  const size = end - start;
  if (size < -0.05) return null;
  const span = Math.max(0, size);
  const equal = opposite !== null && Math.abs(span - opposite) <= 0.15;
  return { kind: "gap", axis, start, end: start + span, along, equal };
}

function alignMark(
  axis: "x" | "y",
  at: number,
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): AlignMark {
  return {
    kind: "align",
    axis,
    at,
    start: Math.min(a0, b0) - 2,
    end: Math.max(a1, b1) + 2,
  };
}

function marksFor(moving: GuideBox, others: GuideBox[], page: { width: number; height: number }): GuideMark[] {
  const marks: GuideMark[] = [];
  const leftN = nearestLeft(moving, others);
  const rightN = nearestRight(moving, others);
  const topN = nearestTop(moving, others);
  const bottomN = nearestBottom(moving, others);

  const leftGap = leftN ? left(moving) - right(leftN) : null;
  const rightGap = rightN ? left(rightN) - right(moving) : null;
  const topGap = topN ? top(moving) - bottom(topN) : null;
  const bottomGap = bottomN ? top(bottomN) - bottom(moving) : null;

  if (leftN && leftGap !== null) {
    const mark = gapMark("x", right(leftN), left(moving), overlapAlong(top(moving), bottom(moving), top(leftN), bottom(leftN)), rightGap);
    if (mark) marks.push(mark);
  }
  if (rightN && rightGap !== null) {
    const mark = gapMark("x", right(moving), left(rightN), overlapAlong(top(moving), bottom(moving), top(rightN), bottom(rightN)), leftGap);
    if (mark) marks.push(mark);
  }
  if (topN && topGap !== null) {
    const mark = gapMark("y", bottom(topN), top(moving), overlapAlong(left(moving), right(moving), left(topN), right(topN)), bottomGap);
    if (mark) marks.push(mark);
  }
  if (bottomN && bottomGap !== null) {
    const mark = gapMark("y", bottom(moving), top(bottomN), overlapAlong(left(moving), right(moving), left(bottomN), right(bottomN)), topGap);
    if (mark) marks.push(mark);
  }

  const epsilon = 0.12;
  for (const other of others) {
    if (other.id.startsWith("__artboard-")) continue;
    if (Math.abs(left(moving) - left(other)) <= epsilon) {
      marks.push(alignMark("x", left(moving), top(moving), bottom(moving), top(other), bottom(other)));
    }
    if (Math.abs(right(moving) - right(other)) <= epsilon) {
      marks.push(alignMark("x", right(moving), top(moving), bottom(moving), top(other), bottom(other)));
    }
    if (Math.abs(cx(moving) - cx(other)) <= epsilon) {
      marks.push(alignMark("x", cx(moving), top(moving), bottom(moving), top(other), bottom(other)));
    }
    if (Math.abs(top(moving) - top(other)) <= epsilon) {
      marks.push(alignMark("y", top(moving), left(moving), right(moving), left(other), right(other)));
    }
    if (Math.abs(bottom(moving) - bottom(other)) <= epsilon) {
      marks.push(alignMark("y", bottom(moving), left(moving), right(moving), left(other), right(other)));
    }
    if (Math.abs(cy(moving) - cy(other)) <= epsilon) {
      marks.push(alignMark("y", cy(moving), left(moving), right(moving), left(other), right(other)));
    }
  }
  if (Math.abs(cx(moving) - page.width / 2) <= epsilon) {
    marks.push({ kind: "align", axis: "x", at: page.width / 2, start: 0, end: page.height });
  }
  if (Math.abs(cy(moving) - page.height / 2) <= epsilon) {
    marks.push({ kind: "align", axis: "y", at: page.height / 2, start: 0, end: page.width });
  }

  return marks;
}

export function computeDragGuides(
  moving: GuideBox,
  others: GuideBox[],
  page: { width: number; height: number },
  threshold: number,
): GuideResult {
  const neighbors = [...others, ...artboardBoxes(page)];
  const x = collectXSnaps(moving, neighbors, page, threshold);
  const y = collectYSnaps(moving, neighbors, page, threshold);
  const snapped = { ...moving, x, y };
  return { x, y, marks: marksFor(snapped, neighbors, page) };
}

export type ResizeEdges = {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
};

function snapEdge(current: number, candidates: number[], threshold: number) {
  let best = current;
  let bestDist = threshold + 1;
  for (const candidate of candidates) {
    const dist = Math.abs(candidate - current);
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function leftEdgeTargets(box: GuideBox, others: GuideBox[], neighbors: GuideBox[], page: { width: number }) {
  const targets = [0, page.width / 2];
  for (const other of others) {
    targets.push(left(other), right(other), cx(other), right(box) - other.w);
  }
  const leftN = nearestLeft(box, neighbors);
  const rightN = nearestRight(box, neighbors);
  if (leftN && rightN) targets.push(right(leftN) + (left(rightN) - right(box)));
  return targets;
}

function rightEdgeTargets(box: GuideBox, others: GuideBox[], neighbors: GuideBox[], page: { width: number }) {
  const targets = [page.width, page.width / 2];
  for (const other of others) {
    targets.push(left(other), right(other), cx(other), left(box) + other.w);
  }
  const leftN = nearestLeft(box, neighbors);
  const rightN = nearestRight(box, neighbors);
  if (leftN && rightN) targets.push(left(rightN) - (left(box) - right(leftN)));
  return targets;
}

function topEdgeTargets(box: GuideBox, others: GuideBox[], neighbors: GuideBox[], page: { height: number }) {
  const targets = [0, page.height / 2];
  for (const other of others) {
    targets.push(top(other), bottom(other), cy(other), bottom(box) - other.h);
  }
  const topN = nearestTop(box, neighbors);
  const bottomN = nearestBottom(box, neighbors);
  if (topN && bottomN) targets.push(bottom(topN) + (top(bottomN) - bottom(box)));
  return targets;
}

function bottomEdgeTargets(box: GuideBox, others: GuideBox[], neighbors: GuideBox[], page: { height: number }) {
  const targets = [page.height, page.height / 2];
  for (const other of others) {
    targets.push(top(other), bottom(other), cy(other), top(box) + other.h);
  }
  const topN = nearestTop(box, neighbors);
  const bottomN = nearestBottom(box, neighbors);
  if (topN && bottomN) targets.push(top(bottomN) - (top(box) - bottom(topN)));
  return targets;
}

export function computeResizeGuides(
  box: GuideBox,
  others: GuideBox[],
  page: { width: number; height: number },
  threshold: number,
  edges: ResizeEdges,
): { box: GuideBox; marks: GuideMark[] } {
  const neighbors = [...others, ...artboardBoxes(page)];
  const objects = others.filter((item) => !item.id.startsWith("__artboard-"));
  let x = box.x;
  let y = box.y;
  let w = box.w;
  let h = box.h;
  const rightEdge = box.x + box.w;
  const bottomEdge = box.y + box.h;

  if (edges.left) {
    const next = snapEdge(x, leftEdgeTargets(box, objects, neighbors, page), threshold);
    if (rightEdge - next >= 1) {
      x = next;
      w = rightEdge - next;
    }
  }
  if (edges.right) {
    const live = { ...box, x, w };
    const next = snapEdge(x + w, rightEdgeTargets(live, objects, neighbors, page), threshold);
    if (next - x >= 1) w = next - x;
  }
  if (edges.top) {
    const next = snapEdge(y, topEdgeTargets({ ...box, x, w, y, h }, objects, neighbors, page), threshold);
    if (bottomEdge - next >= 0.4) {
      y = next;
      h = bottomEdge - next;
    }
  }
  if (edges.bottom) {
    const live = { ...box, x, y, w, h };
    const next = snapEdge(y + h, bottomEdgeTargets(live, objects, neighbors, page), threshold);
    if (next - y >= 0.4) h = next - y;
  }

  const snapped = { ...box, x, y, w, h };
  return { box: snapped, marks: marksFor(snapped, neighbors, page) };
}

export function spacingMarks(
  moving: GuideBox,
  others: GuideBox[],
  page: { width: number; height: number },
) {
  return marksFor(moving, [...others, ...artboardBoxes(page)], page);
}

function nearestLeftAny(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    const edge = right(other);
    if (edge > left(moving) + 0.05) continue;
    if (!best || edge > right(best)) best = other;
  }
  return best;
}

function nearestRightAny(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    const edge = left(other);
    if (edge < right(moving) - 0.05) continue;
    if (!best || edge < left(best)) best = other;
  }
  return best;
}

function nearestTopAny(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    const edge = bottom(other);
    if (edge > top(moving) + 0.05) continue;
    if (!best || edge > bottom(best)) best = other;
  }
  return best;
}

function nearestBottomAny(moving: GuideBox, others: GuideBox[]) {
  let best: GuideBox | null = null;
  for (const other of others) {
    const edge = top(other);
    if (edge < bottom(moving) - 0.05) continue;
    if (!best || edge < top(best)) best = other;
  }
  return best;
}

function pushGap(
  marks: GuideMark[],
  axis: "x" | "y",
  start: number,
  end: number,
  along: number,
  opposite: number | null,
) {
  const mark = gapMark(axis, start, end, along, opposite);
  if (mark) marks.push(mark);
}

function containedInsets(inner: GuideBox, outer: GuideBox): GuideMark[] {
  const marks: GuideMark[] = [];
  const midY = cy(inner);
  const midX = cx(inner);
  pushGap(marks, "x", left(outer), left(inner), midY, right(outer) - right(inner));
  pushGap(marks, "x", right(inner), right(outer), midY, left(inner) - left(outer));
  pushGap(marks, "y", top(outer), top(inner), midX, bottom(outer) - bottom(inner));
  pushGap(marks, "y", bottom(inner), bottom(outer), midX, top(inner) - top(outer));
  return marks;
}

function containsBox(outer: GuideBox, inner: GuideBox) {
  return (
    left(outer) <= left(inner) + 0.05 &&
    right(outer) >= right(inner) - 0.05 &&
    top(outer) <= top(inner) + 0.05 &&
    bottom(outer) >= bottom(inner) - 0.05
  );
}

export function elementGuideBox(element: LabelElement): GuideBox {
  if (element.type === "line") {
    const stroke = Math.max(element.style.strokeWidth ?? 0.35, 0.05);
    if (isHorizontalLine(element.width, element.height)) {
      return {
        id: element.id,
        x: element.x,
        y: element.y + element.height / 2 - stroke / 2,
        w: element.width,
        h: stroke,
      };
    }
    return {
      id: element.id,
      x: element.x + element.width / 2 - stroke / 2,
      y: element.y,
      w: stroke,
      h: element.height,
    };
  }
  return { id: element.id, x: element.x, y: element.y, w: element.width, h: element.height };
}

export function elementAabb(element: LabelElement): { x1: number; y1: number; x2: number; y2: number } {
  const box = elementGuideBox(element);
  const rot = ((element.rotation ?? 0) * Math.PI) / 180;
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x + box.w, box.y + box.h],
    [box.x, box.y + box.h],
  ];
  // Konva rotates the group around its top-left (element.x, element.y), not the box center.
  if (!rot) {
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  const ox = element.x;
  const oy = element.y;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const world = corners.map(([x, y]) => {
    const dx = x - ox;
    const dy = y - oy;
    return [ox + dx * cos - dy * sin, oy + dx * sin + dy * cos] as const;
  });
  const xs = world.map((c) => c[0]);
  const ys = world.map((c) => c[1]);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

export function boxesIntersect(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

export function measurePair(a: GuideBox, b: GuideBox): GuideMark[] {
  if (containsBox(a, b)) return containedInsets(b, a);
  if (containsBox(b, a)) return containedInsets(a, b);

  const marks: GuideMark[] = [];
  const alongY = overlapAlong(top(a), bottom(a), top(b), bottom(b));
  const alongX = overlapAlong(left(a), right(a), left(b), right(b));

  if (right(a) <= left(b) + 0.05) {
    pushGap(marks, "x", right(a), left(b), alongY, null);
  } else if (right(b) <= left(a) + 0.05) {
    pushGap(marks, "x", right(b), left(a), alongY, null);
  } else {
    pushGap(marks, "x", Math.min(left(a), left(b)), Math.max(left(a), left(b)), alongY, null);
    pushGap(marks, "x", Math.min(right(a), right(b)), Math.max(right(a), right(b)), alongY, null);
  }

  if (bottom(a) <= top(b) + 0.05) {
    pushGap(marks, "y", bottom(a), top(b), alongX, null);
  } else if (bottom(b) <= top(a) + 0.05) {
    pushGap(marks, "y", bottom(b), top(a), alongX, null);
  } else {
    pushGap(marks, "y", Math.min(top(a), top(b)), Math.max(top(a), top(b)), alongX, null);
    pushGap(marks, "y", Math.min(bottom(a), bottom(b)), Math.max(bottom(a), bottom(b)), alongX, null);
  }

  return marks;
}

function isPageBox(box: GuideBox, page: { width: number; height: number }) {
  return (
    Math.abs(box.x) <= 2 &&
    Math.abs(box.y) <= 2 &&
    Math.abs(box.w - page.width) <= 2 &&
    Math.abs(box.h - page.height) <= 2
  );
}

export function measureMarks(
  moving: GuideBox,
  others: GuideBox[],
  page: { width: number; height: number },
) {
  const marks: GuideMark[] = [];
  const objects = others.filter((item) => !item.id.startsWith("__artboard-") && !isPageBox(item, page));
  const leftObj = nearestLeftAny(moving, objects);
  const rightObj = nearestRightAny(moving, objects);
  const topObj = nearestTopAny(moving, objects);
  const bottomObj = nearestBottomAny(moving, objects);
  const midY = cy(moving);
  const midX = cx(moving);
  const objOffset = 4;
  const leftPage = Math.max(0, left(moving));
  const rightPage = Math.max(0, page.width - right(moving));
  const topPage = Math.max(0, top(moving));
  const bottomPage = Math.max(0, page.height - bottom(moving));

  pushGap(marks, "x", 0, left(moving), leftObj ? midY - objOffset : midY, rightPage);
  pushGap(marks, "x", right(moving), page.width, rightObj ? midY - objOffset : midY, leftPage);
  pushGap(marks, "y", 0, top(moving), topObj ? midX - objOffset : midX, bottomPage);
  pushGap(marks, "y", bottom(moving), page.height, bottomObj ? midX - objOffset : midX, topPage);

  if (leftObj) {
    pushGap(marks, "x", right(leftObj), left(moving), midY + objOffset, rightObj ? left(rightObj) - right(moving) : null);
  }
  if (rightObj) {
    pushGap(marks, "x", right(moving), left(rightObj), midY + objOffset, leftObj ? left(moving) - right(leftObj) : null);
  }
  if (topObj) {
    pushGap(marks, "y", bottom(topObj), top(moving), midX + objOffset, bottomObj ? top(bottomObj) - bottom(moving) : null);
  }
  if (bottomObj) {
    pushGap(marks, "y", bottom(moving), top(bottomObj), midX + objOffset, topObj ? top(moving) - bottom(topObj) : null);
  }

  return marks;
}

export function measureSelection(
  selected: GuideBox,
  hovered: GuideBox | null,
  others: GuideBox[],
  page: { width: number; height: number },
) {
  if (hovered && hovered.id !== selected.id && !isPageBox(hovered, page)) {
    return measurePair(selected, hovered);
  }
  return measureMarks(selected, others, page);
}

export function gapLabel(start: number, end: number) {
  return `${formatMm(roundMm(Math.abs(end - start)))} mm`;
}
