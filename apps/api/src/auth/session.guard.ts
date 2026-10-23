import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "./auth.config";
import { AUTH } from "./auth.constants";

export type AuthedRequest = {
  user: { id: string; email: string; name: string; emailVerified: boolean };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) throw new UnauthorizedException();
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
    };
    return true;
  }
}
