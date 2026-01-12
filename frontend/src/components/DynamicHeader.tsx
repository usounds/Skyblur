import { AvatorDropdownMenu } from '@/components/AvatorDropdownMenu';
import LanguageToggle from '@/components/LanguageToggle';
import { SwitchColorMode } from '@/components/switchColorMode/SwitchColorMode';
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { notifications } from '@mantine/notifications';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";

const DynamicHeader = () => {
  const { localeData: locale } = useLocale();
  const did = useXrpcAgentStore(state => state.did);
  const userProf = useXrpcAgentStore((state) => state.userProf);
  const [isMounted, setIsMounted] = useState(false);
  const searchParams = useSearchParams();
  const loginError = searchParams.get('loginError');
  const setIsLoginModalOpened = useXrpcAgentStore(state => state.setIsLoginModalOpened);

  useEffect(() => {
    setIsMounted(true);

    // セッションを確認
    const syncSession = async () => {
      await useXrpcAgentStore.getState().checkSession();
    };
    syncSession();
  }, []);


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
