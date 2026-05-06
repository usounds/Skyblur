"use client";

import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { Alert, Button, Group, Text } from '@mantine/core';
import { RefreshCw, ShieldAlert } from 'lucide-react';

type ScopeReloginNoticeProps = {
  compact?: boolean;
};

export function ScopeReloginNotice({ compact: _compact }: ScopeReloginNoticeProps) {
  const { localeData: locale } = useLocale();
  const did = useXrpcAgentStore((state) => state.did);
  const missingScopes = useXrpcAgentStore((state) => state.missingAppBskyRpcScopes);
  const getReloginUrl = useXrpcAgentStore((state) => state.getReloginUrl);

  if (!did || missingScopes.length === 0) return null;

  return (
    <Alert
      variant="light"
      color="yellow"
      icon={<ShieldAlert size={18} />}
      title={locale.ScopeRelogin_Title}
      mb="md"
      radius="sm"
    >
      <Group justify="space-between" align="flex-start" gap="sm">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm">{locale.ScopeRelogin_Message}</Text>
          <Text size="xs" c="dimmed" mt={4} lineClamp={2}>
            {missingScopes.join(' ')}
          </Text>
        </div>
        <Button
          component="a"
          href={getReloginUrl()}
          size="compact-sm"
          variant="filled"
          leftSection={<RefreshCw size={14} />}
        >
          {locale.ScopeRelogin_Button}
        </Button>
      </Group>
    </Alert>
  );
}
