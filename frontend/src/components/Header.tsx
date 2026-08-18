"use client";
import { Divider } from '@mantine/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocaleStore } from '@/state/Locale';
import type { Locales } from '@/state/Locale';
import { getLocalizedHref } from '@/logic/localePath';
import DynamicHeader from './DynamicHeader';

const Header = ({ initialLocale }: { initialLocale: Locales }) => {
  const initLocale = useLocaleStore(state => state.initLocale);
  const storeLocale = useLocaleStore(state => state.locale);
  const [isLocaleHydrated, setIsLocaleHydrated] = useState(false);
  const activeLocale = isLocaleHydrated ? storeLocale : initialLocale;

  useEffect(() => {
    initLocale(initialLocale);
    setIsLocaleHydrated(true);
  }, [initLocale, initialLocale]);

  return (
    <>
      <header
        className="w-full text-sm h-[50px] min-h-[50px] max-h-[50px] flex items-center overflow-hidden"
      >
        <nav className="px-4 md:px-8 w-full mx-auto grid grid-cols-[1fr_auto_1fr] items-center h-full">
          <Link href={getLocalizedHref(activeLocale, '')} className="col-start-1 justify-self-start text-xl font-semibold">
            Skyblur
          </Link>
          <DynamicHeader />
        </nav>
      </header>
      <Divider my={0} style={{ width: '100%' }} />
    </>
  );
};

export default Header;
