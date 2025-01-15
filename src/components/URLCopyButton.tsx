import React from 'react';
import { LuClipboardCheck } from "react-icons/lu";
import { Button } from 'reablocks';
import { useLocaleStore } from "@/state/Locale";

interface URLCopyButtonProps {
    url: string;
}

const URLCopyButton: React.FC<URLCopyButtonProps> = ({url}) => {
  const locale = useLocaleStore((state) => state.localeData);
    const handleCopy = () => {
        navigator.clipboard
            .writeText(url)
    };

    return (
        <Button size="small" variant="outline" startAdornment={
            <LuClipboardCheck
                size={26} color="gray"
            />} onClick={handleCopy}>
            {locale.Menu_URLCopy}
        </Button>
    );
};

export default URLCopyButton;
