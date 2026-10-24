import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

const ROLLOUT_HEADER = "x-shotbro-integration-rollout";

function isDirectLoopback(req: Request): boolean {
  const ip = req.socket.remoteAddress ?? "";
  const normalized = ip.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1";
}

@Injectable()
export class IntegrationRolloutGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.INTEGRATION_ROLLOUT_ENABLED !== "true") {
      throw new ForbiddenException("Integration rollout API is disabled");
    }
    const secret = process.env.INTEGRATION_ROLLOUT_SECRET ?? process.env.INTEGRATION_PROVISION_SECRET;
    if (!secret || secret.length < 32) {
      throw new ForbiddenException("Integration rollout secret is not configured");
    }
    const req = context.switchToHttp().getRequest<Request>();
    if (!isDirectLoopback(req)) {
      throw new ForbiddenException("Integration rollout is only allowed from loopback inside the API container");
    }
    const header = req.headers[ROLLOUT_HEADER];
    if (typeof header !== "string" || header !== secret) {
      throw new UnauthorizedException("Invalid integration rollout secret");
    }
    return true;
  }
}
