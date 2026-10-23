"use client";

import { cn } from "@/lib/utils";

export function StudioBlockCard({
  children,
  className,
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-[var(--sb-surface)]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
        accent && "border-primary/25 ring-1 ring-primary/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StudioBlockCardHeader({
  title,
  aside,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 border-b border-border/50 px-4 py-3",
        className,
      )}
    >
      <h3 className="text-sm font-semibold leading-snug tracking-tight">{title}</h3>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function StudioBlockCardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}
