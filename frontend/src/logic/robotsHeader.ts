// Pages that render user content are noindex. Sending the header as well as the
// meta tag lets crawlers honour it without depending on how metadata is streamed.
const noIndexPrefixes = ['/post/', '/profile/'];

export function getRobotsHeader(pathname: string): string | null {
    return noIndexPrefixes.some((prefix) => pathname.startsWith(prefix)) ? 'noindex, nofollow' : null;
}
