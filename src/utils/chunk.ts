import { TELEGRAM_CHUNK_SIZE } from "../config/constants";

function toGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }

  return Array.from(text);
}

function sequenceStartsAt(segments: readonly string[], separator: readonly string[], index: number): boolean {
  return separator.every((part, partIndex) => segments[index + partIndex] === part);
}

function findLastSequence(segments: readonly string[], separatorText: string): number {
  const separator = toGraphemes(separatorText);
  for (let index = segments.length - separator.length; index >= 0; index -= 1) {
    if (sequenceStartsAt(segments, separator, index)) {
      return index;
    }
  }
  return -1;
}

function findBoundary(candidate: readonly string[]): number {
  for (const separator of ["\n\n", "\n", " "]) {
    const index = findLastSequence(candidate, separator);
    if (index > 0) {
      return separator === " " ? index : index + toGraphemes(separator).length;
    }
  }
  return -1;
}

export function chunkText(text: string, maxLength = TELEGRAM_CHUNK_SIZE): string[] {
  if (!Number.isSafeInteger(maxLength) || maxLength <= 0) {
    throw new RangeError("maxLength must be a positive safe integer");
  }

  const segments = toGraphemes(text);
  const chunks: string[] = [];
  let offset = 0;

  while (offset < segments.length) {
    const remaining = segments.slice(offset);
    if (remaining.length <= maxLength) {
      const finalChunk = remaining.join("").trimEnd();
      if (finalChunk.length > 0) {
        chunks.push(finalChunk);
      }
      break;
    }

    const candidate = remaining.slice(0, maxLength);
    const boundary = findBoundary(candidate);
    const cutLength = boundary > 0 ? boundary : maxLength;
    const chunk = remaining.slice(0, cutLength).join("").trimEnd();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    offset += cutLength;

    while (offset < segments.length && /^\s$/u.test(segments[offset] ?? "")) {
      offset += 1;
    }
  }

  return chunks;
}
