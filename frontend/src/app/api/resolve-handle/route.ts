import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate ATProto handle format.
 * Handles must be valid domain names: only letters, digits, hyphens, and dots are allowed.
 */
function isValidHandle(handle: string): boolean {
    // Check for empty or too long
    if (!handle || handle.length === 0 || handle.length > 253) {
        return false;
    }

    // Check for invalid characters (underscores, spaces, etc.)
    if (/[^a-zA-Z0-9.-]/.test(handle)) {
        return false;
    }

    // Must have at least two parts
    const labels = handle.split('.');
    if (labels.length < 2) {
        return false;
    }

    // Validate each label
    for (const label of labels) {
        if (label.length === 0 || label.length > 63) {
            return false;
        }
        if (label.startsWith('-') || label.endsWith('-')) {
            return false;
        }
    }

    return true;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
        return NextResponse.json({ error: 'Missing handle parameter' }, { status: 400 });
    }

    // Validate handle format before trying to resolve
    if (!isValidHandle(handle)) {
        return NextResponse.json({ error: 'Invalid handle format' }, { status: 400 });
    }

    try {
        const url = `https://${handle}/.well-known/atproto-did`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Skyblur/1.0',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to resolve handle' },
                { status: response.status }
            );
        }

        const text = await response.text();
        const did = text.split('\n')[0]?.trim();

        if (!did || (!did.startsWith('did:plc:') && !did.startsWith('did:web:'))) {
            return NextResponse.json({ error: 'Invalid DID format' }, { status: 400 });
        }

        return NextResponse.json({ did });
    } catch (error) {
        // Return 400 for network errors (unreachable domain) instead of 500
        // This prevents error notifications for invalid user input
        return NextResponse.json(
            { error: 'Failed to resolve handle' },
            { status: 400 }
        );
    }
}
