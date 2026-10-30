import { z } from "zod";
import type { ToolExecutor, ToolRunContext } from "../../tool-executor.js";

const labels = z
  .object({ language: z.string().optional(), gender: z.string().optional(), age: z.string().optional(), accent: z.string().optional() })
  .optional();

const createVoiceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("LIBRARY"), name: z.string().min(1), providerVoiceId: z.string().min(1), labels }),
  z.object({ kind: z.literal("DESIGNED"), name: z.string().min(1), designPrompt: z.string().min(20).max(1000), labels }),
  z.object({
    kind: z.literal("CLONED"),
    name: z.string().min(1),
    sampleAssetIds: z.array(z.string()).min(1).max(5),
    description: z.string().optional(),
    labels,
  }),
]);

const createAvatarInput = z.object({
  name: z.string().min(1),
  sourceAssetIds: z.array(z.string()).min(1).max(10),
  defaultVoiceProfileId: z.string().optional(),
  description: z.string().optional(),
});

const assignInput = z.object({
  characterId: z.string().min(1),
  voiceProfileId: z.string().nullable().optional(),
  avatarProfileId: z.string().nullable().optional(),
  avatarLookId: z.string().nullable().optional(),
});

const proposeInput = z.object({
  operation: z.enum(["VOICE_DESIGN", "VOICE_SAVE", "VOICE_CLONE", "AVATAR_TRAIN"]),
  voiceProfileId: z.string().optional(),
  avatarProfileId: z.string().optional(),
  generatedVoiceId: z.string().optional(),
});

function talent(ctx: ToolRunContext, tool: string) {
  const t = ctx.delegates?.talent;
  if (!t) throw new Error(`${tool}: talent delegate missing`);
  return t;
}

/**
 * Phase 6C agent tools. None of them spends money: `propose_talent_operation` only creates a priced
 * approval card in chat; the server starts the paid job when the user presses «Утвердить».
 */
export function registerPhase6TalentTools(executor: ToolExecutor) {
  executor.register("get_studio_capabilities", z.object({}).strict(), async (_in, ctx) =>
    talent(ctx, "get_studio_capabilities").capabilities({ projectId: ctx.projectId, userId: ctx.userId }),
  );

  executor.register("list_voices", z.object({ language: z.string().optional(), gender: z.string().optional() }), async (input, ctx) => {
    const parsed = z.object({ language: z.string().optional(), gender: z.string().optional() }).parse(input);
    return talent(ctx, "list_voices").listVoices({ userId: ctx.userId, ...parsed });
  });

  executor.register("list_avatars", z.object({}).strict(), async (_in, ctx) =>
    talent(ctx, "list_avatars").listAvatars({ userId: ctx.userId }),
  );

  executor.register("create_voice_profile", createVoiceInput, async (input, ctx) =>
    talent(ctx, "create_voice_profile").createVoice({ userId: ctx.userId, body: createVoiceInput.parse(input) }),
  );

  executor.register("create_avatar_profile", createAvatarInput, async (input, ctx) =>
    talent(ctx, "create_avatar_profile").createAvatar({ userId: ctx.userId, body: createAvatarInput.parse(input) }),
  );

  executor.register("assign_talent_to_character", assignInput, async (input, ctx) => {
    const { characterId, ...body } = assignInput.parse(input);
    return talent(ctx, "assign_talent_to_character").assignToCharacter({
      userId: ctx.userId,
      projectId: ctx.projectId,
      characterId,
      body,
    });
  });

  executor.register("propose_talent_operation", proposeInput, async (input, ctx) =>
    talent(ctx, "propose_talent_operation").propose({
      userId: ctx.userId,
      projectId: ctx.projectId,
      conversationId: ctx.conversationId,
      body: proposeInput.parse(input),
    }),
  );
}
