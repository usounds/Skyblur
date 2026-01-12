"use client"
import { useLocale } from "@/state/Locale";
import Link from 'next/link';
import { Button } from '@mantine/core';
import React from 'react';
import { SquareArrowOutUpRight } from 'lucide-react';
import { Clipboard } from 'lucide-react';

interface URLCopyButtonProps {
    url: string;
}

const URLCopyButton: React.FC<URLCopyButtonProps> = ({ url }) => {
    const { localeData: locale } = useLocale();
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
                        leftSection={<SquareArrowOutUpRight size={14} />}

                    >
                        {locale.Menu_GoSite}
                    </Button>
                </Link>
                <Button
                    variant="outline"
                    color="gray"
                    leftSection={<Clipboard size={14} />}
                    onClick={handleCopy}
                >
                    {locale.Menu_URLCopy}
                </Button>
            </div>
        </>

    );
};

export default URLCopyButton;
