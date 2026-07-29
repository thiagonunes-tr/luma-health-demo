import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type OpenApiOperation = {
  operationId?: string;
};

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    securitySchemes: Record<string, unknown>;
  };
};

const document = JSON.parse(
  readFileSync(new URL("../public/openapi.json", import.meta.url), "utf8"),
) as OpenApiDocument;

test("OpenAPI contract lists every public route and HTTP method", () => {
  assert.match(document.openapi, /^3\.1\./);
  assert.equal(document.info.title, "Luma Health Demo API");
  assert.equal(document.info.version, "1.0.0");

  const operations = Object.entries(document.paths)
    .flatMap(([path, methods]) =>
      Object.keys(methods).map(method => `${method.toUpperCase()} ${path}`),
    )
    .sort();

  assert.deepEqual(operations, [
    "DELETE /api/auth/account",
    "DELETE /api/demo-state",
    "GET /api/auth/session",
    "GET /api/demo-state",
    "PATCH /api/demo-state",
    "POST /api/auth/login",
    "POST /api/auth/logout",
    "POST /api/auth/verify",
  ]);
});

test("OpenAPI operations have stable identifiers and cookie authentication", () => {
  const operationIds = Object.values(document.paths)
    .flatMap(methods => Object.values(methods))
    .map(operation => operation.operationId)
    .sort();

  assert.deepEqual(operationIds, [
    "deleteAccount",
    "getDemoState",
    "getSession",
    "login",
    "logout",
    "resetDemoState",
    "updateDemoState",
    "verifyMfa",
  ]);
  assert.ok(document.components.securitySchemes.sessionCookie);
});
