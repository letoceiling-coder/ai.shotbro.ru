import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { MessagesModule } from "./messages/messages.module";
import { ProjectsModule } from "./projects/projects.module";
import { UploadsModule } from "./uploads/uploads.module";
import { UsersController } from "./users/users.controller";
import { ApprovalsModule } from "./approvals/approvals.module";
import { EventsModule } from "./events/events.module";
import { ConversationsModule } from "./conversations/conversations.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        redact: ["req.headers.cookie", "req.headers.authorization"],
        transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    ProjectsModule,
    MessagesModule,
    UploadsModule,
    ApprovalsModule,
    EventsModule,
    ConversationsModule,
  ],
  controllers: [HealthController, UsersController],
})
export class AppModule {}
