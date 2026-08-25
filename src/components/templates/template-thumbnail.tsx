"use client";

import { CanvasElement } from "@/components/designer/canvas-element";
import { useLabelFonts } from "@/components/designer/use-label-fonts";
import type { LabelDocument } from "@/lib/document";
import { resolveValue } from "@/lib/resolve";
import { mmToPx } from "@/lib/units";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";

export function TemplateThumbnail({
  document: doc,
  className,
  pad = 16,
  background = "#ded8cc",
}: {
  document: LabelDocument;
  className?: string;
  pad?: number;
  background?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 180 });
  const families = useMemo(
    () => doc.elements.filter((el) => el.type === "text").map((el) => el.style.fontFamily ?? "IBM Plex Sans"),
    [doc.elements],
  );
  const fontTick = useLabelFonts(families);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setSize({ width: Math.max(1, node.clientWidth), height: Math.max(1, node.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const zoom = Math.min(
    (size.width - pad * 2) / mmToPx(doc.page.widthMm, 1),
    (size.height - pad * 2) / mmToPx(doc.page.heightMm, 1),
  );
  const paperW = mmToPx(doc.page.widthMm, zoom);
  const paperH = mmToPx(doc.page.heightMm, zoom);
  const x = (size.width - paperW) / 2;
  const y = (size.height - paperH) / 2;

  return (
    <div ref={ref} className={className ?? "h-full w-full"}>
      <Stage width={size.width} height={size.height} listening={false}>
        <Layer listening={false}>
          <Rect width={size.width} height={size.height} fill={background} />
          <Rect
            x={x}
            y={y}
            width={paperW}
            height={paperH}
            fill="#ffffff"
            shadowColor="rgba(18,38,58,0.16)"
            shadowBlur={12}
            shadowOffsetY={4}
          />
        </Layer>
        <Layer x={x} y={y} listening={false} clipX={0} clipY={0} clipWidth={paperW} clipHeight={paperH}>
          {doc.elements.filter((element) => !element.hidden).map((element) => (
            <CanvasElement
              key={`${element.id}-${fontTick}`}
              element={element}
              zoom={zoom}
              value={resolveValue(element, null, {})}
              interactive={false}
              onSelect={() => {}}
              onDragEnd={() => {}}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
