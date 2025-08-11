import { useLocaleStore } from "@/state/Locale";
import Link from 'next/link';
import { Button } from '@mantine/core';
import React from 'react';
import { FaRegWindowRestore } from "react-icons/fa6";
import { LuClipboardCheck } from "react-icons/lu";

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
                        variant="outline"
                        color="gray"
                        leftSection={<FaRegWindowRestore size={14} />}

                    >
                        {locale.Menu_GoSite}
                    </Button>
                </Link>
                <Button
                    variant="outline"
                    color="gray"
                    leftSection={<LuClipboardCheck size={14} />}
                    onClick={handleCopy}
                >
                    {locale.Menu_URLCopy}
                </Button>
            </div>
        </>

    );
};

export default URLCopyButton;
