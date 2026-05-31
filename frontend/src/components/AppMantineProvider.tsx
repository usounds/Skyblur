'use client';

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

export function AppMantineProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
      {children}
    </MantineProvider>
  );
}
