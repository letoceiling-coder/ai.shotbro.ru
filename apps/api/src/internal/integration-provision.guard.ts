import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { loadApiEnv } from "../env";

const PROVISION_HEADER = "x-shotbro-integration-provision";

/** Never use req.ip — it may reflect X-Forwarded-For when trust proxy is enabled. */
function isDirectLoopback(req: Request): boolean {
  const ip = req.socket.remoteAddress ?? "";
  const normalized = ip.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1";
}

function provisioningEnabled(): boolean {
  return process.env.INTEGRATION_PROVISION_ENABLED === "true";
}

@Injectable()
export class IntegrationProvisionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    loadApiEnv();
    if (!provisioningEnabled()) {
      throw new ForbiddenException("Integration provisioning is disabled");
    }
    const secret = process.env.INTEGRATION_PROVISION_SECRET;
    if (!secret || secret.length < 32) {
      throw new ForbiddenException("Integration provisioning is not enabled on this server");
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!isDirectLoopback(req)) {
      throw new ForbiddenException("Integration provisioning is only allowed from loopback inside the API container");
    }

    const header = req.headers[PROVISION_HEADER];
    if (typeof header !== "string" || header !== secret) {
      throw new UnauthorizedException("Invalid integration provision secret");
    }
    return true;
  }
}
