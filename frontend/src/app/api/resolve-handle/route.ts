import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
        return NextResponse.json({ error: 'Missing handle parameter' }, { status: 400 });
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
        console.error('Error resolving handle:', error);
        return NextResponse.json(
            { error: 'Failed to resolve handle' },
            { status: 500 }
        );
    }
}
