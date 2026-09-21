import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Pitch it. application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Pitch it\. — Visual Treatment Workspace<\/title>/i);
  assert.match(html, /References,/);
  assert.match(html, /ready to pitch/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships a blank-start product with creation, link capture, and guidance", async () => {
  const [layout, page, packageJson, app] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/pitchit-preview.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Pitch it\. — Visual Treatment Workspace/);
  assert.match(layout, /\/og-home\.png/);
  assert.match(page, /<PitchItPreview \/>/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview/);
  assert.match(app, /Create new project/);
  assert.match(app, /Explore the workspace/);
  assert.match(app, /Paste one or many links/);
  assert.match(app, /ProductTour/);
  assert.match(app, /PILOT PREVIEW/);
  assert.doesNotMatch(app, /Skybags|Busted Party|seedReferences/);
});
