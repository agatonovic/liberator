"use client";

import { Input } from "@/components/ui/input";
import {
  LABEL_SIZE_PRESETS,
  PAPER_SIZES,
  clampPageMm,
  matchPageSize,
  paperDimensions,
  type PageOrientation,
} from "@/lib/document";
import { cn } from "@/lib/utils";

export function PageSizeFields({
  widthMm,
  heightMm,
  onChange,
}: {
  widthMm: number;
  heightMm: number;
  onChange: (widthMm: number, heightMm: number) => void;
}) {
  const match = matchPageSize(widthMm, heightMm);
  const selected =
    match.kind === "label" ? `label:${match.id}` : match.kind === "paper" ? `paper:${match.id}` : "custom";
  const orientation: PageOrientation =
    match.kind === "paper" ? match.orientation : widthMm >= heightMm ? "landscape" : "portrait";

  function setSize(nextW: number, nextH: number) {
    onChange(clampPageMm(nextW), clampPageMm(nextH));
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Size
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          value={selected}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "custom") return;
            if (value.startsWith("label:")) {
              const preset = LABEL_SIZE_PRESETS.find((item) => item.id === value.slice(6));
              if (preset) setSize(preset.widthMm, preset.heightMm);
              return;
            }
            const paper = PAPER_SIZES.find((item) => item.id === value.slice(6));
            if (!paper) return;
            const nextOrientation = match.kind === "paper" ? orientation : "portrait";
            const next = paperDimensions(paper, nextOrientation);
            setSize(next.widthMm, next.heightMm);
          }}
        >
          <optgroup label="Labels">
            {LABEL_SIZE_PRESETS.map((preset) => (
              <option key={preset.id} value={`label:${preset.id}`}>
                {preset.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Paper">
            {PAPER_SIZES.map((paper) => (
              <option key={paper.id} value={`paper:${paper.id}`}>
                {paper.label}
              </option>
            ))}
          </optgroup>
          {selected === "custom" ? <option value="custom">Custom</option> : null}
        </select>
      </label>
      {match.kind === "paper" ? (
        <div className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Orientation</span>
          <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-input p-0.5">
            {(["portrait", "landscape"] as const).map((option) => {
              const paper = PAPER_SIZES.find((item) => item.id === match.id);
              const active = orientation === option;
              return (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "h-7 rounded-md text-xs capitalize",
                    active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    if (!paper) return;
                    const next = paperDimensions(paper, option);
                    setSize(next.widthMm, next.heightMm);
                  }}
                >
                  {option === "portrait" ? "Portrait" : "Landscape"}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">
          Width (mm)
          <Input
            type="number"
            min={1}
            max={2000}
            step={0.1}
            value={widthMm}
            onChange={(event) => setSize(Number(event.target.value), heightMm)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Height (mm)
          <Input
            type="number"
            min={1}
            max={2000}
            step={0.1}
            value={heightMm}
            onChange={(event) => setSize(widthMm, Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
