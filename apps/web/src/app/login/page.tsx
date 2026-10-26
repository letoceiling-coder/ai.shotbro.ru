"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const MODE_KEY = "shotbro-studio-mode-v1";

function readLoginRedirect() {
  if (typeof window === "undefined") return { returnTo: "/studio", realMode: false };
  const params = new URLSearchParams(window.location.search);
  return {
    returnTo: params.get("return") || "/studio",
    realMode: params.get("mode") === "real",
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      setError("Не удалось войти. Проверьте email и пароль.");
      return;
    }
    const { returnTo, realMode } = readLoginRedirect();
    if (realMode) window.localStorage.setItem(MODE_KEY, "REAL");
    router.push(returnTo);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
            SB
          </div>
          <span className="text-lg font-semibold">SHOTBRO AI Studio</span>
        </div>
        <h1 className="mb-6 text-xl font-semibold">Вход</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Вход…" : "Войти"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Регистрация
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/studio" className="text-muted-foreground hover:underline">
            Вернуться в студию (DEMO)
          </Link>
        </p>
      </div>
    </div>
  );
}
