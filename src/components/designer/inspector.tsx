"use client";

import { ColorPickerPopover, ColorSwatchButton } from "@/components/designer/color-picker";
import { FontPicker } from "@/components/designer/font-picker";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { hexDigits, normalizeHex, canPickScreenColor, pickScreenColor } from "@/lib/color";
import {
  ARROW_KINDS,
  BARCODE_MIN_HEIGHT_MM,
  BARCODE_MIN_WIDTH_MM,
  IMAGE_FITS,
  LINE_CAPS,
  QR_MIN_SIDE_MM,
  STROKE_STYLES,
  arrowBindingPatch,
  clampQrSideMm,
  designedArrowDirection,
  imageFitOf,
  isSwappableArrowImage,
  isGaAddressTransform,
  isHorizontalLine,
  isPaintColor,
  isPaintedShape,
  orientLine,
  rotateAroundCenter,
  type ArrowKind,
  type BarcodeSymbology,
  type ElementStyle,
  type ElementTransform,
  type LabelElement,
  type StrokeStyleKind,
  type TextAlign,
  type VerticalAlign,
} from "@/lib/document";
import { folderPath, resolveBoundImageSrc } from "@/lib/assets";
import { useAssetStore } from "@/lib/asset-store";
import { boxMatchingAspect, probeImageSrc } from "@/lib/image";
import { resolvePublicSrc } from "@/lib/public-path";
import { schemaColumns } from "@/lib/excel";
import { applyCharStyle, stripSpanKey, styleInRange } from "@/lib/text-color";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  Pipette,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

type AlignKind = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "center";

function alignUnitCount(layers: LabelElement[]) {
  const seen = new Set<string>();
  let count = 0;
  for (const el of layers) {
    if (el.groupId) {
      if (seen.has(el.groupId)) continue;
      seen.add(el.groupId);
    }
    count += 1;
  }
  return count;
}

