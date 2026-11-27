/**
 * Tests for scripts/check-openapi-types-drift.mjs
 *
 * Validates the core drift-detection logic using synthetic OpenAPI specs and
 * TypeScript type snippets — no I/O beyond what the helper functions need.
 * The script-level process.exit behaviour is tested via exec smoke tests.
 */

import { execSync } from "child_process";
import { join } from "path";

const SCRIPT = join(process.cwd(), "../../scripts/check-openapi-types-drift.mjs");

// ── Inline copies of the pure helpers from the script ─────────────────────
// (We duplicate the logic here so the tests are independent of the script's
//  import side-effects, particularly process.exit.)

function extractTsInterfaceFields(src, interfaceName) {
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
  const fields = new Set();
  for (const line of body.split("\n")) {
    const m = line.match(/^\s+([\w]+)\??:/);
    if (m) fields.add(m[1]);
  }
  return fields;
}

function extractTsEnumValues(src, interfaceName, fieldName) {
  const start = src.indexOf(`interface ${interfaceName}`);
  if (start === -1) return null;

  const fieldIdx = src.indexOf(`${fieldName}`, start);
  if (fieldIdx === -1) return null;

  const colonIdx = src.indexOf(":", fieldIdx);
  if (colonIdx === -1) return null;

  let typeStr = "";
  for (let i = colonIdx + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === ";" || ch === "\n") break;
    typeStr += ch;
  }

  const values = new Set();
  for (const m of typeStr.matchAll(/"([^"]+)"/g)) {
    values.add(m[1]);
  }
  return values.size > 0 ? values : null;
}

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

function getRequiredFields(spec, schema) {
  const resolved = schema.$ref ? resolveRef(spec, schema.$ref) : schema;
  if (!resolved) return [];
  return resolved.required ?? [];
}

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

// ── extractTsInterfaceFields ───────────────────────────────────────────────

describe("extractTsInterfaceFields", () => {
  it("returns null when interface does not exist", () => {
    expect(extractTsInterfaceFields("export interface Foo { bar: string; }", "Baz")).toBeNull();
  });

  it("extracts required fields", () => {
    const src = `
export interface TradeResponse {
  tradeId: string;
  status: string;
  createdAt: string;
}
    `;
    const fields = extractTsInterfaceFields(src, "TradeResponse");
    expect(fields).not.toBeNull();
    expect(fields.has("tradeId")).toBe(true);
    expect(fields.has("status")).toBe(true);
    expect(fields.has("createdAt")).toBe(true);
  });

  it("extracts optional fields (marked with ?)", () => {
    const src = `
export interface TradeResponse {
  tradeId: string;
  eta?: string;
  carrier?: string;
}
    `;
    const fields = extractTsInterfaceFields(src, "TradeResponse");
    expect(fields.has("eta")).toBe(true);
    expect(fields.has("carrier")).toBe(true);
  });

  it("handles multiple interfaces in the same file", () => {
    const src = `
export interface Foo { a: string; }
export interface Bar { b: number; c: boolean; }
    `;
    const foo = extractTsInterfaceFields(src, "Foo");
    const bar = extractTsInterfaceFields(src, "Bar");
    expect(foo.has("a")).toBe(true);
    expect(foo.has("b")).toBe(false);
    expect(bar.has("b")).toBe(true);
    expect(bar.has("c")).toBe(true);
  });

  it("handles nested object fields by extracting only the top-level key", () => {
    const src = `
export interface DisputeResponse {
  id: number;
  trade: {
    buyerAddress: string;
    sellerAddress: string;
  };
}
    `;
    const fields = extractTsInterfaceFields(src, "DisputeResponse");
    expect(fields.has("id")).toBe(true);
    expect(fields.has("trade")).toBe(true);
    // Nested fields must NOT surface as top-level
    expect(fields.has("buyerAddress")).toBe(false);
  });
});

// ── extractTsEnumValues ────────────────────────────────────────────────────

describe("extractTsEnumValues", () => {
  it("extracts union literal values from a field type", () => {
    const src = `
export interface DisputeResponse {
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
}
    `;
    const vals = extractTsEnumValues(src, "DisputeResponse", "status");
    expect(vals).not.toBeNull();
    expect(vals.has("OPEN")).toBe(true);
    expect(vals.has("RESOLVED")).toBe(true);
    expect(vals.size).toBe(4);
  });

  it("returns null when the field has no quoted literals", () => {
    const src = `
export interface TradeResponse {
  status: string;
}
    `;
    const vals = extractTsEnumValues(src, "TradeResponse", "status");
    expect(vals).toBeNull();
  });

  it("returns null when interface does not exist", () => {
    const vals = extractTsEnumValues("export interface Foo { x: string; }", "Bar", "x");
    expect(vals).toBeNull();
  });
});

