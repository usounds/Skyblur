// Escape HTML delimiters rather than sanitizing JSON as HTML. This also works
// on the server, where DOMPurify has no browser DOM to initialize against.
export function serializeJsonLd(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
