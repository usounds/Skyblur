import { useState, useCallback, memo } from "react";
import { Textarea } from '@mantine/core';
import URLCopyButton from "@/components/URLCopyButton";

export interface MyPageSectionProps {
  isUseMyPage: boolean;
  onToggle: (checked: boolean) => void;
  myPageDescription: string;
  onChangeDesc: (v: string) => void;
  urlCopy: string;
}

const MyPageSection = ({
  isUseMyPage,
  onToggle,
  myPageDescription,
  onChangeDesc,
  urlCopy,
}: MyPageSectionProps) => {
  return (
    <>
      <div className="block text-m text-gray-400 mt-1">{/* description label */}</div>
      <Textarea
        value={myPageDescription}
        onChange={(e) => onChangeDesc(e.target.value)}
        maxLength={1000}
      />
      <div className="flex flex-col items-center mt-1">
        <URLCopyButton url={urlCopy} />
      </div>
    </>
  );
};

export default memo(MyPageSection);
