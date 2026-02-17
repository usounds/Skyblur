"use client";
import { Avatar, Box, Card, Group, Text, ThemeIcon, Stack, Code } from '@mantine/core';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { BlueskyIcon } from './Icons';
import { useLocale } from '@/state/Locale';

export function HeroDemo() {
    const { localeData: locale } = useLocale();
    return (
        <Group align="center" justify="center" gap="xl" my="xl" visibleFrom="sm">
            {/* Input Side (Skyblur) */}
            <Card shadow="sm" padding="lg" radius="md" withBorder w={300}>
                <Card.Section withBorder inheritPadding py="xs">
                    <Group justify="space-between">
                        <Text fw={500} size="sm">Skyblur (Input)</Text>
                    </Group>
                </Card.Section>
                <Stack mt="md" gap="xs">
                    <Group gap="xs">
                        <Avatar size="sm" radius="xl" color="blue" />
                        <Text size="sm" fw={700}>User</Text>
                    </Group>
                    <Text size="sm">
                        I love <span style={{
                            background: 'light-dark(var(--mantine-color-blue-1), var(--mantine-color-blue-9))',
                            color: 'light-dark(var(--mantine-color-blue-7), var(--mantine-color-blue-3))',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                        }}>[Spicy Food]</span>!
                    </Text>
                    <Text size="xs" c="dimmed">
                        {locale.Home_HeroDemoBlurDescription}
                    </Text>
                </Stack>
            </Card>

            <ThemeIcon variant="transparent" c="gray" size="xl">
                <ArrowRight size={32} />
            </ThemeIcon>

            {/* Output Side (Bluesky) */}
            <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                w={300}
                style={{
                    borderColor: 'light-dark(var(--mantine-color-blue-2), var(--mantine-color-blue-8))',
                }}
            >
                <Card.Section
                    inheritPadding
                    py="xs"
                    style={{
                        background: 'light-dark(var(--mantine-color-blue-0), var(--mantine-color-blue-9))',
                    }}
                >
                    <Group justify="space-between">
                        <Group gap={6}>
                            <BlueskyIcon size={16} />
                            <Text fw={500} size="sm" c="blue">Bluesky (Post)</Text>
                        </Group>
                    </Group>
                </Card.Section>
                <Stack mt="md" gap="xs">
                    <Group gap="xs">
                        <Avatar size="sm" radius="xl" color="blue" />
                        <Box>
                            <Text size="sm" fw={700} lh={1}>User</Text>
                            <Text size="xs" c="dimmed">@user.bsky.social</Text>
                        </Box>
                    </Group>
                    <Text size="sm">
                        I love {locale.CreatePost_OmmitChar.repeat(9)}!
                    </Text>

                    {/* Skyblur Card Embed */}
                    <Card
                        radius="md"
                        withBorder
                        p="sm"
                        style={{
                            background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
                        }}
                    >
                        <Group gap="xs" wrap="nowrap">
                            <Box
                                w={40}
                                h={40}
                                style={{
                                    background: 'light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                }}
                            />
                            <Box>
                                <Text size="xs" fw={700}>Skyblur</Text>
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                    {locale.CreatePost_OGPDescription}
                                </Text>
                            </Box>
                        </Group>
                    </Card>
                </Stack>
            </Card>
        </Group>
    );
}

// Mobile Version (Vertical Stack)
export function ResponsiveHeroDemo() {
    const { localeData: locale } = useLocale();
    return (
        <Box my="xl">
            {/* Desktop View */}
            <HeroDemo />

            {/* Mobile View */}
            <Box hiddenFrom="sm">
                <Stack align="center" gap="md">
                    {/* Input Side */}
                    <Card shadow="sm" padding="md" radius="md" withBorder w="100%">
                        <Text size="xs" fw={700} mb="xs" c="dimmed">Skyblur Input:</Text>
                        <Text size="sm">
                            I love <span style={{
                                background: 'light-dark(var(--mantine-color-blue-1), var(--mantine-color-blue-9))',
                                color: 'light-dark(var(--mantine-color-blue-7), var(--mantine-color-blue-3))',
                                padding: '1px 4px',
                                borderRadius: '4px',
                            }}>[Spicy Food]</span>!
                        </Text>
                    </Card>

                    <ArrowDown size={24} style={{ color: 'var(--mantine-color-dimmed)' }} />

                    {/* Output Side */}
                    <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        w="100%"
                        style={{
                            borderColor: 'light-dark(var(--mantine-color-blue-2), var(--mantine-color-blue-8))',
                        }}
                    >
                        <Group justify="space-between" mb="xs">
                            <Text size="xs" fw={700} c="blue">Bluesky Post:</Text>
                            <BlueskyIcon size={14} />
                        </Group>
                        <Text size="sm" mb="xs">
                            I love {locale.CreatePost_OmmitChar.repeat(9)}!
                        </Text>
                        <Card
                            radius="sm"
                            withBorder
                            p="xs"
                            style={{
                                background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
                            }}
                        >
                            <Text size="xs" c="dimmed">{locale.CreatePost_OGPDescription}</Text>
                        </Card>
                    </Card>
                </Stack>
            </Box>
        </Box>
    )
}
