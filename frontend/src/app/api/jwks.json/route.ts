export const jwks = {
    keys: [
        {
            kty: "EC",
            use: "sig",
            alg: "ES256",
            kid: "d92ba95d-5f71-4d16-9fc4-e683979ecb41",
            crv: "P-256",
            x: "mJHhd--984RgWd7fHI14jcDNQS6bKjFvQYddBaIQmhY",
            y: "u7MGN3U41MYXHZx6Lxny77SI8uLImAF-ulsEN15kPG0"
        }
    ]
}

export async function GET() {
    return new Response(JSON.stringify(jwks), {
        status: 200,
        headers: {
            'content-type': 'application/json'
        }
    });

}