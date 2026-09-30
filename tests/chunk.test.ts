import { describe, expect, it } from "vitest";
import { chunkText } from "../src/utils/chunk";

function graphemeLength(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text)).length;
}

describe("chunkText", () => {
  it("returns a short message unchanged", () => {
    expect(chunkText("hello", 4000)).toEqual(["hello"]);
  });

  it("splits long messages within the requested boundary", () => {
    const text = `${"word ".repeat(1800)}end`;
    const chunks = chunkText(text, 1000);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(graphemeLength(chunk)).toBeLessThanOrEqual(1000);
    }
  });

  it("prefers newline boundaries", () => {
    const text = "first paragraph\nsecond paragraph\nthird paragraph";
    const chunks = chunkText(text, 30);

    expect(chunks[0]).toBe("first paragraph");
    expect(chunks.join(" ")).toContain("second paragraph");
  });

  it("prefers paragraph boundaries over later spaces", () => {
    const text = "alpha\n\nbeta gamma delta";
    const chunks = chunkText(text, 20);

    expect(chunks[0]).toBe("alpha");
    expect(chunks[1]).toBe("beta gamma delta");
  });

  it("does not corrupt complex Unicode graphemes", () => {
    const family = "👨‍👩‍👧‍👦";
    const text = family.repeat(100);
    const chunks = chunkText(text, 10);

    expect(chunks.length).toBe(10);
    for (const chunk of chunks) {
      expect(chunk).toBe(family.repeat(10));
      expect(chunk).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
    }
  });

  it("handles an exact boundary", () => {
    expect(chunkText("12345", 5)).toEqual(["12345"]);
  });

  it("returns no chunks for empty input", () => {
    expect(chunkText("", 10)).toEqual([]);
  });

  it("rejects invalid limits", () => {
    expect(() => chunkText("hello", 0)).toThrow(RangeError);
  });
});
