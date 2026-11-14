// @vitest-environment jsdom
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { cleanup, render } from '@testing-library/react';
import { getNonce } from 'get-nonce';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppMantineProvider } from '../AppMantineProvider';

describe('AppMantineProvider', () => {
    beforeEach(() => {
        vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    });

    afterEach(() => {
        cleanup();
        document.head.querySelectorAll('style').forEach((style) => style.remove());
        vi.unstubAllGlobals();
    });

    it('passes the document nonce to Mantine styles and get-nonce', () => {
        render(<AppMantineProvider nonce="first-nonce"><div /></AppMantineProvider>);

        expect(getNonce()).toBe('first-nonce');
        const styles = Array.from(document.querySelectorAll('style'));
        expect(styles.length).toBeGreaterThan(0);
        expect(styles.every((style) => style.nonce === 'first-nonce')).toBe(true);
    });

    it('keeps the first nonce when a refreshed payload carries a new one', () => {
        const { rerender } = render(<AppMantineProvider nonce="document-nonce"><div /></AppMantineProvider>);
        rerender(<AppMantineProvider nonce="refreshed-nonce"><div /></AppMantineProvider>);

        expect(getNonce()).toBe('document-nonce');
        expect(Array.from(document.querySelectorAll('style'), (style) => style.nonce)).not.toContain('refreshed-nonce');
    });

    it('shares one get-nonce instance with the scroll-lock style injector', () => {
        const appRequire = createRequire(import.meta.url);
        const fromMantine = createRequire(appRequire.resolve('@mantine/core'));
        const fromScrollLock = createRequire(fromMantine.resolve('react-remove-scroll'));
        const fromStyleSingleton = createRequire(fromScrollLock.resolve('react-style-singleton'));

        expect(realpathSync(fromStyleSingleton.resolve('get-nonce'))).toBe(realpathSync(appRequire.resolve('get-nonce')));
    });
});
