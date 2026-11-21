// Bounded subset of registry JSON Schema. Unsupported constructs fail closed
// instead of being silently treated as validated.
export function validateToolArgs(value: unknown, schema: Record<string, unknown>, depth = 0): boolean {
  if (depth > 8 || !schema || typeof schema !== "object") return false;
  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.includes(value))) return false;
  if (schema.anyOf || schema.oneOf || schema.allOf || schema.$ref) return false;
  const type = schema.type;
  if (type === "string") return typeof value === "string" && value.length <= Number(schema.maxLength ?? 2048) && value.length >= Number(schema.minLength ?? 0);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number" || type === "integer") return typeof value === "number" && Number.isFinite(value) && (type !== "integer" || Number.isInteger(value)) && value >= Number(schema.minimum ?? -Infinity) && value <= Number(schema.maximum ?? Infinity);
  if (type === "array") return Array.isArray(value) && value.length <= Number(schema.maxItems ?? 100) && !!schema.items && value.every(v => validateToolArgs(v, schema.items as Record<string, unknown>, depth + 1));
  if (type !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties || typeof properties !== "object" || Object.keys(record).length > 100) return false;
  if (Array.isArray(schema.required) && schema.required.some(k => typeof k !== "string" || !(k in record))) return false;
  return Object.entries(record).every(([k, v]) => !!properties[k] && validateToolArgs(v, properties[k], depth + 1));
}