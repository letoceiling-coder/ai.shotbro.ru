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
import { createS3Client, ensureS3Bucket } from "@shotbro/config/s3";
import { assertLiveMediaStartupPolicy } from "@shotbro/config/live-media-policy";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { stagingGateMiddleware } from "./common/staging-gate.middleware";
import { loadApiEnv } from "./env";

loadEnv({ path: resolve(process.cwd(), "../../.env.production") });
loadEnv({ path: resolve(process.cwd(), "../../.env.example") });

async function bootstrap() {
  const env = loadApiEnv();
  if (env.OPENROUTER_ENABLED && !env.LLM_LIVE_EXECUTION_ENABLED) {
    throw new Error("OPENROUTER_ENABLED requires LLM_LIVE_EXECUTION_ENABLED (Phase 5K creative agent only)");
  }
  // Phase 6B: explicit live-media rules (mock mode, budget caps, approval enforcement) instead of
  // the Phase 5K blanket "OpenRouter + media" ban. Still fails closed until 6C enforcement ships.
  assertLiveMediaStartupPolicy(loadEnvFromProcess());

  const s3 = createS3Client({
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: env.S3_FORCE_PATH_STYLE,
  });
  await ensureS3Bucket(s3, env.S3_BUCKET);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()),
    credentials: true,
  });

  const auth = app.get(AUTH);
  const expressApp = app.getHttpAdapter().getInstance();
  if (env.STAGING_GATE_SECRET) {
    expressApp.use(stagingGateMiddleware(env.STAGING_GATE_SECRET));
  }
  expressApp.all("/api/auth/*", toNodeHandler(auth));

  if (env.NODE_ENV !== "production") {
    const swagger = new DocumentBuilder().setTitle("SHOTBRO API").setVersion("1.0").build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(env.PORT, "0.0.0.0");
}

bootstrap();
