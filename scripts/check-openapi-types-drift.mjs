#!/usr/bin/env node
/**
 * check-openapi-types-drift.mjs
 *
 * Detects drift between the OpenAPI contract (backend/src/docs/openapi.json)
 * and the hand-maintained frontend API types (frontend/src/lib/api/types.ts).
 *
 * For each schema tracked in SCHEMA_MAP, the script verifies that:
 *   1. Every required field declared in the OpenAPI schema is present as a
 *      TypeScript property in the frontend interface.
 *   2. Every enum field has the same set of values in both places.
 *
 * Exit codes:
 *   0 – no drift detected
 *   1 – drift detected or the spec/types file cannot be parsed
 *
 * Usage:
 *   node scripts/check-openapi-types-drift.mjs
 *   node scripts/check-openapi-types-drift.mjs --verbose
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const OPENAPI_PATH = path.join(ROOT, "backend/src/docs/openapi.json");
const TYPES_PATH = path.join(ROOT, "frontend/src/lib/api/types.ts");

const VERBOSE = process.argv.includes("--verbose");

// ── Schema → frontend interface mapping ──────────────────────────────────────
//
// Keys are OpenAPI component schema names.
// Values are the TypeScript interface names in frontend/src/lib/api/types.ts.
//
// Only schemas with concrete required fields are worth tracking; schemas that
// are entirely `additionalProperties: true` are noted but skipped.
const SCHEMA_MAP = {
  AuthChallengeResponse: "ChallengeResponse",
  AuthVerifyResponse: "VerifyResponse",
  TradeSummary: "TradeResponse",
  TradeListResponse: "TradeListResponse",
  DisputeResponse: "DisputeResponse",
  DisputeListResponse: "DisputeListResponse",
  EvidenceListResponse: "EvidenceResponse",
  AuditEvent: "TradeHistoryEvent",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts property names declared in a TypeScript interface block.
 * Handles optional (`prop?:`) and required (`prop:`) properties.
 * Does not attempt full AST parsing — a line-based scan is sufficient for the
 * flat interfaces in types.ts.
 */
function extractTsInterfaceFields(src, interfaceName) {
  // Match the interface block including nested braces one level deep
  const start = src.indexOf(`interface ${interfaceName}`);
  if (start === -1) return null;

  let depth = 0;
  let bodyStart = -1;
  let bodyEnd = -1;

  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") {
      depth++;
      if (bodyStart === -1) bodyStart = i;
    } else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }

  if (bodyStart === -1 || bodyEnd === -1) return null;

  const body = src.slice(bodyStart + 1, bodyEnd);
  // Pull out top-level property names (lines that look like `  propName?:` or `  propName:`)
  const fields = new Set();
  for (const line of body.split("\n")) {
    const m = line.match(/^\s+([\w]+)\??:/);
    if (m) fields.add(m[1]);
  }
  return fields;
}

/**
 * Collects enum string values from a TypeScript union type literal, e.g.
 *   "OPEN" | "CLOSED"
 * or from a TypeScript interface field value that is an enum type.
 * We scan for the field name and grab quoted string literals on adjacent lines.
 */
function extractTsEnumValues(src, interfaceName, fieldName) {
  const start = src.indexOf(`interface ${interfaceName}`);
  if (start === -1) return null;

  // Find the field inside the interface
  const fieldIdx = src.indexOf(`${fieldName}`, start);
  if (fieldIdx === -1) return null;

  // Gather the type declaration — scan from the colon to the semicolon/newline
  const colonIdx = src.indexOf(":", fieldIdx);
  if (colonIdx === -1) return null;

  // Collect until semicolon or end of line or closing brace
  let typeStr = "";
  for (let i = colonIdx + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === ";" || ch === "\n") break;
    typeStr += ch;
  }

  // Extract quoted string literals
  const values = new Set();
  for (const m of typeStr.matchAll(/"([^"]+)"/g)) {
    values.add(m[1]);
  }
  return values.size > 0 ? values : null;
}

/**
 * Recursively resolves a $ref pointer in the OpenAPI schema.
 */
