import { describe, expect, it } from "vitest";
import twitterText from "twitter-text";

import { buildNativeShareData, buildShareTextForX } from "../ShareActions";

describe("buildShareTextForX", () => {
  it("uses the masked post text when available", () => {
    expect(buildShareTextForX("I love ○○○○○!", "fallback", "https://skyblur.uk/post/example/1")).toBe("I love ○○○○○!");
  });

  it("falls back when the post text is empty", () => {
    expect(buildShareTextForX("   ", "Read on Skyblur", "https://skyblur.uk/post/example/1")).toBe("Read on Skyblur");
  });

  it("uses X weighted counting and keeps a 10-character truncation margin", () => {
    const url = "https://skyblur.uk/post/example/1";
    const result = buildShareTextForX("あ".repeat(300), "fallback", url);
    const completeText = `${result}\n\n${url}`;

    expect(twitterText.parseTweet(completeText).weightedLength).toBeLessThanOrEqual(256);
    expect(twitterText.parseTweet(`${result.slice(0, -1)}${"あ".repeat(10)}…\n\n${url}`).weightedLength).toBeLessThanOrEqual(256);
    expect(twitterText.parseTweet(`${result.slice(0, -1)}${"あ".repeat(11)}…\n\n${url}`).weightedLength).toBeGreaterThan(256);
    expect(result.endsWith("…")).toBe(true);
  });

  it("counts URLs as 23 regardless of their actual length", () => {
    const shortUrl = "https://skyblur.uk/p/1";
    const longUrl = "https://skyblur.uk/post/example/1234567890";

    expect(buildShareTextForX("あ".repeat(300), "fallback", shortUrl)).toHaveLength(
      buildShareTextForX("あ".repeat(300), "fallback", longUrl).length,
    );
  });

  it("keeps the observed preview URL example within the composer margin", () => {
    const text = "相当怪文書気味なので自分のサービスで。 ATProto Dashboardは当初は「bookmarkを名乗るコレクションがいっぱいあるような気がするけど総量がわからん」からスタートしたような記憶があります。 その後、お世辞にもアプリが作りやすいインフラでもなく、ユニークユーザー数…";
    const url = "https://preview.skyblur.uk/post/did:plc:rgdcflm4ylsl6udghmtblydc/3lxkkzkbdicf7";
    const result = buildShareTextForX(text, "fallback", url);

    expect(twitterText.parseTweet(`${result}\n\n${url}`).weightedLength).toBeLessThanOrEqual(256);
  });
});

describe("buildNativeShareData", () => {
  it("shares only text with the post URL embedded", () => {
    expect(buildNativeShareData("Skyblur", "I love ○○○○○!", "https://skyblur.uk/post/example/1")).toEqual({
      text: "I love ○○○○○!\n\nhttps://skyblur.uk/post/example/1",
    });
  });
});
