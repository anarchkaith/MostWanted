const OPENING_MARKDOWN_FENCE = /^\s*(`{3,}|~{3,})[ \t]*(markdown|md)?[ \t]*\r?\n/i;
const MARKDOWN_SYNTAX = /^(?: {0,3}#{1,6}\s+\S| {0,3}>\s| {0,3}(?:[-*+]\s+\S|\d+[.)]\s+\S)| {0,3}\|.*\|[ \t]*$| {0,3}(?:---+|___+|\*\*\*+)[ \t]*$)|\*\*[^*\n]+\*\*|__[^_\n]+__/m;

export function unwrapMarkdownFence(content) {
  const opening = typeof content === 'string' ? content.match(OPENING_MARKDOWN_FENCE) : null;
  if (!opening) return content;

  const [head, fence, language] = opening;
  let markdown = content.slice(head.length).trimEnd();
  const lastBreak = markdown.lastIndexOf('\n');
  if (lastBreak >= 0 && markdown.slice(lastBreak + 1).trim() === fence) {
    markdown = markdown.slice(0, lastBreak).trimEnd();
  }

  return language || MARKDOWN_SYNTAX.test(markdown) ? markdown : content;
}
