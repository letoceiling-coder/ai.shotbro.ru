"use client";

import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useMemo, useState } from "react";
import { Toaster } from "sonner";
import { StudioModeProvider } from "@/components/auth/studio-mode-provider";
import type { ThreadMessageLike } from "@assistant-ui/react";

/** Demo runtime: chat content is driven by Zustand, not LLM streaming. */
function DemoAssistantProvider({ children }: { children: React.ReactNode }) {
  const runtime = useExternalStoreRuntime({
    messages: [] as ThreadMessageLike[],
    isRunning: false,
    convertMessage: (message) => message,
    onNew: async () => {
      /* composer handled by ChatComposer + Zustand */
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const content = useMemo(
    () => (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <StudioModeProvider>
            <DemoAssistantProvider>{children}</DemoAssistantProvider>
          </StudioModeProvider>
          <Toaster richColors closeButton theme="dark" />
        </QueryClientProvider>
      </ThemeProvider>
    ),
    [queryClient],
  );

  return content;
}
