"use client";

import { cn } from "@/lib/utils";

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

function shortcut(key: string) {
  return isMac() ? `⌘${key}` : `Ctrl+${key}`;
}

export function CanvasContextMenu({
  x,
  y,
  canCopy,
  canPaste,
  canGroup = false,
  canUngroup = false,
  onCopy,
  onPaste,
  onPasteInPlace,
  onDuplicate,
  onGroup,
  onUngroup,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  canCopy: boolean;
  canPaste: boolean;
  canGroup?: boolean;
  canUngroup?: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onPasteInPlace: () => void;
  onDuplicate: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close menu"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 min-w-44 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        style={{ left: x, top: y }}
        role="menu"
      >
        <MenuRow
          label="Copy"
          hint={shortcut("C")}
          disabled={!canCopy}
          onClick={onCopy}
        />
        <MenuRow
          label="Paste"
          hint={shortcut("V")}
          disabled={!canPaste}
          onClick={onPaste}
        />
        <MenuRow
          label="Paste in place"
          hint={isMac() ? "⇧⌘V" : "Ctrl+Shift+V"}
          disabled={!canPaste}
          onClick={onPasteInPlace}
        />
        <MenuRow
          label="Duplicate"
          hint={shortcut("D")}
          disabled={!canCopy}
          onClick={onDuplicate}
        />
        <MenuRow
          label="Group"
          hint={shortcut("G")}
          disabled={!canGroup}
          onClick={() => onGroup?.()}
        />
        <MenuRow
          label="Ungroup"
          hint={isMac() ? "⇧⌘G" : "Ctrl+Shift+G"}
          disabled={!canUngroup}
          onClick={() => onUngroup?.()}
        />
        <div className="my-1 h-px bg-border" />
        <MenuRow label="Delete" hint="⌫" disabled={!canCopy} destructive onClick={onDelete} />
      </div>
    </>
  );
}

function MenuRow({
  label,
  hint,
  disabled,
  destructive,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-6 rounded-md px-2 py-1.5 text-left text-sm",
        disabled
          ? "cursor-default opacity-40"
          : destructive
            ? "text-destructive hover:bg-destructive/10"
            : "hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <span>{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}
