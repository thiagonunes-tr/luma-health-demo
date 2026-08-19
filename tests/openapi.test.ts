import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_DEMO_STATE,
  DEMO_STATE_ACTIONS,
} from "../lib/demo-state";

type OpenApiOperation = {
  operationId?: string;
};

type OpenApiSchema = {
  required?: string[];
  properties?: Record<string, unknown>;
  enum?: string[];
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
    schemas: Record<string, OpenApiSchema & {
      properties?: Record<string, OpenApiSchema>;
    }>;
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

// The action enum and the DemoState shape used to be able to drift from the
// TypeScript source silently: nothing compared them. These two tests are the
// only thing standing between a renamed action and a lying contract.
test("OpenAPI action enum matches the TypeScript action union", () => {
  const enumValues =
    document.components.schemas.DemoStateActionRequest.properties?.action.enum;
  assert.ok(enumValues, "DemoStateActionRequest.properties.action.enum is missing");
  assert.deepEqual(
    [...enumValues].sort(),
    [...DEMO_STATE_ACTIONS].sort(),
    "public/openapi.json action enum has drifted from lib/demo-state.ts",
  );
});

test("OpenAPI DemoState schema matches the persisted state shape", () => {
  const schema = document.components.schemas.DemoState;
  const stateKeys = Object.keys(DEFAULT_DEMO_STATE).sort();

  assert.deepEqual(
    [...(schema.required ?? [])].sort(),
    stateKeys,
    "DemoState.required has drifted from DEFAULT_DEMO_STATE",
  );
  assert.deepEqual(
    Object.keys(schema.properties ?? {}).sort(),
    stateKeys,
    "DemoState.properties has drifted from DEFAULT_DEMO_STATE",
  );
});

test("OpenAPI documents every input field the API forwards", () => {
  const properties = Object.keys(
    document.components.schemas.DemoStateActionRequest.properties ?? {},
  ).sort();
  // additionalProperties is false, so an undocumented input is a rejected input.
  assert.deepEqual(properties, [
    "action",
    "appointmentTime",
    "insurance",
    "intake",
    "messageBody",
    "provider",
    "specialty",
  ]);
});