function PositionTools({
  onAlign,
  onDistribute,
  canDistribute,
}: {
  onAlign: (align: AlignKind) => void;
  onDistribute?: (axis: "horizontal" | "vertical") => void;
  canDistribute?: boolean;
}) {
  return (
    <div>
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Position</span>
      <div className="mt-1 flex flex-wrap gap-1">
        <Hint label="Align left">
          <Button size="icon-sm" variant="outline" onClick={() => onAlign("left")}>
            <AlignHorizontalJustifyStart className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="Align horizontal centers">
          <Button size="icon-sm" variant="outline" onClick={() => onAlign("hcenter")}>
            <AlignHorizontalJustifyCenter className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="Align right">
          <Button size="icon-sm" variant="outline" onClick={() => onAlign("right")}>
            <AlignHorizontalJustifyEnd className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="Align top">
          <Button size="icon-sm" variant="outline" onClick={() => onAlign("top")}>
            <AlignVerticalJustifyStart className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="Align vertical centers">
          <Button size="icon-sm" variant="outline" onClick={() => onAlign("vcenter")}>
            <AlignVerticalJustifyCenter className="size-3.5" />
          </Button>
        </Hint>
        <Hint label="Align bottom">
          <Button size="icon-sm" variant="outline" onClick={() => onAlign("bottom")}>
            <AlignVerticalJustifyEnd className="size-3.5" />
          </Button>
        </Hint>
        {onDistribute ? (
          <>
            <Hint label="Distribute horizontal spacing">
              <Button
                size="icon-sm"
                variant="outline"
                disabled={!canDistribute}
                onClick={() => onDistribute("horizontal")}
              >
                <AlignHorizontalSpaceBetween className="size-3.5" />
              </Button>
            </Hint>
            <Hint label="Distribute vertical spacing">
              <Button
                size="icon-sm"
                variant="outline"
                disabled={!canDistribute}
                onClick={() => onDistribute("vertical")}
              >
                <AlignVerticalSpaceBetween className="size-3.5" />
              </Button>
            </Hint>
          </>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => onAlign("center")}>
          Center
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  value,
  onChange,
  step = 0.1,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  const beginPropertyEdit = useAppStore((s) => s.beginPropertyEdit);
  const endPropertyEdit = useAppStore((s) => s.endPropertyEdit);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => String(Number.isFinite(value) ? value : 0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownsCheckpoint = useRef(false);

  useEffect(() => {
    if (!focused) setDraft(String(Number.isFinite(value) ? value : 0));
  }, [value, focused]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function commit(raw: string, immediate = false) {
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (immediate) {
      onChange(next);
      return;
    }
    timer.current = setTimeout(() => onChange(next), 300);
  }

  return (
    <Input
      type="number"
      step={step}
      value={focused ? draft : Number.isFinite(value) ? value : 0}
      onFocus={() => {
        if (!useAppStore.getState().editCheckpoint) {
          beginPropertyEdit();
          ownsCheckpoint.current = true;
        } else {
          ownsCheckpoint.current = false;
        }
        setFocused(true);
        setDraft(String(Number.isFinite(value) ? value : 0));
      }}
      onBlur={() => {
        commit(draft, true);
        setFocused(false);
        if (ownsCheckpoint.current) {
          ownsCheckpoint.current = false;
          endPropertyEdit();
        }
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const inputType = (event.nativeEvent as InputEvent).inputType;
        commit(raw, inputType === "stepUp" || inputType === "stepDown");
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function RotationField({ value, onChange }: { value: number; onChange: (rotation: number) => void }) {
  const dialRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const dragging = useRef(false);
  const deg = Number.isFinite(value) ? value : 0;
  const beginPropertyEdit = useAppStore((s) => s.beginPropertyEdit);
  const endPropertyEdit = useAppStore((s) => s.endPropertyEdit);

  function pointerToDeg(event: { clientX: number; clientY: number; shiftKey: boolean }) {
    const node = dialRef.current;
    if (!node) return deg;
    const rect = node.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    let next = (Math.atan2(dy, dx) * 180) / Math.PI;
    next = event.shiftKey ? Math.round(next / 15) * 15 : Math.round(next);
    return next;
  }

  useEffect(() => {
    function move(event: PointerEvent) {
      if (!dragging.current) return;
      onChangeRef.current(pointerToDeg(event));
    }
    function up() {
      if (!dragging.current) return;
      dragging.current = false;
      endPropertyEdit();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [endPropertyEdit]);

  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Rotation</span>
      <div className="flex items-center gap-2">
        <div
          ref={dialRef}
          role="slider"
          aria-label="Rotation"
          aria-valuemin={-180}
          aria-valuemax={180}
          aria-valuenow={deg}
          tabIndex={0}
          className="relative size-9 shrink-0 cursor-ew-resize rounded-full border border-input bg-background"
          onPointerDown={(event) => {
            event.preventDefault();
            beginPropertyEdit();
            dragging.current = true;
            onChange(pointerToDeg(event));
          }}
        >
          <span
            className="absolute top-1/2 left-1/2 h-[2px] w-[14px] origin-left rounded-full bg-foreground"
            style={{ transform: `rotate(${deg}deg)` }}
          />
        </div>
        <Input
          className="h-8"
          type="number"
          step={1}
          value={deg}
          onFocus={() => beginPropertyEdit()}
          onBlur={() => endPropertyEdit()}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="text-xs text-muted-foreground">°</span>
      </div>
      <div className="flex gap-1">
        {[0, 90, 180, 270].map((preset) => (
          <Button
            key={preset}
            size="xs"
            variant={((deg % 360) + 360) % 360 === preset ? "default" : "outline"}
            onClick={() => onChange(preset)}
          >
            {preset}°
          </Button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Drag the dial. Hold Shift to snap 15°. Rotates around the center.</p>
    </div>
  );
}

function DirectionBindingField({
  element,
  onChange,
}: {
  element: LabelElement;
  onChange: (patch: Partial<LabelElement>) => void;
}) {
  const columns = useAppStore((s) => s.documents.find((item) => item.id === s.currentId)?.dataColumns);
  const designed = designedArrowDirection(element);
  return (
    <>
      <Field label="Bind to column">
        <Input
          list="labelator-arrow-columns"
          placeholder="arrow"
          value={element.binding ?? ""}
          onChange={(event) => onChange(arrowBindingPatch(event.target.value || undefined, element))}
        />
        {columns?.length ? (
          <datalist id="labelator-arrow-columns">
            {columns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </datalist>
        ) : null}
      </Field>
      {element.binding ? (
        <>
          <div>
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Drawn as
            </span>
            <div className="mt-1 flex gap-1">
              {(["UP", "DOWN"] as const).map((dir) => (
                <Button
                  key={dir}
                  size="sm"
                  variant={designed === dir ? "default" : "outline"}
                  onClick={() => onChange({ content: dir })}
                >
                  {dir}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Column values: UP or DOWN. Matching data keeps this direction; the other flips the arrow in place.
          </p>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Bind to a column (usually <span className="font-medium">arrow</span>) so Print can point each label UP or
          DOWN.
        </p>
      )}
    </>
  );
}

function ImageLookupFields({
  element,
  onChange,
}: {
  element: LabelElement;
  onChange: (patch: Partial<LabelElement>) => void;
}) {
  const doc = useAppStore((s) => s.documents.find((item) => item.id === s.currentId));
  const columns = doc ? schemaColumns(doc) : [];
  const folders = useAssetStore((s) => s.folders);
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Bind a column and an Assets folder. The cell value picks the file with the same name (X4202 → X4202.jpg).
      </p>
      <Field label="Bind to column">
        <Input
          list="labelator-image-columns"
          placeholder="PAKOVANJE (MDR)"
          value={element.binding ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            if (/arrow/i.test(next)) {
              onChange(arrowBindingPatch(next || undefined, element));
              return;
            }
            onChange({ binding: next || undefined });
          }}
        />
        {columns.length ? (
          <datalist id="labelator-image-columns">
            {columns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </datalist>
        ) : null}
      </Field>
      <Field label="Look up in folder">
        <select
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          value={element.assetFolderId ?? ""}
          onChange={(event) => {
            const assetFolderId = event.target.value || undefined;
            const patch: Partial<LabelElement> = { assetFolderId };
            if (assetFolderId && !element.binding) {
              const pack = columns.find((column) =>
                /packag|pakov/i.test([column.key, column.label, ...column.headers].join(" ")),
              );
              if (pack) patch.binding = pack.key;
            }
            onChange(patch);
          }}
        >
          <option value="">None — use the chosen file</option>
          {folders
            .map((folder) => ({ id: folder.id, label: folderPath(folders, folder.id) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
            .map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
        </select>
      </Field>
      {element.assetFolderId && !element.binding ? (
        <p className="text-[11px] text-muted-foreground">
          Bind a column so Print can pick the file. Example: PAKOVANJE = X4202 → X4202.jpg.
        </p>
      ) : null}
      {element.binding && !element.assetFolderId ? (
        <p className="text-[11px] text-muted-foreground">
          Choose a folder so Print can find the image. Add files on the Assets page.
        </p>
      ) : null}
    </>
  );
}

function StrokeStyleIcon({ kind }: { kind: StrokeStyleKind }) {
  const dash = kind === "dashed" ? "3.5 2.4" : kind === "dotted" ? "0.1 2.8" : undefined;
  return (
    <svg viewBox="0 0 18 8" className="size-3.5" aria-hidden>
      <line
        x1="1"
        y1="4"
        x2="17"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap={kind === "dotted" ? "round" : "butt"}
        strokeDasharray={dash}
      />
    </svg>
  );
}

function StrokeStyleField({
  style,
  onChange,
}: {
  style: ElementStyle;
  onChange: (patch: Partial<ElementStyle>) => void;
}) {
  const kind = style.strokeStyle ?? "solid";
  const stroke = Math.max(style.strokeWidth ?? 0.35, 0.05);
  return (
    <>
      <div>
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Style</span>
        <div className="mt-1 flex gap-1">
          {STROKE_STYLES.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={kind === item.id ? "default" : "outline"}
              className="gap-1.5 px-2"
              title={item.label}
              onClick={() =>
                onChange({
                  strokeStyle: item.id,
                  lineCap: item.id === "dotted" ? "round" : style.lineCap,
                  dashMm: item.id === "dashed" ? (style.dashMm ?? stroke * 4) : style.dashMm,
                  gapMm:
                    item.id === "dotted"
                      ? (style.gapMm ?? stroke * 2.2)
                      : item.id === "dashed"
                        ? (style.gapMm ?? stroke * 2)
                        : style.gapMm,
                })
              }
            >
              <StrokeStyleIcon kind={item.id} />
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {kind === "dashed" ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dash (mm)">
            <NumberField
              value={style.dashMm ?? stroke * 4}
              onChange={(dashMm) => onChange({ dashMm: Math.max(0.1, dashMm) })}
            />
          </Field>
          <Field label="Gap (mm)">
            <NumberField
              value={style.gapMm ?? stroke * 2}
              onChange={(gapMm) => onChange({ gapMm: Math.max(0.1, gapMm) })}
            />
          </Field>
        </div>
      ) : null}
      {kind === "dotted" ? (
        <Field label="Gap (mm)">
          <NumberField
            value={style.gapMm ?? stroke * 2.2}
            onChange={(gapMm) => onChange({ gapMm: Math.max(0.1, gapMm) })}
          />
        </Field>
      ) : null}
    </>
  );
}

function parseHexInput(raw: string, fallback: string) {
  return normalizeHex(raw) ?? (fallback.startsWith("#") ? fallback : `#${fallback}`);
}

const ARROW_STYLE_ICONS: Record<ArrowKind, string> = {
  block: "M2 9.5h26V5l24 9-24 9v-4.5H2z",
  triangle: "M4 4.5 50 14 4 23.5z",
  barbed: "M2 5h30L52 14 32 23H2l10-9z",
  chevron: "M6 4.5 22 4.5 48 14 22 23.5 6 23.5 32 14z",
  line: "M2 12.2h32V8.5L52 14 34 19.5v-3.7H2z",
  pentagon: "M2 9.5h28V5.5h10L52 14 40 22.5H30V18.5H2z",
  open: "",
};

const DOUBLE_ARROW_STYLE_ICONS: Record<ArrowKind, string> = {
  block: "M14 9.5h26V5.5L52 14 40 22.5v-4H14v4L2 14 14 5.5z",
  triangle: "M16 10h22V5.5L52 14 38 22.5V18H16v4.5L2 14 16 5.5z",
  barbed: "M14 5.5 2 14l12 8.5-4-8.5 4-8.5H40l4 8.5-4 8.5L52 14 40 5.5z",
  chevron: "M2 5.5 14 14 2 22.5h8L22 14 10 5.5zm22 0L36 14 24 22.5h8L52 14 40 5.5z",
  line: "M2 14 12 6.5v4.2h30V6.5L52 14 42 21.5v-4.2H12v4.2z",
  pentagon: "M2 14 10 6h8v4h18V6h8L52 14l-8 8h-8v-4H18v4h-8z",
  open: "",
};

function ArrowKindField({
  value,
  onChange,
  heads = 1,
}: {
  value: ArrowKind;
  onChange: (kind: ArrowKind) => void;
  heads?: 1 | 2;
}) {
  const icons = heads === 2 ? DOUBLE_ARROW_STYLE_ICONS : ARROW_STYLE_ICONS;
  return (
    <div>
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Arrow style</span>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {ARROW_KINDS.map((item) => {
          const selected = value === item.id;
          const open = item.id === "open";
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => onChange(item.id)}
              className={cn(
                "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 transition-colors",
                selected
                  ? "border-primary bg-accent text-foreground ring-1 ring-primary"
                  : "border-border bg-background text-foreground hover:bg-muted/70",
              )}
            >
              <svg
                viewBox="0 0 54 28"
                className="h-6 w-[42px] shrink-0"
                fill={open ? "none" : "currentColor"}
                stroke={open ? "currentColor" : undefined}
                strokeWidth={open ? 2.4 : undefined}
                strokeLinecap={open ? "round" : undefined}
                strokeLinejoin={open ? "round" : undefined}
                aria-hidden
              >
                {open ? (
                  heads === 2 ? (
                    <path d="M12 6 2 14l10 8M2 14h50M42 6l10 8-10 8" />
                  ) : (
                    <path d="M2 14h50M40 6l12 8-12 8" />
                  )
                ) : (
                  <path d={icons[item.id]} />
                )}
              </svg>
              <span className="text-[10px] leading-none text-muted-foreground">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextStyleFields({
  style,
  onStyle,
  onFill,
  onFontSize,
}: {
  style: LabelElement["style"];
  onStyle: (patch: Partial<LabelElement["style"]>) => void;
  onFill?: (fill: string) => void;
  onFontSize?: (fontSizeMm: number) => void;
}) {
  return (
    <>
      <Field label="Font">
        <FontPicker value={style.fontFamily} onChange={(fontFamily) => onStyle({ fontFamily })} />
      </Field>
      <Field label="Font size (mm)">
        <NumberField
          value={style.fontSizeMm ?? 4}
          onChange={(fontSizeMm) => (onFontSize ? onFontSize(fontSizeMm) : onStyle({ fontSizeMm }))}
        />
      </Field>
      <Field label="Weight">
        <NativeSelect
          value={style.fontWeight ?? "normal"}
          onChange={(fontWeight) => onStyle({ fontWeight: fontWeight as "normal" | "bold" })}
          options={[
            { value: "normal", label: "Regular" },
            { value: "bold", label: "Bold" },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Align">
          <NativeSelect
            value={style.align ?? "left"}
            onChange={(align) => onStyle({ align: align as TextAlign })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </Field>
        <Field label="Letter align">
          <NativeSelect
            value={style.verticalAlign ?? "middle"}
            onChange={(verticalAlign) => onStyle({ verticalAlign: verticalAlign as VerticalAlign })}
            options={[
              { value: "top", label: "Top" },
              { value: "middle", label: "Middle" },
              { value: "bottom", label: "Bottom" },
            ]}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Char spacing (mm)">
          <NumberField
            value={style.letterSpacingMm ?? 0}
            onChange={(letterSpacingMm) => onStyle({ letterSpacingMm })}
          />
        </Field>
        <Field label="Line height">
          <NumberField
            value={style.lineHeight ?? 1}
            onChange={(lineHeight) => onStyle({ lineHeight: Math.max(0.5, lineHeight) })}
          />
        </Field>
      </div>
      <ColorField
        label="Color"
        value={style.fill}
        fallback="#12263A"
        property="fill"
        onChange={(fill) => (onFill ? onFill(fill) : onStyle({ fill }))}
      />
    </>
  );
}

function isNone(value: string | undefined): boolean {
  return !isPaintColor(value);
}

function ColorField({
  label,
  value,
  fallback,
  allowNone,
  property,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  allowNone?: boolean;
  property?: "fill" | "stroke";
  onChange: (value: string) => void;
}) {
  const none = isNone(value);
  const beginPropertyEdit = useAppStore((s) => s.beginPropertyEdit);
  const endPropertyEdit = useAppStore((s) => s.endPropertyEdit);
  const beginColorSample = useAppStore((s) => s.beginColorSample);
  const cancelColorSample = useAppStore((s) => s.cancelColorSample);
  const doc = useAppStore((s) => s.current());
  const sampling = useAppStore((s) =>
    property && s.colorSample?.property === property ? s.colorSample : null,
  );
  const swatch = `#${hexDigits(value, fallback)}`;
  const [hex, setHex] = useState(hexDigits(value, fallback));
  const [picker, setPicker] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setHex(hexDigits(value, fallback));
  }, [value, fallback, none]);

  function commitHex(raw: string) {
    const next = parseHexInput(raw, swatch);
    setHex(hexDigits(next, fallback));
    onChange(next);
  }

  function pickColor() {
    if (canPickScreenColor()) {
      void pickScreenColor().then((hex) => {
        if (!hex) return;
        setHex(hexDigits(hex, fallback));
        onChange(hex);
      });
      return;
    }
    if (property) beginColorSample(property);
  }

  function openPicker(rect: DOMRect) {
    beginPropertyEdit();
    const width = 220;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = rect.bottom + 6;
    const height = 360;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
    setPicker({ top, left, width });
  }

  function closePicker() {
    setPicker(null);
    endPropertyEdit();
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        {allowNone ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              checked={!none}
              onCheckedChange={(checked) => onChange(checked ? fallback : "transparent")}
            />
            On
          </div>
        ) : null}
      </div>
      {none && allowNone ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <>
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background pr-0.5 pl-1">
            <ColorSwatchButton color={swatch} label={label} onOpen={openPicker} />
            <span className="text-[11px] text-muted-foreground">#</span>
            <input
              value={hex}
              spellCheck={false}
              aria-label={`${label} hex`}
              className="h-7 min-w-0 flex-1 bg-transparent font-mono text-[12px] tracking-wide uppercase outline-none"
              onFocus={(event) => {
                beginPropertyEdit();
                event.currentTarget.select();
              }}
              onBlur={() => {
                commitHex(hex);
                endPropertyEdit();
              }}
              onChange={(event) => setHex(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (!/#?[0-9a-fA-F]{3,8}/.test(text.trim())) return;
                event.preventDefault();
                commitHex(text);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitHex(hex);
                  (event.target as HTMLInputElement).blur();
                }
              }}
            />
            <Hint label={sampling ? "Click the canvas to sample" : "Pick color from another element"}>
              <button
                type="button"
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                  sampling && "bg-primary/15 text-primary",
                )}
                onClick={() => {
                  if (sampling) cancelColorSample();
                  else void pickColor();
                }}
              >
                <Pipette className="size-3.5" />
              </button>
            </Hint>
          </div>
          {sampling ? (
            <p className="text-[10px] text-muted-foreground">Click the canvas to copy a color, including images. Esc cancels.</p>
          ) : null}
        </>
      )}
      {picker
        ? createPortal(
            <ColorPickerPopover
              value={swatch}
              elements={doc?.elements ?? []}
              style={picker}
              onChange={(next) => {
                setHex(hexDigits(next, fallback));
                onChange(next);
              }}
              onClose={closePicker}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function InspectorTypeFields({
  element,
  shared,
  onChange,
  onOrientLine,
  onPickImage,
}: {
  element: LabelElement;
  shared?: boolean;
  onChange: (patch: Partial<LabelElement>) => void;
  onOrientLine?: (orientation: "horizontal" | "vertical") => void;
  onPickImage?: () => void;
}) {
  const style = element.style;
  const editingTextId = useAppStore((s) => s.editingTextId);
  const textSelectionRange = useAppStore((s) => s.textSelectionRange);
  const defaults = { fill: style.fill || "#12263A", fontSizeMm: style.fontSizeMm ?? 4 };
  const liveRange =
    !shared && editingTextId === element.id && textSelectionRange && textSelectionRange.end > textSelectionRange.start
      ? textSelectionRange
      : null;
  const selectionStyle = liveRange
    ? styleInRange(element.content ?? "", element.spans, defaults, liveRange.start, liveRange.end)
    : null;

  function setStyle(patch: Partial<LabelElement["style"]>) {
    onChange({ style: patch });
  }

  function applyToSelection(patch: { fill?: string; fontSizeMm?: number }) {
    if (!liveRange) return false;
    onChange(applyCharStyle(element.content ?? "", element.spans, defaults, liveRange.start, liveRange.end, patch));
    return true;
  }

  return (
    <>
      {element.type === "line" ? (
        <>
          <div>
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Orientation
            </span>
            <div className="mt-1 flex gap-1">
              <Button
                size="sm"
                variant={isHorizontalLine(element.width, element.height) ? "default" : "outline"}
                onClick={() => (onOrientLine ?? ((next) => onChange(orientLine(element, next))))("horizontal")}
              >
                Horizontal
              </Button>
              <Button
                size="sm"
                variant={!isHorizontalLine(element.width, element.height) ? "default" : "outline"}
                onClick={() => (onOrientLine ?? ((next) => onChange(orientLine(element, next))))("vertical")}
              >
                Vertical
              </Button>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Ends</span>
            <div className="mt-1 flex gap-1">
              {LINE_CAPS.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={(style.lineCap ?? "butt") === item.id ? "default" : "outline"}
                  onClick={() => setStyle({ lineCap: item.id })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <RotationField
            value={element.rotation}
            onChange={(rotation) => onChange(shared ? { rotation } : rotateAroundCenter(element, rotation))}
          />
        </>
      ) : (
        <>
          {element.type === "arrow" || element.type === "doubleArrow" ? (
            <>
              <ArrowKindField
                value={style.arrowKind ?? "block"}
                heads={element.type === "doubleArrow" ? 2 : 1}
                onChange={(arrowKind) => setStyle({ arrowKind })}
              />
              <DirectionBindingField element={element} onChange={onChange} />
            </>
          ) : null}
          <RotationField
            value={element.rotation}
            onChange={(rotation) => onChange(shared ? { rotation } : rotateAroundCenter(element, rotation))}
          />
        </>
      )}

      {element.type === "text" ? (
        <>
          <Field label="Text">
            <Input
              value={element.content ?? ""}
              onChange={(event) => onChange({ content: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </Field>
          <Field label="Bind to column">
            <Input
              placeholder="sku"
              value={element.binding ?? ""}
              onChange={(event) => onChange({ binding: event.target.value || undefined })}
            />
          </Field>
          {/address/i.test(element.binding ?? "") || isGaAddressTransform(element.transform) ? (
            <Field label="Address part">
              <select
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                value={isGaAddressTransform(element.transform) ? element.transform : ""}
                onChange={(event) => {
                  const next = event.target.value as ElementTransform | "";
                  onChange({ transform: next || undefined });
                }}
              >
                <option value="">Whole value</option>
                <option value="ga_magacin">Magacin</option>
                <option value="ga_regal_letter">Regal letter</option>
                <option value="ga_regal_number">Regal number</option>
                <option value="ga_nivo">Nivo</option>
              </select>
            </Field>
          ) : null}
        </>
      ) : null}

      {element.type === "barcode" || element.type === "qr" ? (
        <>
          <Field label="Static content">
            <Input
              value={element.content ?? ""}
              onChange={(event) => onChange({ content: event.target.value })}
            />
          </Field>
          <Field label="Bind to column">
            <Input
              placeholder="sku"
              value={element.binding ?? ""}
              onChange={(event) => onChange({ binding: event.target.value || undefined })}
            />
          </Field>
        </>
      ) : null}

      {element.type === "text" ? (
        <>
          <TextStyleFields
            style={{
              ...style,
              fill: selectionStyle?.fill ?? style.fill,
              fontSizeMm: selectionStyle?.fontSizeMm ?? style.fontSizeMm,
            }}
            onStyle={(patch) => setStyle(patch)}
            onFill={(fill) => {
              if (applyToSelection({ fill })) return;
              onChange({ style: { fill }, spans: shared ? undefined : stripSpanKey(element.spans, "fill") });
            }}
            onFontSize={(fontSizeMm) => {
              if (!Number.isFinite(fontSizeMm) || fontSizeMm <= 0) return;
              if (applyToSelection({ fontSizeMm })) return;
              onChange({
                style: { fontSizeMm },
                spans: shared || editingTextId === element.id ? element.spans : stripSpanKey(element.spans, "fontSizeMm"),
              });
            }}
          />
          {!shared && editingTextId === element.id ? (
            <p className="text-[11px] text-muted-foreground">
              Highlight the digits you want, then set color or size. Only those characters stay colored on other part numbers (by digit position).
            </p>
          ) : null}
        </>
      ) : null}

      {element.type === "rect" ? (
        <Field label="Corner radius (mm)">
          <NumberField
            value={style.cornerRadiusMm ?? 0}
            onChange={(cornerRadiusMm) => setStyle({ cornerRadiusMm: Math.max(0, cornerRadiusMm) })}
          />
        </Field>
      ) : null}

      {element.type === "image" ? (
        <>
          {isSwappableArrowImage(element) || /arrow/i.test(element.binding ?? "") ? (
            <DirectionBindingField element={element} onChange={onChange} />
          ) : (
            <ImageLookupFields element={element} onChange={onChange} />
          )}
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={onPickImage}>
              Choose file…
            </Button>
            {element.imageDataUrl ? (
              <Button size="sm" variant="ghost" onClick={() => onChange({ imageDataUrl: undefined })}>
                Remove file
              </Button>
            ) : null}
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Photo in box</span>
            <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-input p-0.5">
              {IMAGE_FITS.map((option) => {
                const active = imageFitOf(element) === option.id;
                return (
                  <Hint key={option.id} label={option.hint}>
                    <button
                      type="button"
                      className={cn(
                        "h-7 w-full rounded-md text-xs",
                        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => onChange({ imageFit: option.id })}
                    >
                      {option.label}
                    </button>
                  </Hint>
                );
              })}
            </div>
          </div>
          {!shared && !isSwappableArrowImage(element) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const assets = useAssetStore.getState();
                const src =
                  (element.imageDataUrl ? resolvePublicSrc(element.imageDataUrl) : undefined) ??
                  resolveBoundImageSrc(element, element.content ?? "", assets.assets, assets.folders);
                if (!src) return;
                void probeImageSrc(src).then((natural) => {
                  if (!natural?.width || !natural.height) return;
                  onChange(boxMatchingAspect({ width: element.width, height: element.height }, natural));
                });
              }}
            >
              Match photo
            </Button>
          ) : null}
        </>
      ) : null}

      {isPaintedShape(element.type) ? (
        <>
          {element.type !== "line" ? (
            <ColorField
              label="Fill"
              value={style.fill}
              fallback={element.type === "rect" || element.type === "ellipse" ? "#ffffff" : "#12263A"}
              allowNone
              property="fill"
              onChange={(fill) => setStyle({ fill })}
            />
          ) : null}
          <ColorField
            label="Stroke"
            value={style.stroke}
            fallback="#12263A"
            allowNone
            property="stroke"
            onChange={(stroke) =>
              setStyle({
                stroke,
                strokeWidth:
                  stroke === "transparent" ? style.strokeWidth : Math.max(style.strokeWidth ?? 0, 0.35),
              })
            }
          />
          {isPaintColor(style.stroke) ? (
            <>
              <Field label="Stroke (mm)">
                <NumberField
                  value={style.strokeWidth ?? 0.35}
                  onChange={(strokeWidth) => setStyle({ strokeWidth })}
                />
              </Field>
              <StrokeStyleField style={style} onChange={setStyle} />
            </>
          ) : null}
        </>
      ) : null}

      {element.type === "barcode" ? (
        <>
          <Field label="Symbology">
            <NativeSelect
              value={style.barcodeSymbology ?? "code128"}
              onChange={(barcodeSymbology) =>
                setStyle({ barcodeSymbology: barcodeSymbology as BarcodeSymbology })
              }
              options={[
                { value: "code128", label: "Code 128" },
                { value: "ean13", label: "EAN-13" },
                { value: "code39", label: "Code 39" },
              ]}
            />
          </Field>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Label htmlFor="barcode-text" className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Show value
            </Label>
            <Switch
              id="barcode-text"
              checked={style.barcodeDisplayValue ?? false}
              onCheckedChange={(checked) => setStyle({ barcodeDisplayValue: Boolean(checked) })}
            />
          </div>
        </>
      ) : null}
    </>
  );
}

function typeLabel(type: LabelElement["type"], count: number) {
  const names: Partial<Record<LabelElement["type"], [string, string]>> = {
    rect: ["rectangle", "rectangles"],
    ellipse: ["ellipse", "ellipses"],
    line: ["line", "lines"],
    arrow: ["arrow", "arrows"],
    doubleArrow: ["double arrow", "double arrows"],
    triangle: ["triangle", "triangles"],
    diamond: ["diamond", "diamonds"],
    star: ["star", "stars"],
    hexagon: ["hexagon", "hexagons"],
    plus: ["plus", "pluses"],
    cross: ["cross", "crosses"],
    text: ["text layer", "text layers"],
    barcode: ["barcode", "barcodes"],
    qr: ["QR code", "QR codes"],
    image: ["image", "images"],
  };
  const pair = names[type] ?? [type, `${type}s`];
  return `${count} ${count === 1 ? pair[0] : pair[1]} selected`;
}

export function Inspector({
  element,
  selection = [],
  selectedCount = 0,
  onChange,
  onDelete,
  onAlign,
  onDistribute,
  onPickImage,
  onOrientLine,
}: {
  element: LabelElement | null;
  selection?: LabelElement[];
  selectedCount?: number;
  onChange: (patch: Partial<LabelElement>) => void;
  onDelete: () => void;
  onAlign: (align: AlignKind) => void;
  onDistribute?: (axis: "horizontal" | "vertical") => void;
  onPickImage?: () => void;
  onOrientLine?: (orientation: "horizontal" | "vertical") => void;
}) {
  const layers = selection.length ? selection : element ? [element] : [];
  const sameType = layers.length > 1 && layers.every((el) => el.type === layers[0].type);

  if (selectedCount > 1) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-medium">
              {sameType ? typeLabel(layers[0].type, selectedCount) : `${selectedCount} layers selected`}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {sameType ? "Changes apply to all selected layers" : "Select the same type to edit shared properties"}
            </p>
          </div>
          <Hint label="Delete">
            <Button size="icon-sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          </Hint>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <PositionTools onAlign={onAlign} onDistribute={onDistribute} canDistribute={alignUnitCount(layers) >= 3} />
          {sameType ? (
            <InspectorTypeFields
              element={layers[0]}
              shared
              onChange={onChange}
              onOrientLine={onOrientLine}
              onPickImage={onPickImage}
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (!element) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <h2 className="text-sm font-medium">Inspector</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select an object, or choose a tool and click the label to place it — including on top of other shapes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-medium capitalize">{element.type}</h2>
          <p className="text-[11px] text-muted-foreground">mm from top-left</p>
        </div>
        <Hint label="Delete">
          <Button size="icon-sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </Hint>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <PositionTools onAlign={onAlign} onDistribute={onDistribute} canDistribute={false} />

        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <NumberField value={element.x} onChange={(x) => onChange({ x })} />
          </Field>
          <Field label="Y">
            <NumberField value={element.y} onChange={(y) => onChange({ y })} />
          </Field>
          <Field label="W">
            <NumberField
              value={element.width}
              onChange={(width) => {
                if (element.type === "qr") {
                  const side = clampQrSideMm(width);
                  onChange({ width: side, height: side });
                  return;
                }
                if (element.type === "barcode") {
                  onChange({ width: Math.max(BARCODE_MIN_WIDTH_MM, width) });
                  return;
                }
                onChange({ width });
              }}
            />
          </Field>
          <Field label="H">
            <NumberField
              value={element.height}
              onChange={(height) => {
                if (element.type === "qr") {
                  const side = clampQrSideMm(height);
                  onChange({ width: side, height: side });
                  return;
                }
                if (element.type === "barcode") {
                  onChange({ height: Math.max(BARCODE_MIN_HEIGHT_MM, height) });
                  return;
                }
                onChange({ height });
              }}
            />
          </Field>
        </div>
        {element.type === "qr" ? (
          <p className="text-[11px] text-muted-foreground">
            QR codes stay square and at least {QR_MIN_SIDE_MM} mm so scanners can read them.
          </p>
        ) : null}
        <InspectorTypeFields
          element={element}
          onChange={onChange}
          onOrientLine={onOrientLine}
          onPickImage={onPickImage}
        />
      </div>
    </div>
  );
}

