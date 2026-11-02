import assert from "node:assert/strict";
import test from "node:test";
import { createUploadState, slotPreview, uploadReducer, validateUploadFile } from "../src/lib/upload-state.ts";

const asset = { id: "asset-b", ownerId: "demo-chen", templateId: "travel-postcard", originalName: "b.png", mimeType: "image/png", sizeBytes: 100,
  width: 8, height: 6, url: "/api/assets/asset-b/content", createdAt: "2026-11-02T00:00:00Z" };
const requirements = { acceptedMimeTypes: ["image/png", "image/jpeg"], maxFileSizeBytes: 5242880 };

test("two simultaneous uploads keep independent success and failure", () => {
  let state = createUploadState(2);
  state = uploadReducer(state, { type: "start", index: 0, requestId: "a", fileName: "a.png" });
  state = uploadReducer(state, { type: "start", index: 1, requestId: "b", fileName: "b.png" });
  state = uploadReducer(state, { type: "success", index: 1, requestId: "b", asset });
  state = uploadReducer(state, { type: "failure", index: 0, requestId: "a", message: "上传失败" });
  assert.equal(state[0].status, "error");
  assert.equal(state[0].message, "上传失败");
  assert.equal(state[1].status, "ready");
  assert.equal(state[1].asset.id, "asset-b");
});

test("a replaced file ignores both late success and late failure", () => {
  let state = createUploadState(1);
  state = uploadReducer(state, { type: "start", index: 0, requestId: "old", fileName: "old.png" });
  state = uploadReducer(state, { type: "start", index: 0, requestId: "new", fileName: "new.png" });
  assert.equal(uploadReducer(state, { type: "success", index: 0, requestId: "old", asset }), state);
  assert.equal(uploadReducer(state, { type: "failure", index: 0, requestId: "old", message: "旧请求异常" }), state);
  assert.equal(state[0].fileName, "new.png");
});

test("removing an uploading file cannot be undone by its response", () => {
  let state = uploadReducer(createUploadState(1), { type: "start", index: 0, requestId: "a", fileName: "a.png" });
  state = uploadReducer(state, { type: "remove", index: 0 });
  state = uploadReducer(state, { type: "success", index: 0, requestId: "a", asset });
  assert.deepEqual(state, [{ status: "empty" }]);
});

test("ready preview uses the server URL instead of the temporary browser URL", () => {
  let state = uploadReducer(createUploadState(1), { type: "start", index: 0, requestId: "a", fileName: "a.png" });
  state = uploadReducer(state, { type: "preview", index: 0, requestId: "a", fileName: "a.png", previewUrl: "blob:local-only" });
  assert.equal(slotPreview(state[0]), "blob:local-only");
  state = uploadReducer(state, { type: "success", index: 0, requestId: "a", asset });
  assert.equal(slotPreview(state[0]), "/api/assets/asset-b/content");
  assert.equal(uploadReducer(state, { type: "failure", index: 0, requestId: "a", message: "late" }), state);
});

test("separate form instances do not share selected assets", () => {
  const first = createUploadState(2), second = createUploadState(2);
  const changed = uploadReducer(first, { type: "start", index: 0, requestId: "a", fileName: "a.png" });
  assert.equal(changed[0].status, "uploading");
  assert.deepEqual(second, [{ status: "empty" }, { status: "empty" }]);
  assert.deepEqual(first, second);
});

test("client validation covers MIME, empty files, size limit and its boundary", () => {
  assert.match(validateUploadFile({ type: "image/gif", size: 100 }, requirements), /格式不支持/);
  assert.match(validateUploadFile({ type: "image/png", size: 0 }, requirements), /不能为空/);
  assert.match(validateUploadFile({ type: "image/png", size: 5242881 }, requirements), /不能超过/);
  assert.equal(validateUploadFile({ type: "image/png", size: 5242880 }, requirements), null);
});
