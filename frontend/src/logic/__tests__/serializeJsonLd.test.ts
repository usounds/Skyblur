import { expect, it } from 'vitest';
import { serializeJsonLd } from '../serializeJsonLd';

it('preserves JSON data while preventing script tag breakout', () => {
    const value = { text: '</script><script>alert("XSS")</script>', title: '日本語 & "quotes"' };
    const serialized = serializeJsonLd(value);
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual(value);
});
