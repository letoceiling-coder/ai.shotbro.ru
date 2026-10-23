"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type StudioRuntimeMode = "DEMO" | "REAL";

const StudioModeContext = createContext<{
  mode: StudioRuntimeMode;
  setMode: (m: StudioRuntimeMode) => void;
} | null>(null);

const MODE_KEY = "shotbro-studio-mode-v1";

function readStoredMode(): StudioRuntimeMode {
  if (typeof window === "undefined") return "DEMO";
  const v = window.localStorage.getItem(MODE_KEY);
  return v === "REAL" ? "REAL" : "DEMO";
}

export function StudioModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StudioRuntimeMode>("DEMO");
  const setMode = (m: StudioRuntimeMode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(MODE_KEY, m);
  };
  useEffect(() => {
    setModeState(readStoredMode());
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <StudioModeContext.Provider value={value}>{children}</StudioModeContext.Provider>;
}

export function useStudioRuntimeMode() {
  const ctx = useContext(StudioModeContext);
  if (!ctx) throw new Error("StudioModeProvider missing");
  return ctx;
}
