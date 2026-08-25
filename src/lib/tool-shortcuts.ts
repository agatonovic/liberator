import type { Tool } from "@/lib/store";

type ToolShortcut = {
  code: string;
  shift?: boolean;
  label: string;
};

/** Figma / Photoshop-style single-key tools. Shift variants match Figma (⇧L = arrow). */
export const TOOL_SHORTCUTS: Partial<Record<Tool, ToolShortcut>> = {
  select: { code: "KeyV", label: "V" },
  rect: { code: "KeyR", label: "R" },
  ellipse: { code: "KeyO", label: "O" },
  line: { code: "KeyL", label: "L" },
  arrow: { code: "KeyL", shift: true, label: "⇧L" },
  text: { code: "KeyT", label: "T" },
  image: { code: "KeyI", label: "I" },
  barcode: { code: "KeyB", label: "B" },
  qr: { code: "KeyQ", label: "Q" },
};

export function toolFromShortcut(event: KeyboardEvent): Tool | null {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return null;
  const shift = event.shiftKey;
  let matched: Tool | null = null;
  for (const [tool, shortcut] of Object.entries(TOOL_SHORTCUTS) as [Tool, ToolShortcut][]) {
    if (shortcut.code !== event.code) continue;
    if (Boolean(shortcut.shift) !== shift) continue;
    matched = tool;
    break;
  }
  return matched;
}

export function toolShortcutLabel(tool: Tool): string | undefined {
  return TOOL_SHORTCUTS[tool]?.label;
}
