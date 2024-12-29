export function isDidString(value: string): value is `did:${string}` {
    return value.startsWith('did:');
}

export const transformUrl = (inputUrl: string): string => {

    const parts = inputUrl.split('/');

    if (parts[3] === 'app.bsky.feed.post') {
        return `https://bsky.app/profile/${parts[2]}/post/${parts[4]}`;
    }

    if (parts[3] === 'uk.skyblur.post') {
        return `https://${window.location.hostname}/post/${parts[2]}/${parts[4]}`;
    }
    if (parts[3] === 'app.bsky.feed.generator') {
        return `https://bsky.app/profile/${parts[2]}/feed/${parts[4]}`;
    }

    return ''
};