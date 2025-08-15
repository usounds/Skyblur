import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { Avatar, Menu } from '@mantine/core';
import {
    IconSettings
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { CiLogout } from "react-icons/ci";
import { RxAvatar } from "react-icons/rx";
import { notifications } from '@mantine/notifications';
import { useLocaleStore } from '@/state/Locale';

export function AvatorDropdownMenu() {
    const agent = useXrpcAgentStore(state => state.agent);
    const locale = useLocaleStore(state => state.localeData);
    const userProf = useXrpcAgentStore(state => state.userProf);
    const setDid = useXrpcAgentStore(state => state.setDid);
    const setIsLoginProcess = useXrpcAgentStore(state => state.setIsLoginProcess);
    const setAgent = useXrpcAgentStore(state => state.setAgent);
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

            await fetch('/api/oauth/logout')

            setDid('');
            setIsLoginProcess(false);
            setAgent(null);

        } catch {

            setAgent(null);
            setDid('');
            setIsLoginProcess(false);

        }
        notifications.clean()
        window.localStorage.removeItem('oauth.did');
        window.localStorage.removeItem('oauth.handle');
        router.push('/');
    };

    const handleSettings = async () => {
        console.log('handleSettings')
        setTimeout(() => {
            router.push('/settings');
        }, 0);
    }

    return (
        <Menu shadow="md" width={200} >
            <Menu.Target>
                {(userProf && agent) ? (
                    userProf.avatar ? (
                        <Avatar src={userProf.avatar} radius="xl" size={30} />
                    ) : (
                        <RxAvatar size={30} />
                    )
                ) : (
                    <RxAvatar size={30} />
                )}
            </Menu.Target>

            {(userProf && agent) &&
                <Menu.Dropdown>
                    <Menu.Label>Menu</Menu.Label>
                    <Menu.Item leftSection={<IconSettings size={18} />} onClick={handleSettings}>
                        {locale.Menu_Settings}
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item leftSection={<CiLogout size={18} />} onClick={logout} color='red'>
                        {locale.Menu_Logout}
                    </Menu.Item>
                </Menu.Dropdown>
            }
        </Menu>
    );
}