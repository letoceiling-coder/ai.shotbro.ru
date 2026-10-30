/** OpenAI-compatible tool definitions for creative agent (no media generation tools). */
export type OpenAiToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const CREATIVE_LLM_TOOL_IDS = [
  "search_project_assets",
  "get_storyboard",
  "sync_storyboard_from_script",
  "set_scene_first_frame",
  "set_scene_first_frame_by_ordinal",
  "set_scene_last_frame",
  "attach_reference",
  "update_storyboard_scene",
  "reorder_storyboard_scenes",
  "get_scene_prompt",
  "save_scene_prompt",
  "improve_scene_video_prompt",
  "compare_models",
  "estimate_cost",
  "get_timeline",
  "create_timeline_from_storyboard",
  "update_timeline_clip",
  "assign_video_to_scene_clip",
  "pick_asset_from_last_search",
  "get_production_status",
  "get_approval_status",
  "get_studio_capabilities",
  "list_voices",
  "list_avatars",
  "create_voice_profile",
  "create_avatar_profile",
  "assign_talent_to_character",
  "propose_talent_operation",
  "get_canvas",
  "propose_canvas_run",
] as const;


/** Phase 6C: avatars + voices. Descriptions are Russian so the agent explains the same terms to the user. */
export const TALENT_OPENAI_TOOLS: OpenAiToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_studio_capabilities",
      description:
        "Возможности студии: какие провайдеры подключены (HeyGen → Fal → OpenRouter), тестовый ли режим, цены операций и лимиты бюджета. Вызывай перед тем, как предлагать платные действия.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_voices",
      description: "Голоса пользователя (переиспользуемые) и библиотека ElevenLabs с фильтрами. Бесплатно.",
      parameters: {
        type: "object",
        properties: { language: { type: "string", description: "например ru" }, gender: { type: "string", enum: ["male", "female"] } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_avatars",
      description: "Аватары пользователя с образами (looks). Бесплатно.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_voice_profile",
      description:
        "Создать голос. LIBRARY — выбрать готовый голос из библиотеки (бесплатно, сразу готов). DESIGNED — голос по описанию 20–1000 символов (потом propose VOICE_DESIGN). CLONED — клон по аудио-образцам из библиотеки проекта (нужно согласие владельца голоса; потом propose VOICE_CLONE).",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["LIBRARY", "DESIGNED", "CLONED"] },
          name: { type: "string" },
          providerVoiceId: { type: "string", description: "только для LIBRARY, из list_voices" },
          designPrompt: { type: "string", description: "только для DESIGNED" },
          sampleAssetIds: { type: "array", items: { type: "string" }, description: "только для CLONED: audio assetId" },
          labels: { type: "object", properties: { language: { type: "string" }, gender: { type: "string" } } },
        },
        required: ["kind", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_avatar_profile",
      description:
        "Создать переиспользуемый аватар из фото проекта (image assetId из search_project_assets). Можно указать голос по умолчанию. Затем propose AVATAR_TRAIN.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          sourceAssetIds: { type: "array", items: { type: "string" } },
          defaultVoiceProfileId: { type: "string" },
        },
        required: ["name", "sourceAssetIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_talent_to_character",
      description: "Привязать аватар/голос к персонажу проекта. null — отвязать. Бесплатно.",
      parameters: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          voiceProfileId: { type: ["string", "null"] },
          avatarProfileId: { type: ["string", "null"] },
          avatarLookId: { type: ["string", "null"] },
        },
        required: ["characterId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_talent_operation",
      description:
        "Предложить платное действие: в чате появится карточка с ценой и кнопками «Утвердить/Отклонить». Ничего не списывается и не запускается до нажатия пользователем. Операции: VOICE_DESIGN, VOICE_SAVE (нужен generatedVoiceId варианта), VOICE_CLONE, AVATAR_TRAIN.",
      parameters: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["VOICE_DESIGN", "VOICE_SAVE", "VOICE_CLONE", "AVATAR_TRAIN"] },
          voiceProfileId: { type: "string" },
          avatarProfileId: { type: "string" },
          generatedVoiceId: { type: "string" },
        },
        required: ["operation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_canvas",
      description:
        "Холст сцен проекта: сцены раскадровки, узлы (первый кадр, видео сцены, монтаж), их статусы и готовый ролик. Холст сам строится по раскадровке. Бесплатно.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_canvas_run",
      description:
        "Предложить запуск холста: scope=all — собрать весь ролик (кадры → видео сцен → монтаж в MP4), scope=scene + sceneOrdinal — переделать одну сцену и пересобрать монтаж. В чате появится карточка с ценой и кнопками «Утвердить/Отклонить»; ничего не запускается до нажатия. Готовый MP4 придёт в чат сам.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["all", "scene"] },
          sceneOrdinal: { type: "number", description: "Номер сцены с 1 (для scope=scene)" },
        },
        required: ["scope"],
      },
    },
  },
];

