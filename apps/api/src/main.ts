import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AUTH } from "./auth/auth.module";
import { loadApiEnv } from "./env";

loadEnv({ path: resolve(process.cwd(), "../../.env.production") });
loadEnv({ path: resolve(process.cwd(), "../../.env.example") });

async function bootstrap() {
  const env = loadApiEnv();
  if (env.OPENROUTER_ENABLED) {
    throw new Error("OpenRouter must remain disabled in Phase 2");
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()),
    credentials: true,
  });

  const auth = app.get(AUTH);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.all("/api/auth/*", toNodeHandler(auth));

  if (env.NODE_ENV !== "production") {
    const swagger = new DocumentBuilder().setTitle("SHOTBRO API").setVersion("1.0").build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(env.PORT, "0.0.0.0");
}

bootstrap();