// ── resolveRef ─────────────────────────────────────────────────────────────

describe("resolveRef", () => {
  const spec = {
    components: {
      schemas: {
        StatusEnum: { type: "string", enum: ["A", "B"] },
      },
    },
  };

  it("resolves a valid $ref", () => {
    const result = resolveRef(spec, "#/components/schemas/StatusEnum");
    expect(result).toEqual({ type: "string", enum: ["A", "B"] });
  });

  it("returns null for a missing ref path", () => {
    expect(resolveRef(spec, "#/components/schemas/Missing")).toBeNull();
  });

  it("returns null for refs that do not start with #/", () => {
    expect(resolveRef(spec, "http://example.com")).toBeNull();
  });
});

// ── getRequiredFields ──────────────────────────────────────────────────────

describe("getRequiredFields", () => {
  it("returns required array from a plain schema", () => {
    const schema = { type: "object", required: ["id", "tradeId"], properties: {} };
    expect(getRequiredFields({}, schema)).toEqual(["id", "tradeId"]);
  });

  it("returns empty array when required is absent", () => {
    const schema = { type: "object", properties: {} };
    expect(getRequiredFields({}, schema)).toEqual([]);
  });

  it("resolves $ref before reading required", () => {
    const spec = {
      components: {
        schemas: {
          MySchema: { required: ["foo"], properties: { foo: { type: "string" } } },
        },
      },
    };
    const schema = { $ref: "#/components/schemas/MySchema" };
    expect(getRequiredFields(spec, schema)).toEqual(["foo"]);
  });
});

// ── getSchemaEnumField ─────────────────────────────────────────────────────

describe("getSchemaEnumField", () => {
  it("returns enum values for a property with inline enum", () => {
    const spec = {};
    const schema = {
      type: "object",
      properties: {
        status: { type: "string", enum: ["OPEN", "CLOSED"] },
      },
    };
    const result = getSchemaEnumField(spec, schema, "status");
    expect(result).not.toBeNull();
    expect(result.has("OPEN")).toBe(true);
    expect(result.has("CLOSED")).toBe(true);
  });

  it("returns null for a property with no enum", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    expect(getSchemaEnumField({}, schema, "name")).toBeNull();
  });

  it("returns null for an unknown property name", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    expect(getSchemaEnumField({}, schema, "missing")).toBeNull();
  });

  it("resolves enum values through a $ref property", () => {
    const spec = {
      components: {
        schemas: {
          DisputeStatus: { type: "string", enum: ["OPEN", "RESOLVED"] },
        },
      },
    };
    const schema = {
      type: "object",
      properties: {
        status: { $ref: "#/components/schemas/DisputeStatus" },
      },
    };
    const result = getSchemaEnumField(spec, schema, "status");
    expect(result.has("OPEN")).toBe(true);
    expect(result.has("RESOLVED")).toBe(true);
  });
});

// ── Drift detection integration (end-to-end logic) ────────────────────────

