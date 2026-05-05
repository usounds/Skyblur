"use client";

import { fetchOwnedLists, type OwnedListOption } from '@/logic/listVisibility';
import { useLocale } from '@/state/Locale';
import type { Client } from '@atcute/client';
import { Alert, Avatar, Badge, Button, Group, Loader, Stack, Text, TextInput } from '@mantine/core';
import { AlertCircle, Check, List, RefreshCw, Search } from 'lucide-react';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';

type Props = {
  value?: string;
  onChange: (list: OwnedListOption | null) => void;
  did: string;
  agent: Client | null;
  disabled?: boolean;
  error?: string;
};

const LIST_RETRY_DELAY_MS = 1_000;
const LIST_MAX_ATTEMPTS = 2;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function OwnedListPicker({ value, onChange, did, agent, disabled, error }: Props) {
  const { localeData: locale } = useLocale();
  const [lists, setLists] = useState<OwnedListOption[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  const load = async () => {
    if (!agent || !did) return;
    setIsLoading(true);
    setLoadError('');
    setIsRetrying(false);
    try {
      for (let attempt = 1; attempt <= LIST_MAX_ATTEMPTS; attempt++) {
        try {
          setLists(await fetchOwnedLists(agent, did));
          setIsRetrying(false);
          return;
        } catch (e) {
          if (attempt >= LIST_MAX_ATTEMPTS) throw e;
          setIsRetrying(true);
          await wait(LIST_RETRY_DELAY_MS);
        }
      }
    } catch (e) {
      console.error(e);
      setLoadError(locale.CreatePost_ListPickerError);
    } finally {
      setIsRetrying(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, did]);

  const filteredLists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return lists;
    return lists.filter((list) => {
      return `${list.name} ${list.description || ''} ${list.purpose || ''}`.toLowerCase().includes(normalizedQuery);
    });
  }, [lists, query]);

  const choose = (list: OwnedListOption) => {
    if (disabled) return;
    onChange(list);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, list: OwnedListOption) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    choose(list);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Group justify="space-between" align="center" mb={8}>
        <Group gap={8}>
          <List size={17} />
          <Text size="sm" fw={600}>{locale.CreatePost_ListPickerTitle}</Text>
        </Group>
        {isLoading && <Loader size="xs" />}
      </Group>

      <div
        aria-invalid={!!error}
        style={{
          border: `1px solid ${error ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-gray-3)'}`,
          borderRadius: 8,
          background: 'var(--mantine-color-white)',
          padding: 10,
        }}
      >
        {lists.length > 6 && (
          <TextInput
            mb="xs"
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={locale.CreatePost_ListPickerSearch}
            leftSection={<Search size={15} />}
            disabled={disabled}
          />
        )}

        {loadError && (
          <Alert variant="light" color="red" icon={<AlertCircle size={16} />} mb="xs">
            <Group justify="space-between" gap="xs">
              <Text size="sm">{loadError}</Text>
              <Button size="compact-sm" variant="subtle" leftSection={<RefreshCw size={14} />} onClick={load}>
                {locale.CreatePost_ListPickerRetry}
              </Button>
            </Group>
          </Alert>
        )}

        {isRetrying && !loadError && (
          <Alert variant="light" color="yellow" icon={<RefreshCw size={16} />} mb="xs">
            <Text size="sm">{locale.CreatePost_ListPickerRetrying}</Text>
          </Alert>
        )}

        {isLoading && lists.length === 0 && (
          <Stack gap={8}>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  height: 68,
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, var(--mantine-color-gray-1), var(--mantine-color-gray-0), var(--mantine-color-gray-1))',
                }}
                aria-label={locale.CreatePost_ListPickerLoading}
              />
            ))}
          </Stack>
        )}

        {!isLoading && !loadError && lists.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">{locale.CreatePost_ListPickerEmpty}</Text>
        )}

        {filteredLists.length > 0 && (
          <Stack gap={8}>
            {filteredLists.map((list) => {
              const selected = value === list.uri;
              return (
                <button
                  key={list.uri}
                  type="button"
                  disabled={disabled}
                  onClick={() => choose(list)}
                  onKeyDown={(event) => handleKeyDown(event, list)}
                  style={{
                    width: '100%',
                    minHeight: 68,
                    border: `1px solid ${selected ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-2)'}`,
                    borderRadius: 8,
                    background: selected ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-white)',
                    padding: '10px 12px',
                    display: 'grid',
                    gridTemplateColumns: '42px minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Avatar src={list.avatar} radius="sm" size={42}>
                    <List size={20} />
                  </Avatar>
                  <div style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" fw={600} truncate>{list.name}</Text>
                      {typeof list.memberCount === 'number' && (
                        <Badge size="xs" variant="light" color="gray">
                          {locale.CreatePost_ListPickerMembers.replace('{1}', String(list.memberCount))}
                        </Badge>
                      )}
                    </Group>
                    {list.description && (
                      <Text size="xs" c="dimmed" lineClamp={2}>{list.description}</Text>
                    )}
                  </div>
                  {selected && (
                    <span
                      aria-label={locale.CreatePost_ListPickerSelected}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: 'var(--mantine-color-blue-6)',
                        color: 'var(--mantine-color-white)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Check size={16} />
                    </span>
                  )}
                </button>
              );
            })}
          </Stack>
        )}
      </div>

      {error && <Text size="xs" c="red" mt={5}>{error}</Text>}
    </div>
  );
}
