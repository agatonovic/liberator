"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cloneElement, type ReactElement } from "react";

export function Hint({
  label,
  shortcut,
  side = "bottom",
  className,
  children,
}: {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: ReactElement<{ className?: string; disabled?: boolean }>;
}) {
  const disabled = Boolean(children.props.disabled);
  const trigger = className ? cloneElement(children, { className: cn(children.props.className, className) }) : children;

  return (
    <Tooltip>
      {disabled ? (
        <TooltipTrigger delay={0} closeDelay={0} render={<span className="inline-flex" />}>
          {trigger}
        </TooltipTrigger>
      ) : (
        <TooltipTrigger delay={0} closeDelay={0} render={trigger} />
      )}
      <TooltipContent side={side} sideOffset={6}>
        <span>{label}</span>
        {shortcut ? <span className="text-white/55">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
