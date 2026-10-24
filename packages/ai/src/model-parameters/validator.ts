import { getModelParameterDefinition } from "./registry.js";
import type { ModelParameterField } from "./types.js";

export type ValidationIssue = { key: string; message: string };

function validateField(field: ModelParameterField, value: unknown): ValidationIssue | null {
  if (value === undefined || value === null) {
    return field.required ? { key: field.key, message: "required" } : null;
  }
  switch (field.type) {
    case "integer": {
      if (typeof value !== "number" || !Number.isInteger(value)) return { key: field.key, message: "integer_required" };
      if (field.minimum != null && value < field.minimum) return { key: field.key, message: "below_minimum" };
      if (field.maximum != null && value > field.maximum) return { key: field.key, message: "above_maximum" };
      return null;
    }
    case "number": {
      if (typeof value !== "number") return { key: field.key, message: "number_required" };
      if (field.minimum != null && value < field.minimum) return { key: field.key, message: "below_minimum" };
      if (field.maximum != null && value > field.maximum) return { key: field.key, message: "above_maximum" };
      return null;
    }
    case "enum": {
      if (typeof value !== "string" || !field.enumValues?.includes(value)) {
        return { key: field.key, message: "invalid_enum" };
      }
      return null;
    }
    case "boolean":
      return typeof value === "boolean" ? null : { key: field.key, message: "boolean_required" };
    case "string":
      return typeof value === "string" ? null : { key: field.key, message: "string_required" };
    default:
      return null;
  }
}

export class ModelParameterValidator {
  validate(modelId: string, operation: string, parameters: Record<string, unknown>) {
    const def = getModelParameterDefinition(modelId, operation);
    if (!def) return { valid: false, issues: [{ key: "_model", message: "unknown_model" }] };
    const issues: ValidationIssue[] = [];
    for (const field of def.parameterSchema) {
      const issue = validateField(field, parameters[field.key]);
      if (issue) issues.push(issue);
    }
    for (const key of Object.keys(parameters)) {
      if (!def.parameterSchema.some((f) => f.key === key)) {
        issues.push({ key, message: "unsupported_parameter" });
      }
    }
    return { valid: issues.length === 0, issues };
  }

  withDefaults(modelId: string, operation: string, parameters: Record<string, unknown> = {}) {
    const def = getModelParameterDefinition(modelId, operation);
    if (!def) throw new Error("unknown_model");
    const merged = { ...def.defaultParameters, ...parameters };
    return merged;
  }
}
