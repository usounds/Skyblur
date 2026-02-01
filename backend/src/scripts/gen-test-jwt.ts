import * as didJWT from 'did-jwt';

/**
 * 使い方:
 * 1. .dev.vars の OAUTH_PRIVATE_KEY_JWK を環境変数にセット
 *    export OAUTH_PRIVATE_KEY_JWK='{"kty":"EC",...}'
 * 2. npx tsx src/scripts/gen-test-jwt.ts
 */

import * as fs from 'fs';
import * as path from 'path';

let jwkStr = process.env.OAUTH_PRIVATE_KEY_JWK;

if (!jwkStr) {
    try {
        const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
        if (fs.existsSync(devVarsPath)) {
            const content = fs.readFileSync(devVarsPath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.startsWith('OAUTH_PRIVATE_KEY_JWK=')) {
                    jwkStr = line.replace('OAUTH_PRIVATE_KEY_JWK=', '').trim();
                    break;
                }
            }
        }
    } catch (e) {
        console.warn('Could not read .dev.vars file:', e);
    }
}

if (!jwkStr) {
    console.error('Error: OAUTH_PRIVATE_KEY_JWK is not set in environment or .dev.vars');
    process.exit(1);
}

let appviewHost = process.env.APPVIEW_HOST || 'dev.skyblur.uk';

// Try to read APPVIEW_HOST from wrangler.jsonc or .dev.vars
if (!process.env.APPVIEW_HOST) {
    try {
        const wranglerPath = path.resolve(process.cwd(), 'wrangler.jsonc');
        if (fs.existsSync(wranglerPath)) {
            const content = fs.readFileSync(wranglerPath, 'utf-8');
            // Simple regex to find vars.APPVIEW_HOST in JSONC
            const match = content.match(/"APPVIEW_HOST":\s*"([^"]+)"/);
            if (match) appviewHost = match[1];
        }
    } catch (e) { }
}

const jwk = JSON.parse(jwkStr);

async function main() {
    // did-jwt expects a private key in a specific format for signing.
    if (!jwk.d) {
        console.error('Error: JWK does not contain private key member "d".');
        process.exit(1);
    }

    const signer = didJWT.ES256Signer(didJWT.base64ToBytes(jwk.d));

    const payload = {
        iss: 'did:local:test',
        aud: `did:web:${appviewHost}`,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
    };

    const jwt = await didJWT.createJWT(
        payload,
        { issuer: 'did:local:test', signer },
        { alg: 'ES256' }
    );

    console.log('Generated JWT:');
    console.log(jwt);
    console.log('\nUsage example (with CSRF bypass):');
    console.log(`curl -X POST -H "Authorization: Bearer ${jwt}" -H "Origin: https://dev.skyblur.uk" -H "Content-Type: application/json" -d '{"uri": "at://did:local:test/uk.skyblur.post/test-rkey", "text": "test", "visibility": "followers"}' http://localhost:8787/xrpc/uk.skyblur.post.store`);
}

main().catch(console.error);
