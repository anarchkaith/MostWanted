import assert from 'node:assert/strict';
import { unwrapMarkdownFence } from './markdownUtils.js';

const markdown = '# Titulo\n\nTexto **importante**.\n\n```js\nconst value = 1;\n```';

assert.equal(
  unwrapMarkdownFence(`\`\`\`markdown\n${markdown}\n\`\`\``),
  markdown,
);
assert.equal(
  unwrapMarkdownFence(`\`\`\`\n${markdown}\n\`\`\``),
  markdown,
);
assert.equal(
  unwrapMarkdownFence('```python\nprint("hola")\n```'),
  '```python\nprint("hola")\n```',
);
assert.equal(
  unwrapMarkdownFence('```\nUna respuesta de texto normal.\n```'),
  '```\nUna respuesta de texto normal.\n```',
);
assert.equal(unwrapMarkdownFence(markdown), markdown);
