"use client";

import { CanvasElement } from "@/components/designer/canvas-element";
import { useLabelFonts } from "@/components/designer/use-label-fonts";
import type { LabelDocument } from "@/lib/document";
import { showMissingImagePlaceholder } from "@/lib/missing-image";
import { resolveValue, type ColumnMapping, type DataRow } from "@/lib/resolve";
import { mmToPx } from "@/lib/units";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";

export function LabelPreview({
  document: doc,
  row = null,
  mapping = {},
  className,
}: {
  document: LabelDocument;
  row?: DataRow | null;
  mapping?: ColumnMapping;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 420, height: 240 });
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

  const pad = 20;
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
          <Rect width={size.width} height={size.height} fill="#e8eaed" />
          <Rect
            x={x}
            y={y}
            width={paperW}
            height={paperH}
            fill="#ffffff"
            shadowColor="rgba(15,45,92,0.18)"
            shadowBlur={16}
            shadowOffsetY={4}
          />
        </Layer>
        <Layer x={x} y={y} listening={false} clipX={0} clipY={0} clipWidth={paperW} clipHeight={paperH}>
          {fontTick > 0 &&
            doc.elements
            .filter((element) => !element.hidden)
            .map((element) => (
              <CanvasElement
                key={`${element.id}-${fontTick}`}
                element={element}
                zoom={zoom}
                value={resolveValue(element, row, mapping, doc.dataColumns)}
                interactive={false}
                missingImagePlaceholder={showMissingImagePlaceholder("generated")}
                onSelect={() => {}}
                onDragEnd={() => {}}
              />
            ))}
        </Layer>
      </Stage>
    </div>
  );
}
