import { jwks } from "@/types/types";

export async function GET() {
    return new Response(JSON.stringify(jwks), {
        status: 200,
        headers: {
            'content-type': 'application/json'
        }
    });

}