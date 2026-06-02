"use client";
import { Divider } from '@mantine/core';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useState } from 'react';
import { useLocaleStore } from '@/state/Locale';
import type { Locales } from '@/state/Locale';
import { getLocalizedHref } from '@/logic/localePath';

// SSRを無効にしてクライアントでのみロード
const DynamicHeader = dynamic(() => import('./DynamicHeader'), { ssr: false });

const Header = ({ initialLocale }: { initialLocale: Locales }) => {
  const initLocale = useLocaleStore(state => state.initLocale);
  const storeLocale = useLocaleStore(state => state.locale);
  const [isLocaleHydrated, setIsLocaleHydrated] = useState(false);
  const activeLocale = isLocaleHydrated ? storeLocale : initialLocale;

  useEffect(() => {
    initLocale();
    setIsLocaleHydrated(true);
  }, [initLocale]);
  return (
    <>
      <div
        className="flex flex-wrap w-full text-sm h-11 overflow-hidden items-center"
        style={{
          minHeight: '50px',
          overflow: 'hidden',
        }}
      >
        <nav className="px-4 md:px-8 w-full mx-auto grid grid-cols-[1fr_auto_1fr] items-center h-full">
          <Link href={getLocalizedHref(activeLocale, '')} className="col-start-1 justify-self-start text-xl font-semibold">
            Skyblur
          </Link>
          <DynamicHeader />
        </nav>
      </div>
      <Divider my={0} style={{ width: '100%' }} />
    </>
  );
};

export default Header;
