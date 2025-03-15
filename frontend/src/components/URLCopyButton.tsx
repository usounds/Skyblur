import React from 'react';
import { LuClipboardCheck } from "react-icons/lu";
import { Button } from 'reablocks';
import { useLocaleStore } from "@/state/Locale";
import { FaRegWindowRestore } from "react-icons/fa6";
import Link from 'next/link';

interface URLCopyButtonProps {
    url: string;
}

const URLCopyButton: React.FC<URLCopyButtonProps> = ({ url }) => {
    const locale = useLocaleStore((state) => state.localeData);
    const handleCopy = () => {
        navigator.clipboard
            .writeText(url)
    };

    return (
        <>
            <div className="flex gap-3 my-2">
                <Link href={url} target="_blank">
                <Button
                    size="small"
                    variant="outline"
                    startAdornment={
                        <FaRegWindowRestore
                            size={26}
                            color="gray"
                        />
                    }
                >
                    {locale.Menu_GoSite}
                </Button>
                </Link>
                <Button
                    size="small"
                    variant="outline"
                    startAdornment={
                        <LuClipboardCheck
                            size={26}
                            color="gray"
                        />
                    }
                    onClick={handleCopy}
                >
                    {locale.Menu_URLCopy}
                </Button>
            </div>
        </>

    );
};

export default URLCopyButton;
