import { z } from "zod";

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1");

const emptyToUndefined = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

/** Map common Beget/docs names to canonical env keys (does not mutate input). */
export function applySmtpEnvAliases(
  partial: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out = { ...partial };
  if (!out.SMTP_PASSWORD?.trim() && out.SMTP_PASS?.trim()) {
    out.SMTP_PASSWORD = out.SMTP_PASS;
  }
  if (!out.SMTP_FROM_EMAIL?.trim() && out.SMTP_FROM?.trim()) {
    out.SMTP_FROM_EMAIL = out.SMTP_FROM;
  }
  return out;
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().optional(),

    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(8).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(8).optional(),
    S3_FORCE_PATH_STYLE: boolFromEnv.default(false),
    S3_PRESIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(300),
    S3_MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(5120).default(500),

    OPENROUTER_API_KEY: emptyToUndefined,
    OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    OPENROUTER_ENABLED: boolFromEnv.default(false),
    OPENROUTER_ALLOW_PAID_REQUESTS: boolFromEnv.default(false),
    OPENROUTER_DEFAULT_MODEL: emptyToUndefined,
    OPENROUTER_MAX_COST_USD: z.coerce.number().min(0).default(0),

    /** Phase 4E: vendor keys (optional; live execution still blocked by policy flags) */
    FAL_API_KEY: emptyToUndefined,
    MAGNIFIC_API_KEY: emptyToUndefined,
    /** Magnific inbound webhook HMAC (VPS staging.env only; never commit) */
    MAGNIFIC_WEBHOOK_SECRET: emptyToUndefined,
    ELEVENLABS_API_KEY: emptyToUndefined,
    ELEVENLABS_BASE_URL: z.string().url().default("https://api.elevenlabs.io"),
    /** Phase 6: HeyGen persistent photo avatars + avatar video (VPS staging.env only; never commit) */
    HEYGEN_API_KEY: emptyToUndefined,
    HEYGEN_BASE_URL: z.string().url().default("https://api.heygen.com"),
    HEYGEN_WEBHOOK_SECRET: emptyToUndefined,

    /** Phase 3: force mock adapters and block external inference */
    AI_MOCK_MODE: boolFromEnv.default(true),
    /** Phase 3: when false, EXTERNAL_PAID tools still require explicit owner enable + approvals */
    PROVIDER_LIVE_EXECUTION_ENABLED: boolFromEnv.default(false),

    /** Phase 5K: OpenRouter LLM for creative agent (independent of media providers) */
    LLM_LIVE_EXECUTION_ENABLED: boolFromEnv.default(false),
    /** Phase 5K: all live AI media off by default */
    MEDIA_GENERATION_ENABLED: boolFromEnv.default(false),
    IMAGE_GENERATION_ENABLED: boolFromEnv.default(false),
    VIDEO_GENERATION_ENABLED: boolFromEnv.default(false),
    IMAGE_UPSCALE_ENABLED: boolFromEnv.default(false),
    MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED: boolFromEnv.default(false),

    /** Phase 5 multi-provider: per-vendor switches (ignored unless PROVIDER_LIVE_EXECUTION_ENABLED and !AI_MOCK_MODE) */
    FAL_PROVIDER_ENABLED: boolFromEnv.default(false),
    ELEVENLABS_PROVIDER_ENABLED: boolFromEnv.default(false),
    MAGNIFIC_PROVIDER_ENABLED: boolFromEnv.default(false),
    HEYGEN_PROVIDER_ENABLED: boolFromEnv.default(false),
    /** Phase 6 feature switches (still require live policy + vendor switch) */
    VOICE_CLONING_ENABLED: boolFromEnv.default(false),
    AVATAR_GENERATION_ENABLED: boolFromEnv.default(false),
    /** Phase 6G: live scene-canvas nodes (images/video/TTS via the approved canvas protocol only). */
    CANVAS_LIVE_GENERATION_ENABLED: boolFromEnv.default(false),
    /** Cheapest verified OpenRouter models (catalog 2026-10-30); change only together with the price catalog. */
    CANVAS_IMAGE_MODEL: z.string().default("bytedance-seed/seedream-5-0-flash"),
    CANVAS_VIDEO_MODEL: z.string().default("x-ai/grok-imagine-video-1.5-lite"),
    CANVAS_VIDEO_RESOLUTION: z.string().default("480p"),
    CANVAS_AVATAR_VIDEO_MODEL: z.string().default("heygen/avatar-iv"),
    /** Customer rule for real tests: clips and voice-overs ≤ 5 s (server clamps/refuses longer). */
    CANVAS_LIVE_MAX_SECONDS: z.coerce.number().int().min(1).max(10).default(5),
    /** Phase 6 minimal budget caps for live media (USD) */
    MEDIA_RUN_MAX_COST_USD: z.coerce.number().min(0).max(100).default(1),
    MEDIA_USER_DAILY_MAX_USD: z.coerce.number().min(0).max(500).default(3),
    /** Allow OpenRouter as simulated fallback target in routing (not live calls) */
    OPENROUTER_FALLBACK_ROUTING_ENABLED: boolFromEnv.default(true),

    /** Phase 4: run AgentRuntime before ProductionOrchestrator (mock-only; default off for Phase 3 parity) */
    PHASE4_AGENT_RUNTIME_ENABLED: boolFromEnv.default(false),
    /** Phase 4D: allow per-project AgentRuntime when project.settings.agentRuntimeV4 is set */
    PHASE4_PROJECT_SCOPED_ENABLED: boolFromEnv.default(false),

    SMTP_HOST: emptyToUndefined,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
    SMTP_SECURE: boolFromEnv.default(true),
    SMTP_USER: emptyToUndefined,
    SMTP_PASSWORD: emptyToUndefined,
    SMTP_FROM_EMAIL: emptyToUndefined,
    SMTP_FROM_NAME: z.string().default("SHOTBRO AI Studio"),
    EMAIL_ENABLED: boolFromEnv.default(false),
    EMAIL_VERIFICATION_REQUIRED: boolFromEnv.default(true),
    EMAIL_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(10080).default(60),
    EMAIL_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(100).default(5),
    /** Inbound address for site lead / contact forms (Phase 2+). */
    LEAD_NOTIFY_EMAIL: emptyToUndefined,
  })
  .superRefine((data, ctx) => {
    if (data.OPENROUTER_ENABLED && !data.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENROUTER_API_KEY is required when OPENROUTER_ENABLED=true",
        path: ["OPENROUTER_API_KEY"],
      });
    }
    if (data.OPENROUTER_ALLOW_PAID_REQUESTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENROUTER_ALLOW_PAID_REQUESTS must stay false until owner enables live AI",
        path: ["OPENROUTER_ALLOW_PAID_REQUESTS"],
      });
    }
    if (data.PROVIDER_LIVE_EXECUTION_ENABLED && data.AI_MOCK_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PROVIDER_LIVE_EXECUTION_ENABLED requires AI_MOCK_MODE=false",
        path: ["PROVIDER_LIVE_EXECUTION_ENABLED"],
      });
    }
    if (data.EMAIL_ENABLED) {
      if (!data.SMTP_HOST) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SMTP_HOST required", path: ["SMTP_HOST"] });
      }
      if (!data.SMTP_USER || !data.SMTP_PASSWORD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMTP_USER and SMTP_PASSWORD required when EMAIL_ENABLED=true",
          path: ["SMTP_USER"],
        });
      }
      if (!data.SMTP_FROM_EMAIL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMTP_FROM_EMAIL required",
          path: ["SMTP_FROM_EMAIL"],
        });
      }
    }
    const port = data.SMTP_PORT;
    const secure = data.SMTP_SECURE;
    if (port === 465 && !secure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_PORT=465 expects SMTP_SECURE=true (implicit TLS)",
        path: ["SMTP_SECURE"],
      });
    }
    if (port === 587 && secure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_PORT=587 usually uses SMTP_SECURE=false (STARTTLS)",
        path: ["SMTP_SECURE"],
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnvFromProcess(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(applySmtpEnvAliases({ ...env }));
}

export function loadEnvForOfflineCheck(partial: Record<string, string | undefined>): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  env?: AppEnv;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredForStorage = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  for (const key of requiredForStorage) {
    if (!partial[key]?.trim()) errors.push(`Missing ${key}`);
  }

  if (partial.S3_ENDPOINT && !/^https:\/\/.+/i.test(partial.S3_ENDPOINT)) {
    errors.push("S3_ENDPOINT must be an https URL");
  }

  if (partial.OPENROUTER_ENABLED === "true") {
    warnings.push("OPENROUTER_ENABLED=true — keep false until Phase 3");
  }
  if (partial.OPENROUTER_ALLOW_PAID_REQUESTS === "true") {
    errors.push("OPENROUTER_ALLOW_PAID_REQUESTS must be false in Phase 2");
  }
  if (partial.OPENROUTER_API_KEY && !partial.OPENROUTER_API_KEY.startsWith("sk-or-v1-")) {
    warnings.push("OPENROUTER_API_KEY format unexpected (expected sk-or-v1-…)");
  }

  if (partial.EMAIL_ENABLED === "true") {
    warnings.push("EMAIL_ENABLED=true — live SMTP only with explicit owner approval");
  }

  try {
    const env = envSchema.parse(applySmtpEnvAliases(partial));
    return { ok: errors.length === 0, errors, warnings, env };
  } catch (e) {
    if (e instanceof z.ZodError) {
      for (const issue of e.issues) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      errors.push("Invalid environment configuration");
    }
    return { ok: false, errors, warnings };
  }
}
