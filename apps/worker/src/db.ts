import { createDb } from "@shotbro/db/client";

let dbBundle: ReturnType<typeof createDb> | null = null;

export function getWorkerDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required for production worker");
  if (!dbBundle) dbBundle = createDb(url);
  return dbBundle.db;
}
