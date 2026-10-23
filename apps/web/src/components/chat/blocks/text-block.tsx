"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function TextBlockView({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-invert max-w-none text-sm leading-relaxed prose-p:my-1.5 prose-p:leading-relaxed prose-strong:text-foreground prose-a:text-primary",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
