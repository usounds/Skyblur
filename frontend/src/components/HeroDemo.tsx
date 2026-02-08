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
                        I love <span className="bg-blue-100 text-blue-700 px-1 rounded font-mono">[Spicy Food]</span>!
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
            <Card shadow="sm" padding="lg" radius="md" withBorder w={300} style={{ borderColor: 'var(--mantine-color-blue-2)' }}>
                <Card.Section inheritPadding py="xs" bg="blue.0">
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
                    <Card radius="md" withBorder p="sm" bg="gray.0">
                        <Group gap="xs" wrap="nowrap">
                            <Box w={40} h={40} bg="gray.3" style={{ borderRadius: '4px', flexShrink: 0 }} />
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

// Mobile Version (Vertical Stack) - simplified or hidden if too complex, 
// but for now I'll use the same structure inside responsive containers in HomeContent or CSS.
// Actually, let's make it responsive within the component.
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
                            I love <span className="bg-blue-100 text-blue-700 px-1 rounded">[Spicy Food]</span>!
                        </Text>
                    </Card>

                    <ArrowDown size={24} className="text-gray-400" />

                    {/* Output Side */}
                    <Card shadow="sm" padding="md" radius="md" withBorder w="100%" style={{ borderColor: 'var(--mantine-color-blue-2)' }}>
                        <Group justify="space-between" mb="xs">
                            <Text size="xs" fw={700} c="blue">Bluesky Post:</Text>
                            <BlueskyIcon size={14} />
                        </Group>
                        <Text size="sm" mb="xs">
                            I love {locale.CreatePost_OmmitChar.repeat(9)}!
                        </Text>
                        <Card radius="sm" withBorder p="xs" bg="gray.0">
                            <Text size="xs" c="dimmed">{locale.CreatePost_OGPDescription}</Text>
                        </Card>
                    </Card>
                </Stack>
            </Box>
        </Box>
    )
}
