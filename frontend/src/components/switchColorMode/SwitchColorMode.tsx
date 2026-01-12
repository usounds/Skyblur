import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { Sun, Moon } from 'lucide-react';
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
        <Sun stroke="currentColor" strokeWidth={1.5} size={20} />
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
      {computedColorScheme === 'light' ? (
        <Moon stroke="currentColor" strokeWidth={1.5} size={20} />
      ) : (
        <Sun stroke="currentColor" strokeWidth={1.5} size={20} />
      )}
    </ActionIcon>
  );
}