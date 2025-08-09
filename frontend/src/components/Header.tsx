import Link from 'next/link';
import DynamicHeader from './DynamicHeader'; // クライアントコンポーネント化した動的部分

const Header = () => {
  return (
    <div className="flex flex-wrap w-full text-sm py-2 bg-neutral-800">
      <nav className="px-4 md:px-8 w-full mx-auto flex justify-between items-center flex-row">
        <Link href="/" className="text-xl font-semibold text-white">
          Skyblur
        </Link>
        <DynamicHeader />
      </nav>
    </div>
  );
};

export default Header;