export function buildCreativeOpenAiTools(): OpenAiToolDef[] {
  return [
    ...TALENT_OPENAI_TOOLS,
    {
      type: "function",
      function: {
        name: "search_project_assets",
        description: "Search project asset library. Returns READY assets with ids.",
        parameters: {
          type: "object",
          properties: {
            filter: { type: "string", enum: ["image", "video", "audio", "all"] },
            q: { type: "string" },
            limit: { type: "number" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "pick_asset_from_last_search",
        description: "Resolve assetId from last search list by 1-based index (e.g. third photo → index 3).",
        parameters: {
          type: "object",
          properties: { index: { type: "number" }, assetId: { type: "string" } },
          required: ["index"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "sync_storyboard_from_script",
        description: "Sync storyboard scenes from script document.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_storyboard",
        description: "Load storyboard with stable sceneId values.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "set_scene_first_frame",
        description:
          "Assign READY image as FIRST_FRAME when you already have sceneId from get_storyboard. Never invent sceneId.",
        parameters: {
          type: "object",
          properties: {
            sceneId: { type: "string" },
            assetId: { type: "string" },
          },
          required: ["sceneId", "assetId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_scene_first_frame_by_ordinal",
        description:
          "Assign READY image as FIRST_FRAME by 1-based scene index (1=first scene, 2=second). Prefer when user says первая/вторая/N-я сцена. Uses last search or library if assetId omitted.",
        parameters: {
          type: "object",
          properties: {
            sceneOrdinal: { type: "number" },
            pickAssetIndex: { type: "number" },
            assetId: { type: "string" },
          },
          required: ["sceneOrdinal"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_scene_last_frame",
        description: "Assign READY image asset as LAST_FRAME for sceneId.",
        parameters: {
          type: "object",
          properties: { sceneId: { type: "string" }, assetId: { type: "string" } },
          required: ["sceneId", "assetId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "attach_reference",
        description: "Attach asset as STYLE or GENERAL reference to scene.",
        parameters: {
          type: "object",
          properties: {
            assetId: { type: "string" },
            sceneId: { type: "string" },
            role: { type: "string", enum: ["STYLE", "GENERAL", "FIRST_FRAME", "LAST_FRAME"] },
          },
          required: ["assetId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_storyboard_scene",
        description: "Patch scene fields (title, description, duration).",
        parameters: {
          type: "object",
          properties: {
            sceneId: { type: "string" },
            patch: { type: "object" },
          },
          required: ["sceneId", "patch"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "improve_scene_video_prompt",
        description: "Save improved video prompt version for scene (by ordinal if sceneId unknown).",
        parameters: {
          type: "object",
          properties: { sceneId: { type: "string" }, sceneOrdinal: { type: "number" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "save_scene_prompt",
        description: "Persist prompt bundle version for scene.",
        parameters: {
          type: "object",
          properties: {
            sceneId: { type: "string" },
            bundle: { type: "object" },
            changeNote: { type: "string" },
          },
          required: ["sceneId", "bundle"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "compare_models",
        description: "Compare candidate models for a task type.",
        parameters: {
          type: "object",
          properties: { task: { type: "string", enum: ["text", "image", "video", "audio"] } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "estimate_cost",
        description: "Mock cost estimate for production (no live media).",
        parameters: {
          type: "object",
          properties: { strategy: { type: "string" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_timeline_from_storyboard",
        description: "Build timeline clips from storyboard order.",
        parameters: { type: "object", properties: { preview: { type: "boolean" } } },
      },
    },
    {
      type: "function",
      function: {
        name: "assign_video_to_scene_clip",
        description: "Bind READY video asset to timeline clip for scene ordinal.",
        parameters: {
          type: "object",
          properties: {
            sceneOrdinal: { type: "number" },
            assetId: { type: "string" },
            pickAssetIndex: { type: "number" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_timeline",
        description: "Read versioned timeline tracks and clips.",
        parameters: { type: "object", properties: {} },
      },
    },
  ];
}

export function isCreativeLlmToolAllowed(name: string): boolean {
  return (CREATIVE_LLM_TOOL_IDS as readonly string[]).includes(name);
}
