import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * クッキーの値（DID）に署名を付加・検証するためのクラス
 */
export class CookieHasher {
    private static secret: string = process.env.SESSION_SECRET || process.env.OAUTH_PRIVATE_KEY_JWK || 'default-fallback-secret-skyblur';

    /**
     * 値に署名を付けてシリアライズする (value.signature)
     */
    static sign(value: string): string {
        const hmac = createHmac('sha256', this.secret);
        hmac.update(value);
        const signature = hmac.digest('base64url');
        return `${value}.${signature}`;
    }

    /**
     * 署名付き文字列を検証し、元の値を返す。失敗した場合は null。
     */
    static verify(signedValue: string): string | null {
        const parts = signedValue.split('.');
        if (parts.length !== 2) return null;

        const [value, signature] = parts;
        const expectedSignature = createHmac('sha256', this.secret).update(value).digest('base64url');

        // タイミング攻撃対策として timingSafeEqual を使用
        try {
            const buf1 = Buffer.from(signature);
            const buf2 = Buffer.from(expectedSignature);
            if (buf1.length === buf2.length && timingSafeEqual(buf1, buf2)) {
                return value;
            }
        } catch (e) {
            return null;
        }

        return null;
    }
}
