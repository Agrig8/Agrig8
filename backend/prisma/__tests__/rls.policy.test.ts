import fs from "fs";
import path from "path";

// Any migration enabling RLS on a table must also create a policy for it.
// Access control is currently API-layer (docs/access_control_tests.md), so this passes with no RLS.
const dir = path.join(__dirname, "..", "migrations");
const sql = fs
  .readdirSync(dir)
  .map((n) => path.join(dir, n, "migration.sql"))
  .filter((f) => fs.existsSync(f))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
const names = (re: RegExp) => [...sql.matchAll(re)].map((m) => m[1].replace(/"/g, "").toLowerCase());
const enabled = names(/ALTER TABLE\s+(?:ONLY\s+)?("?[\w.]+"?)\s+ENABLE ROW LEVEL SECURITY/gi);
const policied = new Set(names(/CREATE POLICY\s+\S+\s+ON\s+("?[\w.]+"?)/gi));

describe("RLS migrations", () => {
  it("every RLS-enabled table has a policy", () => {
    expect(enabled.filter((t) => !policied.has(t))).toEqual([]);
  });
});
