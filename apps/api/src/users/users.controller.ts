import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";

@Controller("api/v1/users")
@UseGuards(SessionGuard)
export class UsersController {
  @Get("me")
  me(@Req() req: AuthedRequest) {
    return {
      ...req.user,
      studioMode: "REAL" as const,
    };
  }
}
