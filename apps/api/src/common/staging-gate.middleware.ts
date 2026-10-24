import type { Request, Response, NextFunction } from "express";

const PUBLIC_PATHS = new Set(["/api/v1/health/live", "/api/v1/health/ready"]);
const PROVISION_PATH = "/api/v1/internal/integration-users/provision";

function isLocalProvisioner(req: Request): boolean {
  if (process.env.INTEGRATION_PROVISION_ENABLED !== "true") return false;
  const provisionSecret = process.env.INTEGRATION_PROVISION_SECRET;
  if (!provisionSecret || provisionSecret.length < 32) return false;
  const header = req.headers["x-shotbro-integration-provision"];
  if (header !== provisionSecret) return false;
  const ip = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  return ip === "127.0.0.1" || ip === "::1";
}

/** When STAGING_GATE_SECRET is set, require X-Shotbro-Staging-Gate on all /api routes except health. */
export function stagingGateMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (!path.startsWith("/api")) return next();
    if (path.startsWith("/api/auth")) return next();
    if (PUBLIC_PATHS.has(path)) return next();
    if (path === PROVISION_PATH && isLocalProvisioner(req)) return next();
    const header = req.headers["x-shotbro-staging-gate"];
    if (typeof header === "string" && header === secret) return next();
    res.status(401).json({ statusCode: 401, message: "Staging access denied" });
  };
}
