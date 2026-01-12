"use client";
import { AvatorDropdownMenu } from '@/components/AvatorDropdownMenu';
import LanguageToggle from '@/components/LanguageToggle';
import { SwitchColorMode } from '@/components/switchColorMode/SwitchColorMode';
import en from "@/locales/en";
import ja from "@/locales/ja";
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";

const DynamicHeader = () => {
  const { locale: currentLocale, localeData: locale } = useLocale();
  const agent = useXrpcAgentStore(state => state.agent);
  const did = useXrpcAgentStore(state => state.did);
  const setDid = useXrpcAgentStore(state => state.setDid);
  const setServiceUrl = useXrpcAgentStore(state => state.setServiceUrl);
  const userProf = useXrpcAgentStore((state) => state.userProf);
  const setUserProf = useXrpcAgentStore((state) => state.setUserProf);
  const [isMounted, setIsMounted] = useState(false);
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const loginError = searchParams.get('loginError');
  const setIsLoginModalOpened = useXrpcAgentStore(state => state.setIsLoginModalOpened);
  const setIsSessionChecked = useXrpcAgentStore(state => state.setIsSessionChecked);

  useEffect(() => {
    setIsMounted(true);

    // セッションを確認
    const syncSession = async () => {
      await useXrpcAgentStore.getState().checkSession();
    };
    syncSession();
  }, []);


  // loginError がある場合にログインモーダルを開く
  useEffect(() => {
    if (loginError && isMounted && langParam) {
      setIsLoginModalOpened(true);
    }
  }, [loginError, isMounted, langParam, setIsLoginModalOpened]);

  const apiProxyAgent = useXrpcAgentStore((state) => state.apiProxyAgent);
  const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);

  // プロフィールフェッチ
  useEffect(() => {
    if (did && isSessionChecked) {
      useXrpcAgentStore.getState().fetchUserProf();
    }
  }, [did, isSessionChecked]);

  if (!isMounted) return null;

  // lang パラメータがあるのにまだ適用されていない場合…は不要になったのでブロック自体削除
  // if (langParam && !rehydrated) return null;

  return (
    <div className="flex flex-row items-center gap-3 sm:mt-0">
      <Link href="/termofuse" className="flex-none text-sm mr-2">
        {locale?.Menu_TermOfUse}
      </Link>
      {did && <AvatorDropdownMenu />}
      <LanguageToggle />
      <SwitchColorMode />
    </div>
  );
};

export default DynamicHeader;
