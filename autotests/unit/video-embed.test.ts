import assert from "node:assert/strict";
import test from "node:test";
import { getSafeVideoEmbedUrl } from "../../src/lib/video-embed.ts";

test("extracts the player URL from Kinescope adaptive iframe code", () => {
  assert.equal(
    getSafeVideoEmbedUrl(
      '<div><iframe src="https://kinescope.io/embed/4HFPoVpRUhUXtHK69srHec" allow="autoplay"></iframe></div>',
    ),
    "https://kinescope.io/embed/4HFPoVpRUhUXtHK69srHec",
  );
});

test("accepts direct Kinescope and YouTube embed URLs", () => {
  assert.equal(
    getSafeVideoEmbedUrl("https://kinescope.io/embed/video-id?autoplay=false"),
    "https://kinescope.io/embed/video-id?autoplay=false",
  );
  assert.equal(
    getSafeVideoEmbedUrl("https://www.youtube-nocookie.com/embed/video-id"),
    "https://www.youtube-nocookie.com/embed/video-id",
  );
});

test("rejects non-HTTPS, unsupported hosts, and non-embed video pages", () => {
  assert.equal(getSafeVideoEmbedUrl("http://kinescope.io/embed/video-id"), null);
  assert.equal(getSafeVideoEmbedUrl("https://example.com/embed/video-id"), null);
  assert.equal(getSafeVideoEmbedUrl("https://kinescope.io/video-id"), null);
  assert.equal(getSafeVideoEmbedUrl('<iframe src="javascript:alert(1)"></iframe>'), null);
});
