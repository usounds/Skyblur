"use client"
import { ActionIcon, Avatar, Group, Menu, Text, UnstyledButton, rem, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { IconChevronDown, IconLogout, IconSettings, IconUser } from '@tabler/icons-react';
import { LogOut, LogIn, Users, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import classes from './AvatorDropdownMenu.module.css';
import { AuthenticationTitle } from './login/Login';

export function AvatorDropdownMenu() {
    const agent = useXrpcAgentStore(state => state.agent);
    const { localeData: locale } = useLocale();
    const userProf = useXrpcAgentStore(state => state.userProf);
    const setDid = useXrpcAgentStore(state => state.setDid);
    const did = useXrpcAgentStore(state => state.did);
    const isLoginModalOpened = useXrpcAgentStore(state => state.isLoginModalOpened);
    const setIsLoginModalOpened = useXrpcAgentStore(state => state.setIsLoginModalOpened);
    const router = useRouter();

    const logout = async () => {
        // ログアウト処理中の通知を表示
        notifications.show({
            id: 'logout-process',
            title: locale.Menu_Logout,
            message: locale.Menu_LogoutProgress,
            loading: true,
            autoClose: false
        });

        try {
            // バックエンドAPIを直接呼ぶ（フロントエンドのリダイレクトを回避）
            const apiEndpoint = window.location.host.includes('dev.skyblur.uk') || window.location.host.includes('localhost')
                ? 'devapi.skyblur.uk'
                : 'api.skyblur.uk';

            await fetch(`https://${apiEndpoint}/oauth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            setDid('');
            useXrpcAgentStore.getState().setUserProf(null);
            useXrpcAgentStore.getState().setIsSessionChecked(true); // ログアウト成功をマーク
            window.localStorage.removeItem('oauth.did');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // 通知を閉じる
            notifications.hide('logout-process');
            // 設定ページからのログアウト時のみホームにリダイレクト
            if (window.location.pathname.startsWith('/settings')) {
                router.push(`/`);
            } else {
                router.refresh();
            }
        }
    };

    const login = async () => {
        setIsLoginModalOpened(true);
    }

    const handleSettings = async () => {
        setTimeout(() => {
            router.push(`/settings`);
        }, 0);
    }

    return (
        <Menu shadow="md" width={200} >
            <Menu.Target>
                {(userProf && agent) ? (
                    userProf.avatar ? (
                        <Avatar src={userProf.avatar} radius="xl" size={20} />
                    ) : (
                        <Users size={20} />
                    )
                ) : (
                    <Users size={20} />
                )}
            </Menu.Target>

            {(userProf && agent) ?
                <Menu.Dropdown>
                    <Menu.Label>User</Menu.Label>
                    <Menu.Item leftSection="@" disabled={true}>
                        {userProf.handle}
                    </Menu.Item>
                    <Menu.Label>Menu</Menu.Label>
                    <Menu.Item leftSection={<Settings size={18} />} onClick={handleSettings}>
                        {locale.Menu_Settings}
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item leftSection={<LogOut size={18} />} onClick={logout} color='red'>
                        {locale.Menu_Logout}
                    </Menu.Item>
                </Menu.Dropdown>
                :
                <Menu.Dropdown>
                    <Menu.Item leftSection={<LogIn size={18} />} onClick={login} >
                        {locale.Login_Login}
                    </Menu.Item>
                </Menu.Dropdown>
            }

            <Modal opened={isLoginModalOpened} onClose={() => setIsLoginModalOpened(false)} centered radius="md" size={340} title={locale.Login_Login} closeOnClickOutside={false}>
                <AuthenticationTitle isModal={true} />
            </Modal>
        </Menu>
    );
}