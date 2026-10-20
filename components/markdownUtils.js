const OUTER_MARKDOWN_FENCE = /^\s*```(markdown|md)?[ \t]*\r?\n([\s\S]*)\r?\n```[ \t]*$/i;
const MARKDOWN_SYNTAX = /^(?: {0,3}#{1,6}\s+\S| {0,3}>\s| {0,3}(?:[-*+]\s+\S|\d+[.)]\s+\S)| {0,3}\|.*\|[ \t]*$| {0,3}(?:---+|___+|\*\*\*+)[ \t]*$)|\*\*[^*\n]+\*\*|__[^_\n]+__/m;

export function unwrapMarkdownFence(content) {
  const match = typeof content === 'string' ? content.match(OUTER_MARKDOWN_FENCE) : null;
  if (!match) return content;

  const [, language, markdown] = match;
  return language || MARKDOWN_SYNTAX.test(markdown) ? markdown : content;
}
