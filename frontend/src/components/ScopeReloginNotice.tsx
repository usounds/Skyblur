"use client";

import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { Alert, Button, Group, Text } from '@mantine/core';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import styles from './ScopeReloginNotice.module.css';

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
      className={styles.notice}
      classNames={{
        icon: styles.icon,
        title: styles.title,
        body: styles.body,
        message: styles.message,
      }}
      variant="default"
      icon={<ShieldAlert size={18} />}
      title={locale.ScopeRelogin_Title}
      mb="md"
      radius="sm"
    >
      <Group className={styles.content} justify="space-between" align="flex-start" gap="sm">
        <div className={styles.copy}>
          <Text className={styles.description} size="sm">{locale.ScopeRelogin_Message}</Text>
          <Text className={styles.scopes} size="xs" mt={4} lineClamp={2}>
            {missingScopes.join(' ')}
          </Text>
        </div>
        <Button
          className={styles.button}
          component="a"
          href={getReloginUrl()}
          size="compact-sm"
          color="blue"
          variant="filled"
          leftSection={<RefreshCw size={14} />}
        >
          {locale.ScopeRelogin_Button}
        </Button>
      </Group>
    </Alert>
  );
}
