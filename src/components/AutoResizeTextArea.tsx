import { useState, useRef, useEffect } from "react";

type AutoResizeTextAreaProps = {
    text: string;
    setPostText: (value: string) => void;
    disabled: boolean;
    locale: any;
    placeHolder: string;
    max:number
};

const AutoResizeTextArea: React.FC<AutoResizeTextAreaProps> = ({
    text,
    setPostText,
    disabled,
    locale,
    placeHolder,
    max
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto"; // 高さをリセット
            textarea.style.height = `${textarea.scrollHeight}px`; // 内容に応じた高さを設定
        }
        setPostText(event.target.value);
    };

    // textが更新されるたびに高さ調整とsetPostTextを呼び出す
    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.style.height = "auto"; // 高さをリセット
            textarea.style.height = `${textarea.scrollHeight}px`; // 内容に応じた高さを設定
        }
    }, [text]); // textが変更されるたびに呼び出される

    return (
        <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            disabled={disabled}
            className="border bg-gray-50 text-gray-800 m-2 py-3 px-4 block w-full border-gray-200 rounded-lg text-sm focus:border-gray-500 focus:ring-gray-500 "
            placeholder={placeHolder}
            style={{ overflow: "hidden", resize: "none", fontSize: "16px" }}  // フォントサイズを調整
            maxLength={max} // 文字数を10000に制限
        ></textarea>
    );
};

export default AutoResizeTextArea;
