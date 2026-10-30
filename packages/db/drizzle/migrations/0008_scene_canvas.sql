-- Phase 6E: scene canvas document type. Additive only, idempotent.
ALTER TYPE "production_doc_type" ADD VALUE IF NOT EXISTS 'SCENE_CANVAS';
