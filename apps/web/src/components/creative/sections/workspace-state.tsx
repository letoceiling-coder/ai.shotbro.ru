"use client";

export function WorkspaceState({
  title,
  state,
  message,
}: {
  title: string;
  state: "loading" | "empty";
  message?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center" data-testid="workspace-state">
      <h2 className="text-lg font-semibold">{title}</h2>
      {state === "loading" ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
      {message ? <p className="max-w-md text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
