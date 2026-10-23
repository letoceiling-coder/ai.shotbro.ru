import type { ProductionBrief, ProductionPlan, ScriptDocument, StoryboardDocument } from "@shotbro/contracts";
import {
  buildMockBriefFromRequest,
  buildMockPlan,
  buildMockScript,
  buildMockStoryboard,
} from "../mock-intent.js";

export type CreativeConcept = {
  schemaVersion: 1;
  idea: string;
  visualAtmosphere: string;
  colorConcept: string;
  cameraStyle: string;
  mock: true;
};

export const BriefBuilder = {
  fromUserRequest(userRequest: string): ProductionBrief {
    return buildMockBriefFromRequest(userRequest);
  },
};

export const CreativeDirector = {
  concept(brief: ProductionBrief): CreativeConcept {
    return {
      schemaVersion: 1,
      idea: `Mock concept for: ${brief.goal.slice(0, 120)}`,
      visualAtmosphere: brief.style ?? "advertising",
      colorConcept: "Brand-led palette",
      cameraStyle: "Dynamic handheld + product inserts",
      mock: true,
    };
  },
};

export const Screenwriter = {
  script(brief: ProductionBrief, plan: ProductionPlan): ScriptDocument {
    const base = buildMockScript(brief, plan);
    return {
      ...base,
      scenes: base.scenes.map((s) => ({
        ...s,
        description: `${s.description} | action: ${s.description} | camera: medium`,
      })),
    };
  },
};

export const StoryboardDirector = {
  storyboard(script: ScriptDocument): StoryboardDocument {
    return buildMockStoryboard(script);
  },
};

export const ProductionPlanner = {
  plan(brief: ProductionBrief): ProductionPlan {
    return buildMockPlan(brief);
  },
};
