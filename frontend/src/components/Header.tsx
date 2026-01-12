"use client";
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { Divider } from '@mantine/core';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// SSRを無効にしてクライアントでのみロード
const DynamicHeader = dynamic(() => import('./DynamicHeader'), { ssr: false });

const Header = () => {
  const did = useXrpcAgentStore(state => state.did);

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
          <Link href={did ? "/console" : "/"} className="text-xl font-semibold">
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
