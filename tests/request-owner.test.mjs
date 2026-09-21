import assert from "node:assert/strict";
import test from "node:test";

import { anonymousAccessResponse, requestOwner } from "../app/api/request-owner.ts";

test("uses the shared development owner only on localhost", () => {
  assert.equal(requestOwner(new Request("http://localhost:3000/api/workspace")), "local-designer");
  assert.equal(requestOwner(new Request("http://127.0.0.1:3000/api/workspace")), "local-designer");
  assert.equal(requestOwner(new Request("https://pitchit.example/api/workspace")), null);
});

test("keeps a server-provided owner isolated when one is present", () => {
  const request = new Request("https://pitchit.example/api/workspace", {
    headers: { "oai-authenticated-user-id": "pilot-owner-123" },
  });
  assert.equal(requestOwner(request), "pilot-owner-123");
});

test("returns an explicit denial for a public anonymous request", async () => {
  const response = anonymousAccessResponse();
  assert.equal(response.status, 401);
  await assert.doesNotReject(async () => {
    const payload = await response.json();
    assert.match(payload.error, /public preview/i);
    assert.match(payload.next, /localhost/i);
  });
});
