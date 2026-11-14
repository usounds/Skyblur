'use client';

import { setNonce } from 'get-nonce';
import { useState } from 'react';

import {
  MantineProvider,
  createTheme,
  defaultVariantColorsResolver,
  type CSSVariablesResolver,
  type VariantColorsResolver,
} from '@mantine/core';

const variantColorResolver: VariantColorsResolver = (input) => {
  const resolved = defaultVariantColorsResolver(input);
  const isDefaultBlue = input.color === 'blue' && !input.color.includes('.');

  if ((input.variant || 'filled') === 'filled' && isDefaultBlue) {
    return {
      ...resolved,
      color: 'light-dark(var(--mantine-color-white), var(--mantine-color-black))',
    };
  }

  return resolved;
};

const theme = createTheme({
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
  headings: {
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
    fontWeight: '700',
  },
  primaryColor: 'blue',
  primaryShade: { light: 8, dark: 5 },
  autoContrast: true,
  luminanceThreshold: 0.25,
  variantColorResolver,
});

const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': 'var(--mantine-color-gray-7)',
  },
  dark: {
    '--mantine-color-dimmed': 'var(--mantine-color-gray-3)',
  },
});

export function AppMantineProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // Keep the nonce from the first render: it matches the delivered document's
  // CSP, while later RSC payloads (router.refresh) carry a fresh, unusable one.
  // The scroll-lock library reads get-nonce's global, so set it once on the client.
  const [getStyleNonce] = useState(() => {
    const styleNonce = nonce ?? '';
    if (typeof document !== 'undefined') setNonce(styleNonce);
    return () => styleNonce;
  });
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}
      getStyleNonce={getStyleNonce}>
      {children}
    </MantineProvider>
  );
}