function resolveRef(spec, ref) {
  if (!ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let node = spec;
  for (const part of parts) {
    node = node[part];
    if (!node) return null;
  }
  return node;
}

/**
 * Returns the flat list of required field names for an OpenAPI schema object,
 * resolving $ref if necessary.
 */
function getRequiredFields(spec, schema) {
  const resolved = schema.$ref ? resolveRef(spec, schema.$ref) : schema;
  if (!resolved) return [];
  return resolved.required ?? [];
}

/**
 * Returns enum values for a named property within a schema.
 */
function getSchemaEnumField(spec, schema, fieldName) {
  const resolved = schema.$ref ? resolveRef(spec, schema.$ref) : schema;
  if (!resolved || !resolved.properties) return null;
  const prop = resolved.properties[fieldName];
  if (!prop) return null;
  if (prop.enum) return new Set(prop.enum.map(String));
  if (prop.$ref) {
    const refSchema = resolveRef(spec, prop.$ref);
    if (refSchema?.enum) return new Set(refSchema.enum.map(String));
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  // Load files
  if (!fs.existsSync(OPENAPI_PATH)) {
    console.error(`❌ OpenAPI spec not found: ${OPENAPI_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(TYPES_PATH)) {
    console.error(`❌ Frontend types file not found: ${TYPES_PATH}`);
    process.exit(1);
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(OPENAPI_PATH, "utf-8"));
  } catch (e) {
    console.error(`❌ Failed to parse OpenAPI spec: ${e.message}`);
    process.exit(1);
  }

  const typesSrc = fs.readFileSync(TYPES_PATH, "utf-8");
  const schemas = spec?.components?.schemas ?? {};

  const driftErrors = [];
  const warnings = [];
  let checked = 0;

  for (const [schemaName, tsName] of Object.entries(SCHEMA_MAP)) {
    const schema = schemas[schemaName];
    if (!schema) {
      warnings.push(`Schema "${schemaName}" not found in OpenAPI spec — skipping.`);
      continue;
    }

    // Skip entirely-open schemas (no concrete fields to compare)
    const isOpen =
      schema.additionalProperties === true &&
      !schema.required?.length &&
      !schema.properties;
    if (isOpen) {
      if (VERBOSE) {
        console.log(
          `  ⚠  ${schemaName} → ${tsName}: schema is fully open (additionalProperties: true), skipping field check.`,
        );
      }
      continue;
    }

    const tsFields = extractTsInterfaceFields(typesSrc, tsName);
    if (!tsFields) {
      driftErrors.push(
        `TypeScript interface "${tsName}" not found in ${TYPES_PATH} (required by OpenAPI schema "${schemaName}").`,
      );
      continue;
    }

    checked++;

    // Check required fields
    const required = getRequiredFields(spec, schema);
    for (const field of required) {
      if (!tsFields.has(field)) {
        driftErrors.push(
          `Schema "${schemaName}" requires field "${field}" but interface "${tsName}" does not declare it.`,
        );
      }
    }

    // Check enum fields (only fields that have an enum in the spec)
    const resolved = schema.$ref ? resolveRef(spec, schema.$ref) : schema;
    const properties = resolved?.properties ?? {};
    for (const [propName, propSchema] of Object.entries(properties)) {
      const specEnums = getSchemaEnumField(spec, schema, propName);
      if (!specEnums) continue;

      const tsEnums = extractTsEnumValues(typesSrc, tsName, propName);
      if (!tsEnums) {
        if (VERBOSE) {
          console.log(
            `  ⚠  ${tsName}.${propName}: OpenAPI has enum ${[...specEnums].join("|")} but no matching union found in TS — may be typed as 'string'.`,
          );
        }
        continue;
      }

      for (const val of specEnums) {
        if (!tsEnums.has(val)) {
          driftErrors.push(
            `Enum drift: OpenAPI "${schemaName}.${propName}" includes value "${val}" not present in TypeScript "${tsName}.${propName}" (TS has: ${[...tsEnums].join(", ")}).`,
          );
        }
      }
      for (const val of tsEnums) {
        if (!specEnums.has(val)) {
          driftErrors.push(
            `Enum drift: TypeScript "${tsName}.${propName}" includes value "${val}" not in OpenAPI "${schemaName}.${propName}" (spec has: ${[...specEnums].join(", ")}).`,
          );
        }
      }
    }

    if (VERBOSE) {
      console.log(`  ✓ ${schemaName} → ${tsName} (${required.length} required fields checked)`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log("=== OpenAPI ↔ Frontend Types Drift Check ===");
  console.log(`Spec:   ${OPENAPI_PATH}`);
  console.log(`Types:  ${TYPES_PATH}`);
  console.log(`Schemas checked: ${checked}`);
  console.log();

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`  ⚠  ${w}`);
    }
    console.log();
  }

  if (driftErrors.length === 0) {
    console.log("✅ No drift detected between OpenAPI contract and frontend types.");
    process.exit(0);
  }

  console.error(`❌ Drift detected (${driftErrors.length} issue${driftErrors.length === 1 ? "" : "s"}):\n`);
  for (const err of driftErrors) {
    console.error(`  • ${err}`);
  }
  console.error(
    "\nFix: update frontend/src/lib/api/types.ts to match the OpenAPI contract, or update the spec if the backend has changed.",
  );
  process.exit(1);
}

main();
