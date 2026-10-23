import type { Request, Response, NextFunction } from "express";

const PUBLIC_PATHS = new Set(["/api/v1/health/live", "/api/v1/health/ready"]);

/** When STAGING_GATE_SECRET is set, require X-Shotbro-Staging-Gate on all /api routes except health. */
export function stagingGateMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (!path.startsWith("/api")) return next();
    if (path.startsWith("/api/auth")) return next();
    if (PUBLIC_PATHS.has(path)) return next();
    const header = req.headers["x-shotbro-staging-gate"];
    if (typeof header === "string" && header === secret) return next();
    res.status(401).json({ statusCode: 401, message: "Staging access denied" });
  };
}
