"use client";

import { cn } from "@/lib/utils";
import { serializeTsv } from "@/lib/grid";
import type { DataRow } from "@/lib/resolve";
import { useEffect, useMemo, useRef, useState } from "react";

type Sel = { r0: number; c0: number; r1: number; c1: number };

function norm(sel: Sel): Sel {
  return {
    r0: Math.min(sel.r0, sel.r1),
    c0: Math.min(sel.c0, sel.c1),
    r1: Math.max(sel.r0, sel.r1),
    c1: Math.max(sel.c0, sel.c1),
  };
}

function inSel(sel: Sel, r: number, c: number) {
  const box = norm(sel);
  return r >= box.r0 && r <= box.r1 && c >= box.c0 && c <= box.c1;
}

function colLetter(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const ROW_PX = 24;
const GROW_BATCH = 24;

export function Spreadsheet({
  headers,
  rows,
  columnHints,
  requiredHeaders,
  issueCells,
  focusCell,
  activeRow,
  onActiveRow,
  onChangeCell,
  onChangeCells,
  onPasteMatrix,
  onEnsureRows,
  onToggleRequired,
}: {
  headers: string[];
  rows: DataRow[];
  columnHints?: Record<string, string>;
  requiredHeaders?: Set<string>;
  issueCells?: Set<string>;
  focusCell?: { row: number; header: string; n?: number } | null;
  activeRow: number;
  onActiveRow: (index: number) => void;
  onChangeCell: (rowIndex: number, header: string, value: string) => void;
  onChangeCells?: (updates: { rowIndex: number; header: string; value: string }[]) => void;
  onPasteMatrix: (rowIndex: number, colIndex: number, text: string) => void;
  onEnsureRows?: (minLength: number) => void;
  onToggleRequired?: (header: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingDownRef = useRef(false);
  const [sel, setSel] = useState<Sel>({ r0: 0, c0: 0, r1: 0, c1: 0 });
  const [editing, setEditing] = useState<{ r: number; c: number; value: string } | null>(null);
  const dragRef = useRef(false);
  const active = useMemo(() => ({ r: sel.r0, c: sel.c0 }), [sel.r0, sel.c0]);
  const grow = onEnsureRows;

  useEffect(() => {
    if (!focusCell) return;
    const c = headers.indexOf(focusCell.header);
    const r = Math.min(Math.max(0, focusCell.row), Math.max(0, rows.length - 1));
    setSel({ r0: r, c0: Math.max(0, c), r1: r, c1: Math.max(0, c) });
    const table = scrollRef.current;
    const cell = table?.querySelector(`[data-grid-cell="${r}:${Math.max(0, c)}"]`);
    if (cell instanceof HTMLElement) cell.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusCell?.n, focusCell?.row, focusCell?.header, headers, rows.length]);

  useEffect(() => {
    function endDrag() {
      dragRef.current = false;
    }
    window.addEventListener("mouseup", endDrag);
    return () => window.removeEventListener("mouseup", endDrag);
  }, []);

  useEffect(() => {
    setSel((prev) => ({
      r0: Math.min(prev.r0, Math.max(0, rows.length - 1)),
      r1: Math.min(prev.r1, Math.max(0, rows.length - 1)),
      c0: Math.min(prev.c0, Math.max(0, headers.length - 1)),
      c1: Math.min(prev.c1, Math.max(0, headers.length - 1)),
    }));
  }, [headers.length, rows.length]);

  useEffect(() => {
    if (!pendingDownRef.current || rows.length <= sel.r0 + 1) return;
    pendingDownRef.current = false;
    const r = Math.min(sel.r0 + 1, rows.length - 1);
    setSel((prev) => ({ r0: r, c0: prev.c0, r1: r, c1: prev.c0 }));
    onActiveRow(r);
  }, [onActiveRow, rows.length, sel.r0]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !grow) return;
    function maybeGrow() {
      if (!el || !grow) return;
      if (el.scrollHeight - el.clientHeight - el.scrollTop < ROW_PX * 4) {
        grow(rows.length + GROW_BATCH);
      }
    }
    maybeGrow();
    el.addEventListener("scroll", maybeGrow, { passive: true });
    const observer = new ResizeObserver(maybeGrow);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", maybeGrow);
      observer.disconnect();
    };
  }, [grow, rows.length]);

  function cellValue(r: number, c: number) {
    const header = headers[c];
    if (!header) return "";
    return String(rows[r]?.[header] ?? "");
  }

  function commitEdit() {
    if (!editing) return;
    const header = headers[editing.c];
    if (header) onChangeCell(editing.r, header, editing.value);
    setEditing(null);
  }

  function clearSelection() {
    const box = norm(sel);
    const updates: { rowIndex: number; header: string; value: string }[] = [];
    for (let r = box.r0; r <= box.r1; r += 1) {
      for (let c = box.c0; c <= box.c1; c += 1) {
        const header = headers[c];
        if (header) updates.push({ rowIndex: r, header, value: "" });
      }
    }
    if (onChangeCells) onChangeCells(updates);
    else updates.forEach((update) => onChangeCell(update.rowIndex, update.header, update.value));
  }

  function selectedGrid() {
    const box = norm(sel);
    const grid: string[][] = [];
    for (let r = box.r0; r <= box.r1; r += 1) {
      const line: string[] = [];
      for (let c = box.c0; c <= box.c1; c += 1) line.push(cellValue(r, c));
      grid.push(line);
    }
    return grid;
  }

  function move(dr: number, dc: number, extend: boolean) {
    setSel((prev) => {
      const r = Math.min(Math.max(0, (extend ? prev.r1 : prev.r0) + dr), rows.length - 1);
      const c = Math.min(Math.max(0, (extend ? prev.c1 : prev.c0) + dc), headers.length - 1);
      const next = extend ? { ...prev, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c };
      onActiveRow(next.r0);
      return next;
    });
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-white outline-none"
      onMouseDown={() => rootRef.current?.focus()}
      onKeyDown={(event) => {
        if (editing) {
          if (event.key === "Enter") {
            event.preventDefault();
            commitEdit();
            if (!event.shiftKey && active.r >= rows.length - 1 && grow) {
              pendingDownRef.current = true;
              grow(rows.length + GROW_BATCH);
              return;
            }
            move(event.shiftKey ? -1 : 1, 0, false);
          }
          if (event.key === "Tab") {
            event.preventDefault();
            commitEdit();
            move(0, event.shiftKey ? -1 : 1, false);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setEditing(null);
          }
          return;
        }
        const cmd = event.metaKey || event.ctrlKey;
        if (cmd && event.key.toLowerCase() === "c") {
          event.preventDefault();
          void navigator.clipboard.writeText(serializeTsv(selectedGrid()));
          return;
        }
        if (cmd && event.key.toLowerCase() === "x") {
          event.preventDefault();
          void navigator.clipboard.writeText(serializeTsv(selectedGrid()));
          clearSelection();
          return;
        }
        if (cmd && event.key.toLowerCase() === "v") return;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1, 0, event.shiftKey);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          if (!event.shiftKey && active.r >= rows.length - 1 && grow) {
            pendingDownRef.current = true;
            grow(rows.length + GROW_BATCH);
            return;
          }
          move(1, 0, event.shiftKey);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(0, -1, event.shiftKey);
        } else if (event.key === "ArrowRight" || event.key === "Tab") {
          event.preventDefault();
          move(0, event.key === "Tab" && event.shiftKey ? -1 : 1, event.key !== "Tab" && event.shiftKey);
        } else if (event.key === "Enter") {
          event.preventDefault();
          setEditing({ r: active.r, c: active.c, value: cellValue(active.r, active.c) });
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          clearSelection();
        } else if (event.key.length === 1 && !cmd && !event.altKey) {
          setEditing({ r: active.r, c: active.c, value: event.key });
        }
      }}
      onPaste={(event) => {
        const text = event.clipboardData.getData("text/plain");
        if (!text) return;
        event.preventDefault();
        event.stopPropagation();
        if (editing) return;
        onPasteMatrix(norm(sel).r0, norm(sel).c0, text);
      }}
      onCopy={(event) => {
        event.preventDefault();
        event.clipboardData.setData("text/plain", serializeTsv(selectedGrid()));
      }}
    >
      <div className="flex h-7 shrink-0 items-center border-b border-[#d0d7de] bg-[#f3f3f3] px-2 font-mono text-[12px] text-[#1f1f1f]">
        <span className="w-14 shrink-0 text-[#217346]">
          {colLetter(active.c)}
          {active.r + 1}
        </span>
        <span className="truncate">{editing ? editing.value : cellValue(active.r, active.c)}</span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-[12px] select-none">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 h-6 w-10 border-r border-b border-[#d0d7de] bg-[#f8f9fa] font-normal text-[#5f6368]" />
              {headers.map((header, c) => {
                const required = requiredHeaders?.has(header);
                const hint = columnHints?.[header];
                return (
                <th
                  key={header}
                  title={
                    onToggleRequired
                      ? required
                        ? "Required. Click to allow empty cells."
                        : "Optional. Click to require a value."
                      : hint
                  }
                  className={cn(
                    "h-6 min-w-[132px] border-r border-b border-[#d0d7de] bg-[#f8f9fa] px-2 text-left font-semibold text-[#3c4043]",
                    c >= Math.min(sel.c0, sel.c1) && c <= Math.max(sel.c0, sel.c1) && "bg-[#e6f4ea]",
                  )}
                >
                  {onToggleRequired ? (
                    <button
                      type="button"
                      className="flex max-w-full items-center gap-0.5 truncate text-left"
                      onClick={() => onToggleRequired(header)}
                    >
                      <span className="truncate">{header}</span>
                      {required ? <span className="text-[#c5221f]">*</span> : null}
                    </button>
                  ) : (
                    header
                  )}
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} data-grid-row={r}>
                <th
                  className={cn(
                    "sticky left-0 z-10 h-6 w-10 border-r border-b border-[#d0d7de] bg-[#f8f9fa] text-center font-normal text-[#5f6368]",
                    r === activeRow && "bg-[#e6f4ea] font-semibold text-[#137333]",
                  )}
                >
                  {r + 1}
                </th>
                {headers.map((header, c) => {
                  const selected = inSel(sel, r, c);
                  const isActive = active.r === r && active.c === c;
                  const isEdit = editing?.r === r && editing?.c === c;
                  const hasIssue = issueCells?.has(`${r}:${header}`);
                  return (
                    <td
                      key={header}
                      data-grid-cell={`${r}:${c}`}
                      className={cn(
                        "relative h-6 min-w-[132px] border-r border-b border-[#d0d7de] bg-white px-1.5 align-middle",
                        r === activeRow && !selected && "bg-[#f8fbf8]",
                        hasIssue && !selected && "bg-[#fef7e0]",
                        selected && !isActive && "bg-[#e2efda]",
                        isActive && "bg-white",
                      )}
                      title={hasIssue ? "Needs attention" : undefined}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        if (isEdit) return;
                        commitEdit();
                        dragRef.current = true;
                        const next = event.shiftKey
                          ? { ...sel, r1: r, c1: c }
                          : { r0: r, c0: c, r1: r, c1: c };
                        setSel(next);
                        onActiveRow(r);
                      }}
                      onMouseEnter={() => {
                        if (!dragRef.current) return;
                        setSel((prev) => ({ ...prev, r1: r, c1: c }));
                      }}
                      onMouseUp={() => {
                        dragRef.current = false;
                      }}
                      onDoubleClick={() => {
                        setEditing({ r, c, value: cellValue(r, c) });
                      }}
                    >
                      {isEdit ? (
                        <input
                          autoFocus
                          value={editing.value}
                          className="absolute inset-0 z-10 h-full w-full border-2 border-[#217346] bg-white px-1.5 outline-none"
                          onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                          onBlur={commitEdit}
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <span className="block truncate">{row[header]}</span>
                      )}
                      {isActive && !isEdit ? (
                        <span className="pointer-events-none absolute inset-0 border-2 border-[#217346]" />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
