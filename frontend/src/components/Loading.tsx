import { Loader, Stack, Text } from '@mantine/core';

export function Loading() {
  return (
    <div className="flex items-center justify-center h-screen w-screen ">
      <Stack align="center" gap="sm">
        <Loader color="blue" type="dots" />
        <Text size="sm" c="dimmed">Loading...</Text>
      </Stack>
    </div>
  );
}


export default Loading;