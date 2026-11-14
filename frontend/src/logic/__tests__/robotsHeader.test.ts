import { describe, expect, it } from 'vitest';
import { getRobotsHeader } from '../robotsHeader';

describe('getRobotsHeader', () => {
    it('marks post and profile pages as noindex', () => {
        expect(getRobotsHeader('/post/did%3Aplc%3Aabc/3kabc')).toBe('noindex, nofollow');
        expect(getRobotsHeader('/profile/did%3Aplc%3Aabc')).toBe('noindex, nofollow');
    });

    it('leaves public pages indexable', () => {
        expect(getRobotsHeader('/ja')).toBeNull();
        expect(getRobotsHeader('/en/features')).toBeNull();
        expect(getRobotsHeader('/postscript')).toBeNull();
    });
});
