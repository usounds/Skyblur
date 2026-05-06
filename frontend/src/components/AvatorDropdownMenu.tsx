"use client"
import { ActionIcon, Avatar, Menu, Modal } from '@mantine/core';
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { LogOut, LogIn, Users, Settings } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AuthenticationTitle } from './login/Login';
import { LogoutModal } from './LogoutModal';

export function AvatorDropdownMenu() {
    const agent = useXrpcAgentStore(state => state.agent);
    const { localeData: locale } = useLocale();
    const userProf = useXrpcAgentStore(state => state.userProf);
    const did = useXrpcAgentStore(state => state.did);
    const isLoginModalOpened = useXrpcAgentStore(state => state.isLoginModalOpened);
    const setIsLoginModalOpened = useXrpcAgentStore(state => state.setIsLoginModalOpened);
    const [logoutModalOpened, setLogoutModalOpened] = useState(false);
    const isLoggedIn = Boolean(did);

    const login = async () => {
        setIsLoginModalOpened(true);
    }

    return (
        <>
            <Menu shadow="md" width={200} >
                <Menu.Target>
                    <ActionIcon variant="default" size="lg" aria-label="Account menu">
                        {(isLoggedIn && userProf?.avatar && agent) ? (
                            <Avatar src={userProf.avatar} radius="xl" size={20} />
                        ) : (
                            <Users stroke="currentColor" strokeWidth={1.5} size={20} />
                        )}
                    </ActionIcon>
                </Menu.Target>

                {isLoggedIn ?
                    <Menu.Dropdown>
                        <Menu.Label>User</Menu.Label>
                        <Menu.Item leftSection="@" disabled={true}>
                            {userProf?.handle || did}
                        </Menu.Item>
                        <Menu.Label>Menu</Menu.Label>
                        <Menu.Item component={Link} href="/settings" leftSection={<Settings size={18} />}>
                            {locale.Menu_Settings}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item leftSection={<LogOut size={18} />} onClick={() => setLogoutModalOpened(true)} color='red'>
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

            <LogoutModal
                opened={logoutModalOpened}
                onClose={() => setLogoutModalOpened(false)}
            />
        </>
    );
}
