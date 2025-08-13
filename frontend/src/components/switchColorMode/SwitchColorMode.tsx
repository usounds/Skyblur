import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useEffect, useState } from "react";

export function SwitchColorMode() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Toggle color scheme"
      >
        <IconSun stroke={1.5} />
      </ActionIcon>
    );
  }

  return (
    <ActionIcon
      onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
    >
      {computedColorScheme === 'dark' ? (
        <IconSun stroke={1.5} />
      ) : (
        <IconMoon stroke={1.5} />
      )}
    </ActionIcon>
  );
}