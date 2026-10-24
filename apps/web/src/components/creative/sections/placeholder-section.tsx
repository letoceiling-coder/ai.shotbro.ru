"use client";

import { Badge } from "@/components/ui/badge";

export function PlaceholderSection({ title, phase, hint }: { title: string; phase: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Badge variant="outline">Phase {phase}</Badge>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
