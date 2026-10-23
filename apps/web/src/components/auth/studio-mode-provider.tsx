"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type StudioRuntimeMode = "DEMO" | "REAL";

const StudioModeContext = createContext<{
  mode: StudioRuntimeMode;
  setMode: (m: StudioRuntimeMode) => void;
} | null>(null);

export function StudioModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<StudioRuntimeMode>("DEMO");
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <StudioModeContext.Provider value={value}>{children}</StudioModeContext.Provider>;
}

export function useStudioRuntimeMode() {
  const ctx = useContext(StudioModeContext);
  if (!ctx) throw new Error("StudioModeProvider missing");
  return ctx;
}
