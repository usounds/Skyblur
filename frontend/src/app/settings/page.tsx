"use client"
import dynamic from 'next/dynamic';

// Settings をクライアントでのみロード
const Settings = dynamic(() => import('./main'), { ssr: false });

export default function Home() {
  return (
    <>
      <Settings />
    </>
  );
}