import { describe, it, expect } from 'vitest';
import { mdToHtml } from '../../scripts/build-labs.mjs';

describe('mdToHtml', () => {
  it('renders headings, lists, inline code, fences, and escapes HTML', () => {
    const html = mdToHtml('# Title\n\n- item `x<y`\n\n```\na < b\n```\n\npara **bold**');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<li>item <code>x&lt;y</code></li>');
    expect(html).toContain('<pre><code>a &lt; b\n</code></pre>');
    expect(html).toContain('<p>para <strong>bold</strong></p>');
    expect(html).not.toContain('x<y');
  });
});
