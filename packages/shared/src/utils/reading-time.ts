import { WORDS_PER_MINUTE } from "../constants/index.js";

/**
 * Estimates reading time from raw text content.
 * Strips HTML tags before counting words — works with Tiptap HTML output.
 */
export function estimateReadingTime(content: string): number {
  const wordCount = countWords(content);
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

export function countWords(content: string): number {
  const text = content.replace(/<[^>]*>/g, " ");
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
