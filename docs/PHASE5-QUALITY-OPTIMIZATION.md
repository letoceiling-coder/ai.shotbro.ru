# Phase 5 — Quality & cost optimization

## Pipeline (target)

`GENERATION → QUALITY_EVAL → OPTIONAL_ENHANCEMENT → VIDEO → OPTIONAL_VIDEO_ENHANCE → ASSEMBLY → DELIVERY`

**Current status:** Production graph unchanged; Magnific enhancement stage **NOT WIRED** to graph yet. Cost comparison UI **NOT IMPLEMENTED**.

## Strategy comparison (design)

Mock-only evaluation must use fixtures + catalog `priceStatus` — never invent quality scores.

| Strategy | Description |
|----------|-------------|
| A | Higher-quality image model |
| B | Economy image + Magnific upscale |
| C | Medium image, no upscale |

UNKNOWN pricing treated as non-zero / non-runnable for paid execution.

## Next steps

- Wire optional `IMAGE_UPSCALE` node after mock image generation
- `QualityComparisonCard` with MOCK RESULT badge
- Asset versioning: original + enhanced rows (Phase 5 §16)
