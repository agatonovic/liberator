"use client";

import { gapLabel, type GuideMark } from "@/lib/guides";
import { mmToPx } from "@/lib/units";
import { Group, Line, Rect, Text } from "react-konva";

const COLOR = "#f24ce0";
const TICK = 6;

function MeasureLabel({
  x,
  y,
  text,
  equal,
}: {
  x: number;
  y: number;
  text: string;
  equal: boolean;
}) {
  const width = Math.max(28, text.length * 6.4);
  const height = 14;
  return (
    <Group x={x - width / 2} y={y - height / 2} listening={false}>
      <Rect
        width={width}
        height={height}
        fill={equal ? COLOR : "#fffcf7"}
        stroke={COLOR}
        strokeWidth={1}
        cornerRadius={3}
      />
      <Text
        text={text}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        fontSize={10}
        fontFamily="IBM Plex Sans, Helvetica, sans-serif"
        fill={equal ? "#ffffff" : COLOR}
        listening={false}
      />
    </Group>
  );
}

export function SpacingGuides({ marks, zoom }: { marks: GuideMark[]; zoom: number }) {
  return (
    <Group listening={false}>
      {marks.map((mark, index) => {
        const at = mmToPx("at" in mark ? mark.at : 0, zoom);
        const start = mmToPx(mark.start, zoom);
        const end = mmToPx(mark.end, zoom);
        if (mark.kind === "align") {
          const points =
            mark.axis === "x" ? [at, start, at, end] : [start, at, end, at];
          return (
            <Line
              key={`align-${index}`}
              points={points}
              stroke={COLOR}
              strokeWidth={1}
              dash={[4, 3]}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        }
        const along = mmToPx(mark.along, zoom);
        const label = gapLabel(mark.start, mark.end);
        const mid = (start + end) / 2;
        const tick = TICK;
        if (mark.axis === "x") {
          return (
            <Group key={`gap-x-${index}-${label}`} listening={false}>
              <Line
                points={[start, along - tick / 2, start, along + tick / 2]}
                stroke={COLOR}
                strokeWidth={1}
                listening={false}
                perfectDrawEnabled={false}
              />
              <Line
                points={[end, along - tick / 2, end, along + tick / 2]}
                stroke={COLOR}
                strokeWidth={1}
                listening={false}
                perfectDrawEnabled={false}
              />
              <Line
                points={[start, along, end, along]}
                stroke={COLOR}
                strokeWidth={mark.equal ? 1.5 : 1}
                listening={false}
                perfectDrawEnabled={false}
              />
              <MeasureLabel x={mid} y={along} text={label} equal={mark.equal} />
            </Group>
          );
        }
        return (
          <Group key={`gap-y-${index}-${label}`} listening={false}>
            <Line
              points={[along - tick / 2, start, along + tick / 2, start]}
              stroke={COLOR}
              strokeWidth={1}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Line
              points={[along - tick / 2, end, along + tick / 2, end]}
              stroke={COLOR}
              strokeWidth={1}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Line
              points={[along, start, along, end]}
              stroke={COLOR}
              strokeWidth={mark.equal ? 1.5 : 1}
              listening={false}
              perfectDrawEnabled={false}
            />
            <MeasureLabel x={along} y={mid} text={label} equal={mark.equal} />
          </Group>
        );
      })}
    </Group>
  );
}
