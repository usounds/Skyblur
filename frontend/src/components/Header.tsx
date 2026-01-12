"use client";
import { Divider } from '@mantine/core';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useLocaleStore } from '@/state/Locale';

// SSRを無効にしてクライアントでのみロード
const DynamicHeader = dynamic(() => import('./DynamicHeader'), { ssr: false });

const Header = () => {
  const initLocale = useLocaleStore(state => state.initLocale);

  useEffect(() => {
    initLocale();
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
        <nav className="px-4 md:px-8 w-full mx-auto flex justify-between items-center flex-row h-full">
          <Link href="/" className="text-xl font-semibold">
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
