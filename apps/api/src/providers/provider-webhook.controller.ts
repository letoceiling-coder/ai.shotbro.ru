import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ProviderJobsService } from "./provider-jobs.service";

const WebhookBodySchema = z.object({
  eventId: z.string(),
  providerJobId: z.string(),
  status: z.enum(["COMPLETED", "FAILED", "RUNNING"]),
  timestamp: z.number().int(),
});

@ApiTags("provider-webhooks")
@Controller("api/v1/internal/provider-webhooks")
export class ProviderWebhookController {
  constructor(@Inject(ProviderJobsService) private readonly jobs: ProviderJobsService) {}

  @Post(":providerId")
  async receive(
    @Param("providerId") providerId: string,
    @Headers("x-shotbro-signature") signature: string | undefined,
    @Headers("x-shotbro-timestamp") timestamp: string | undefined,
    @Body() body: unknown,
  ) {
    const secret = process.env.MOCK_PROVIDER_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException("Webhook disabled");
    if (!signature || !timestamp) throw new UnauthorizedException("Missing signature");
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      throw new UnauthorizedException("Stale timestamp");
    }
    const raw = JSON.stringify(body);
    const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException("Invalid signature");
    }

    const parsed = WebhookBodySchema.parse(body);
    const ok = await this.jobs.applyWebhookEvent(providerId, parsed);
    if (!ok) throw new BadRequestException("Duplicate or unknown job");
    return { ok: true };
  }
}
