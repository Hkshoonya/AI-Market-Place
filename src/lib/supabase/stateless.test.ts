import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStatelessClient } from "./stateless";

afterEach(() => vi.restoreAllMocks());

describe("stateless server database transport", () => {
  it("disables session lifetime work while preserving request transport and headers", async () => {
    const interval = vi.spyOn(globalThis, "setInterval");
    const network = vi.fn<typeof fetch>(async () => Response.json([]));
    const client = createStatelessClient("https://fixture.example.invalid", "fixture-key", {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      global: { fetch: network, headers: { "X-Test-Transport": "fixture" } },
    });
    try {
      await client.auth.initialize();
      const result = await client.from("models").select("id").limit(1);
      expect(result.error).toBeNull();
      expect(interval).not.toHaveBeenCalled();
      expect(network).toHaveBeenCalledOnce();
      expect(new Headers(network.mock.calls[0][1]?.headers).get("X-Test-Transport")).toBe("fixture");
      for (const option of ["autoRefreshToken", "persistSession", "detectSessionInUrl"]) {
        expect(Reflect.get(client.auth, option)).toBe(false);
      }
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });

  it("does not allow server callers to bypass the stateless factory", () => {
    const root = join(process.cwd(), "src");
    const violations: string[] = [];
    function inspect(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) { inspect(path); continue; }
        if (!/\.tsx?$/.test(path) || /\.(test|spec)\./.test(path) || path === join(root, "lib/supabase/stateless.ts")) continue;
        const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
        for (const statement of source.statements) {
          if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
            || statement.moduleSpecifier.text !== "@supabase/supabase-js" || statement.importClause?.isTypeOnly) continue;
          const bindings = statement.importClause?.namedBindings;
          if (bindings && (ts.isNamespaceImport(bindings) || bindings.elements.some((binding) =>
            !binding.isTypeOnly && (binding.propertyName ?? binding.name).text === "createClient"))) {
            violations.push(relative(root, path));
          }
        }
      }
    }
    inspect(root);
    expect(violations).toEqual([]);
  });
});
