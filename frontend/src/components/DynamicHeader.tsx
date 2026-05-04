import { AvatorDropdownMenu } from '@/components/AvatorDropdownMenu';
import LanguageToggle from '@/components/LanguageToggle';
import { SwitchColorMode } from '@/components/switchColorMode/SwitchColorMode';
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { notifications } from '@mantine/notifications';
import { Check, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from "react";

const DynamicHeader = () => {
  const { localeData: locale } = useLocale();
  const did = useXrpcAgentStore(state => state.did);
  const userProf = useXrpcAgentStore((state) => state.userProf);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginError = searchParams.get('loginError');
  const setIsLoginModalOpened = useXrpcAgentStore(state => state.setIsLoginModalOpened);
  const sessionSyncStartedRef = useRef(false);
  const checkSessionMessage = locale.Home_CheckSession_Message;
  const checkSessionTitle = locale.Home_CheckSession_Title;
  const checkSessionTimeoutMessage = locale.Home_CheckSession_Timeout_Message;
  const checkSessionTimeoutTitle = locale.Home_CheckSession_Timeout_Title;

  useEffect(() => {
    setIsMounted(true);

    // セッションを確認
    const syncSession = async () => {
      if (sessionSyncStartedRef.current) return;
      sessionSyncStartedRef.current = true;
      if (pathname === '/') return;
      if (useXrpcAgentStore.getState().isSessionChecked) return;

      const id = 'session-check';
      notifications.show({
        id,
        loading: true,
        title: checkSessionTitle,
        message: checkSessionMessage,
        autoClose: false,
        withCloseButton: false,
      });

      const result = await useXrpcAgentStore.getState().checkSession();

      notifications.hide(id);
      if (result.timedOut) {
        notifications.show({
          title: checkSessionTimeoutTitle,
          message: checkSessionTimeoutMessage,
          color: 'yellow',
          icon: <X size={18} />,
        });
      }
    };
    syncSession();
  }, [checkSessionMessage, checkSessionTitle, checkSessionTimeoutMessage, checkSessionTimeoutTitle, pathname]);


  useEffect(() => {
    if (loginError && isMounted) {
      if (loginError === 'rejected') {
        notifications.show({
          title: 'Login',
          message: locale.Login_Rejected,
          color: 'red',
          icon: <X size={18} />,
        });
      }
      setIsLoginModalOpened(true);
    }
  }, [loginError, isMounted, setIsLoginModalOpened, locale.Login_Rejected]);

  const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);

  // プロフィールフェッチは /oauth/session で統合されたため不要になりました
  useEffect(() => {
    // ログイン済みだがプロフィールがない場合のみ保険で取得
    if (did && isSessionChecked && !userProf) {
      useXrpcAgentStore.getState().fetchUserProf();
    }
  }, [did, isSessionChecked, userProf]);

  if (!isMounted) return null;

  // lang パラメータがあるのにまだ適用されていない場合…は不要になったのでブロック自体削除
  // if (langParam && !rehydrated) return null;

  return (
    <>
      <div className="flex flex-row items-center gap-3 sm:mt-0">
        <Link href="/termofuse" className="flex-none text-sm mr-2">
          {locale?.Menu_TermOfUse}
        </Link>
        <AvatorDropdownMenu />
        <LanguageToggle />
        <SwitchColorMode />
      </div>
    </>
  );
};

export default DynamicHeader;
