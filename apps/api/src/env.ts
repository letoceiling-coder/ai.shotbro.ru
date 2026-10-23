import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://redis:6379"),
  APP_URL: z.string().url().default("https://ai.shotbro.ru"),
  BETTER_AUTH_SECRET: z.string().min(32),
  TRUSTED_ORIGINS: z.string().default("https://ai.shotbro.ru,http://localhost:3000"),
  OPENROUTER_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  ALLOW_PUBLIC_REGISTER: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  STAGING_GATE_SECRET: z.string().min(16).optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  S3_PRESIGNED_URL_TTL_SECONDS: z.coerce.number().default(300),
  S3_MAX_UPLOAD_SIZE_MB: z.coerce.number().default(500),
  EMAIL_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type ApiEnv = z.infer<typeof schema>;

export function loadApiEnv(): ApiEnv {
  return schema.parse(process.env);
}
