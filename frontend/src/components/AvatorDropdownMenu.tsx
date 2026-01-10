"use client"
import { useLocaleStore } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { OAuthUserAgent, deleteStoredSession, getSession } from '@atcute/oauth-browser-client';
import { Avatar, Menu, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { Settings } from 'lucide-react';
import { Users } from 'lucide-react';
import { AuthenticationTitle } from './login/Login';

export function AvatorDropdownMenu() {
    const agent = useXrpcAgentStore(state => state.agent);
    const locale = useLocaleStore(state => state.localeData);
    const userProf = useXrpcAgentStore(state => state.userProf);
    const setDid = useXrpcAgentStore(state => state.setDid);
    const did = useXrpcAgentStore(state => state.did);
    const setIsLoginProcess = useXrpcAgentStore(state => state.setIsLoginProcess);
    const setAgent = useXrpcAgentStore(state => state.setAgent);
    const isLoginModalOpened = useXrpcAgentStore(state => state.isLoginModalOpened);
    const setIsLoginModalOpened = useXrpcAgentStore(state => state.setIsLoginModalOpened);
    const router = useRouter();

    const logout = async () => {
        notifications.show({
            id: 'Delete-process',
            title: locale.Menu_Logout,
            message: locale.Menu_LogoutProgress,
            loading: true,
            autoClose: false
        });
        try {

            const session = await getSession(did as `did:${string}:${string}`, { allowStale: true });
            const agent = new OAuthUserAgent(session);

            await agent.signOut();

            setDid('');
            setIsLoginProcess(false);
            setAgent(null);

        } catch {
            deleteStoredSession(did as `did:${string}:${string}`);

            setAgent(null);
            setDid('');
            setIsLoginProcess(false);

        }
        notifications.clean()
        window.localStorage.removeItem('oauth.did');
    };

    const login = async () => {
        setIsLoginModalOpened(true);
    }

    const handleSettings = async () => {
        const params = new URLSearchParams(window.location.search);
        const lang = params.get('lang') || 'ja';
        setTimeout(() => {
            router.push(`/settings?lang=${lang}`);
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

            <Modal opened={isLoginModalOpened} onClose={() => setIsLoginModalOpened(false)} centered radius="md" size={340} title={locale.Login_Login}>
                <AuthenticationTitle isModal={true} />
            </Modal>
        </Menu>
    );
}