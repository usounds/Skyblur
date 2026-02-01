"use client";
import React from 'react';
import { Modal, Button, Text, Stack } from '@mantine/core';
import { Monitor, ShieldOff } from 'lucide-react';
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';

interface LogoutModalProps {
    opened: boolean;
    onClose: () => void;
}

export const LogoutModal = ({ opened, onClose }: LogoutModalProps) => {
    const { localeData: locale } = useLocale();
    const router = useRouter();
    const logoutAction = useXrpcAgentStore(state => state.logout);

    const handleLogout = async (mode: 'soft' | 'hard') => {
        notifications.show({
            id: 'logout-process',
            title: locale.Menu_Logout,
            message: locale.Menu_LogoutProgress,
            loading: true,
            autoClose: false
        });

        try {
            await logoutAction(mode);
            onClose();
            // 設定ページなど、認証が必要なページにいる場合はホームへ
            if (window.location.pathname.startsWith('/settings') || window.location.pathname.startsWith('/console')) {
                router.push('/');
            } else {
                router.refresh();
            }
        } catch (error) {
            console.error('Logout error:', error);
            notifications.show({
                title: 'Error',
                message: 'Logout failed',
                color: 'red',
            });
        } finally {
            notifications.hide('logout-process');
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={locale.Menu_Logout}
            centered
            radius="md"
            size="md"
        >
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    {locale.Menu_LogoutDescription}
                </Text>

                <Button
                    variant="light"
                    color="orange"
                    size="lg"
                    fullWidth
                    leftSection={<Monitor size={24} />}
                    onClick={() => handleLogout('soft')}
                    styles={{
                        inner: { justifyContent: 'flex-start' },
                        label: { flex: 1, textAlign: 'left', marginLeft: '10px' }
                    }}
                >
                    <Stack gap={0}>
                        <Text fw={600}>{locale.Menu_LogoutSoft}</Text>
                        <Text size="xs" fw={400}>{locale.Menu_LogoutSoftDescription}</Text>
                    </Stack>
                </Button>

                <Button
                    variant="light"
                    color="red"
                    size="lg"
                    fullWidth
                    leftSection={<ShieldOff size={24} />}
                    onClick={() => handleLogout('hard')}
                    styles={{
                        inner: { justifyContent: 'flex-start' },
                        label: { flex: 1, textAlign: 'left', marginLeft: '10px' }
                    }}
                >
                    <Stack gap={0}>
                        <Text fw={600}>{locale.Menu_LogoutHard}</Text>
                        <Text size="xs" fw={400}>{locale.Menu_LogoutHardDescription}</Text>
                    </Stack>
                </Button>


                <Button variant="subtle" color="gray" onClick={onClose} fullWidth>
                    {locale.Menu_Cancel}
                </Button>
            </Stack>
        </Modal>
    );
};
