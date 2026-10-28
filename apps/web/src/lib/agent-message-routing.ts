/** Re-export unified Phase 5L studio intent rules from @shotbro/ai (single source of truth). */
export {
  isProductionBootstrapUserMessage as isProductionBootstrapMessage,
  shouldTryCreativeTurn,
  resolveStudioMessageIntent,
  type StudioMessageIntent,
} from "@shotbro/ai/studio-intent";
