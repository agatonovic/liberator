"use client";

import { Hint } from "@/components/hint";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Tool } from "@/lib/store";
import type { PolygonType } from "@/lib/document";
import { toolShortcutLabel } from "@/lib/tool-shortcuts";
import {
  ArrowLeftRight,
  ArrowRight,
  Barcode,
  Circle,
  Diamond,
  Hexagon,
  ImageIcon,
  Minus,
  MousePointer2,
  Plus,
  QrCode,
  Shapes,
  Square,
  Star,
  Triangle,
  Type,
  X,
} from "lucide-react";

const TOOLS: { id: Tool; label: string; icon: typeof Square }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "line", label: "Line (Shift: vertical)", icon: Minus },
];

const CONTENT_TOOLS: { id: Tool; label: string; icon: typeof Square }[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "barcode", label: "Barcode", icon: Barcode },
  { id: "qr", label: "QR code", icon: QrCode },
  { id: "image", label: "Image placeholder", icon: ImageIcon },
];

const SHAPE_TOOLS: { id: PolygonType; label: string; hint: string; icon: typeof Square }[] = [
  { id: "arrow", label: "Arrow", hint: "Direction, this-way, flow", icon: ArrowRight },
  { id: "doubleArrow", label: "Double arrow", hint: "Two-way, dimensions", icon: ArrowLeftRight },
  { id: "triangle", label: "Triangle", hint: "Warning, caution, fragile", icon: Triangle },
  { id: "diamond", label: "Diamond", hint: "Hazard / GHS frames", icon: Diamond },
  { id: "star", label: "Star", hint: "Quality, rating, featured", icon: Star },
  { id: "hexagon", label: "Hexagon", hint: "Hardware, marks", icon: Hexagon },
  { id: "plus", label: "Plus", hint: "Medical, first aid", icon: Plus },
  { id: "cross", label: "Cross", hint: "Void, reject, do not", icon: X },
];

const SHAPE_IDS = new Set<string>(SHAPE_TOOLS.map((item) => item.id));

export function DesignerToolbar({
  tool,
  onTool,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
}) {
  const shapeActive = SHAPE_IDS.has(tool);

  return (
    <div className="flex flex-col gap-1 border-r border-border bg-card px-2 py-3">
      {TOOLS.map((item) => {
        const Icon = item.icon;
        const active = tool === item.id;
        return (
          <Hint key={item.id} label={item.label} shortcut={toolShortcutLabel(item.id)} side="right">
            <Button
              variant={active ? "default" : "ghost"}
              size="icon"
              className={cn("size-9", !active && "text-muted-foreground")}
              onClick={() => onTool(item.id)}
            >
              <Icon className="size-4" />
            </Button>
          </Hint>
        );
      })}
      <DropdownMenu>
      <Hint label="Shapes" side="right">
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: shapeActive ? "default" : "ghost", size: "icon" }),
            "size-9",
            !shapeActive && "text-muted-foreground",
          )}
        >
          <Shapes className="size-4" />
        </DropdownMenuTrigger>
      </Hint>
        <DropdownMenuContent side="right" align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Label shapes</DropdownMenuLabel>
            {SHAPE_TOOLS.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.id} onClick={() => onTool(item.id)}>
                  <Icon className="size-4" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span>{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.hint}</span>
                  </span>
                  {toolShortcutLabel(item.id) ? (
                    <span className="text-[10px] text-muted-foreground">{toolShortcutLabel(item.id)}</span>
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {CONTENT_TOOLS.map((item) => {
        const Icon = item.icon;
        const active = tool === item.id;
        return (
          <Hint key={item.id} label={item.label} shortcut={toolShortcutLabel(item.id)} side="right">
            <Button
              variant={active ? "default" : "ghost"}
              size="icon"
              className={cn("size-9", !active && "text-muted-foreground")}
              onClick={() => onTool(item.id)}
            >
              <Icon className="size-4" />
            </Button>
          </Hint>
        );
      })}
    </div>
  );
}
