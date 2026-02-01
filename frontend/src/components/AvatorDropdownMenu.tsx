"use client"
import { ActionIcon, Avatar, Group, Menu, Text, UnstyledButton, rem, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { LogOut, LogIn, Users, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import classes from './AvatorDropdownMenu.module.css';
import { AuthenticationTitle } from './login/Login';
import { LogoutModal } from './LogoutModal';

export function AvatorDropdownMenu() {
    const agent = useXrpcAgentStore(state => state.agent);
    const { localeData: locale } = useLocale();
    const userProf = useXrpcAgentStore(state => state.userProf);
    const setDid = useXrpcAgentStore(state => state.setDid);
    const did = useXrpcAgentStore(state => state.did);
    const isLoginModalOpened = useXrpcAgentStore(state => state.isLoginModalOpened);
    const setIsLoginModalOpened = useXrpcAgentStore(state => state.setIsLoginModalOpened);
    const router = useRouter();
    const [logoutModalOpened, setLogoutModalOpened] = useState(false);

    const login = async () => {
        setIsLoginModalOpened(true);
    }

    const handleSettings = async () => {
        setTimeout(() => {
            router.push(`/settings`);
        }, 0);
    }

    return (
        <>
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