describe("drift detection — integration", () => {
  /**
   * Runs the full drift check logic against a synthetic spec + types source,
   * returning an array of error strings.
   */
  function runDriftCheck(schemaMap, schemas, typesSrc) {
    const spec = { components: { schemas } };
    const driftErrors = [];

    for (const [schemaName, tsName] of Object.entries(schemaMap)) {
      const schema = schemas[schemaName];
      if (!schema) continue;

      const isOpen =
        schema.additionalProperties === true &&
        !schema.required?.length &&
        !schema.properties;
      if (isOpen) continue;

      const tsFields = extractTsInterfaceFields(typesSrc, tsName);
      if (!tsFields) {
        driftErrors.push(`TypeScript interface "${tsName}" not found`);
        continue;
      }

      const required = getRequiredFields(spec, schema);
      for (const field of required) {
        if (!tsFields.has(field)) {
          driftErrors.push(`Schema "${schemaName}" requires field "${field}" but interface "${tsName}" does not declare it.`);
        }
      }

      const resolved = schema.$ref ? resolveRef(spec, schema.$ref) : schema;
      const properties = resolved?.properties ?? {};
      for (const [propName] of Object.entries(properties)) {
        const specEnums = getSchemaEnumField(spec, schema, propName);
        if (!specEnums) continue;

        const tsEnums = extractTsEnumValues(typesSrc, tsName, propName);
        if (!tsEnums) continue;

        for (const val of specEnums) {
          if (!tsEnums.has(val)) {
            driftErrors.push(`Enum drift: OpenAPI "${schemaName}.${propName}" includes "${val}" not in TS "${tsName}.${propName}".`);
          }
        }
        for (const val of tsEnums) {
          if (!specEnums.has(val)) {
            driftErrors.push(`Enum drift: TS "${tsName}.${propName}" includes "${val}" not in OpenAPI "${schemaName}.${propName}".`);
          }
        }
      }
    }

    return driftErrors;
  }

  it("passes when types perfectly match the spec", () => {
    const schemas = {
      TradeSchema: {
        type: "object",
        required: ["tradeId", "status"],
        properties: {
          tradeId: { type: "string" },
          status: { type: "string" },
        },
      },
    };
    const typesSrc = `
export interface TradeResponse {
  tradeId: string;
  status: string;
}
    `;
    expect(runDriftCheck({ TradeSchema: "TradeResponse" }, schemas, typesSrc)).toHaveLength(0);
  });

  it("reports a missing required field", () => {
    const schemas = {
      TradeSchema: {
        type: "object",
        required: ["tradeId", "buyerAddress"],
        properties: {
          tradeId: { type: "string" },
          buyerAddress: { type: "string" },
        },
      },
    };
    const typesSrc = `
export interface TradeResponse {
  tradeId: string;
}
    `;
    const errors = runDriftCheck({ TradeSchema: "TradeResponse" }, schemas, typesSrc);
    expect(errors.some((e) => e.includes("buyerAddress"))).toBe(true);
  });

  it("reports a missing TypeScript interface", () => {
    const schemas = {
      TradeSchema: {
        type: "object",
        required: ["tradeId"],
        properties: { tradeId: { type: "string" } },
      },
    };
    const typesSrc = `export interface OtherInterface { foo: string; }`;
    const errors = runDriftCheck({ TradeSchema: "TradeResponse" }, schemas, typesSrc);
    expect(errors.some((e) => e.includes("TradeResponse") && e.includes("not found"))).toBe(true);
  });

  it("reports enum drift when spec adds a new value", () => {
    const schemas = {
      DisputeSchema: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["OPEN", "CLOSED", "PENDING"] },
        },
      },
    };
    const typesSrc = `
export interface DisputeResponse {
  status: "OPEN" | "CLOSED";
}
    `;
    const errors = runDriftCheck({ DisputeSchema: "DisputeResponse" }, schemas, typesSrc);
    expect(errors.some((e) => e.includes("PENDING"))).toBe(true);
  });

  it("reports enum drift when TS adds a value not in spec", () => {
    const schemas = {
      DisputeSchema: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["OPEN", "CLOSED"] },
        },
      },
    };
    const typesSrc = `
export interface DisputeResponse {
  status: "OPEN" | "CLOSED" | "ARCHIVED";
}
    `;
    const errors = runDriftCheck({ DisputeSchema: "DisputeResponse" }, schemas, typesSrc);
    expect(errors.some((e) => e.includes("ARCHIVED"))).toBe(true);
  });

  it("skips fully-open schemas (additionalProperties: true, no required, no properties)", () => {
    const schemas = {
      FullyOpenSchema: { type: "object", additionalProperties: true },
    };
    const typesSrc = `export interface SomeInterface { x: string; }`;
    expect(
      runDriftCheck({ FullyOpenSchema: "SomeInterface" }, schemas, typesSrc),
    ).toHaveLength(0);
  });
});

// ── Script smoke test ──────────────────────────────────────────────────────

describe("check-openapi-types-drift.mjs — script syntax", () => {
  it("script is syntactically valid ESM", () => {
    expect(() => {
      execSync(`node --check ${SCRIPT}`, { stdio: "pipe" });
    }).not.toThrow();
  });

  it("exits 0 against the real spec and types (no current drift)", () => {
    expect(() => {
      execSync(`node ${SCRIPT}`, {
        cwd: join(process.cwd(), "../.."),
        stdio: "pipe",
      });
    }).not.toThrow();
  });
});
