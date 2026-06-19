import { Avatar, Box, Card, Group, Text, ThemeIcon, Stack } from '@mantine/core';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { BlueskyIcon } from './Icons';
import en from '@/locales/en';

type LocaleData = typeof en;

export function HeroDemo({ locale }: { locale: LocaleData }) {
    return (
        <Group align="center" justify="center" gap="xl" my="xl" visibleFrom="sm">
            {/* Input Side (Skyblur) */}
            <Card shadow="sm" padding="lg" radius="md" withBorder w={300}>
                <Card.Section withBorder inheritPadding py="xs">
                    <Group justify="space-between" wrap="nowrap">
                        <Box
                            w={96}
                            h={12}
                            style={{
                                borderRadius: 9999,
                                background: 'var(--mantine-color-gray-3)',
                            }}
                        />
                    </Group>
                </Card.Section>
                <Stack mt="md" gap="sm">
                    <Group gap="xs">
                        <Avatar size="sm" radius="xl" color="blue" />
                        <Box
                            w={64}
                            h={10}
                            style={{
                                borderRadius: 9999,
                                background: 'var(--mantine-color-gray-3)',
                            }}
                        />
                    </Group>
                    <Box
                        h={18}
                        style={{
                            borderRadius: 6,
                            background: 'linear-gradient(90deg, var(--mantine-color-gray-2), var(--mantine-color-gray-3))',
                        }}
                    />
                    <Box
                        w={132}
                        h={10}
                        style={{
                            borderRadius: 9999,
                            background: 'var(--mantine-color-gray-3)',
                        }}
                    />
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
                        <Group gap={6} style={{ color: 'light-dark(var(--mantine-color-blue-8), var(--mantine-color-blue-1))' }}>
                            <BlueskyIcon size={16} />
                            <Text fw={500} size="sm">Bluesky (Post)</Text>
                        </Group>
                    </Group>
                </Card.Section>
                <Stack mt="md" gap="xs">
                    <Group gap="xs">
                        <Avatar size="sm" radius="xl" color="blue" />
                        <Box>
                            <Text size="sm" fw={700} lh={1}>User</Text>
                            <Text size="xs" style={{ color: 'light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-4))' }}>@user.bsky.social</Text>
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
                                <Text size="xs" style={{ color: 'light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-4))' }} lineClamp={1}>
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

export function ResponsiveHeroDemo({ locale }: { locale: LocaleData }) {
    return (
        <Box my="xl">
            {/* Desktop View */}
            <HeroDemo locale={locale} />

            {/* Mobile View */}
            <Box hiddenFrom="sm">
                <Stack align="center" gap="md">
                    {/* Input Side */}
                    <Card shadow="sm" padding="md" radius="md" withBorder w="100%">
                        <Group gap="xs" mb="xs">
                            <Avatar size="sm" radius="xl" color="blue" />
                            <Box
                                w={72}
                                h={10}
                                style={{
                                    borderRadius: 9999,
                                    background: 'var(--mantine-color-gray-3)',
                                }}
                            />
                        </Group>
                        <Box
                            h={18}
                            style={{
                                borderRadius: 6,
                                background: 'linear-gradient(90deg, var(--mantine-color-gray-2), var(--mantine-color-gray-3))',
                            }}
                        />
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
                        <Group justify="space-between" mb="xs" style={{ color: 'light-dark(var(--mantine-color-blue-8), var(--mantine-color-blue-1))' }}>
                            <Text size="xs" fw={700}>Bluesky Post:</Text>
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
                            <Text size="xs" style={{ color: 'light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-4))' }}>{locale.CreatePost_OGPDescription}</Text>
                        </Card>
                    </Card>
                </Stack>
            </Box>
        </Box>
    )
}
