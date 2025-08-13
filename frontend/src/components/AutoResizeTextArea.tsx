import en from "@/locales/en";
import { Alert, Button, Text, Textarea } from '@mantine/core';
import { useEffect, useRef } from "react";

type AutoResizeTextAreaProps = {
    text: string;
    setPostText: (value: string) => void;
    disabled: boolean;
    placeHolder: string;
    locale: typeof en;
    max: number;
    isEnableBrackets: boolean;
    error?: string
};

const AutoResizeTextArea: React.FC<AutoResizeTextAreaProps> = ({
    text,
    setPostText,
    disabled,
    placeHolder,
    locale,
    max,
    isEnableBrackets,
    error
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

    const handleAddBrackets = () => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start === end) {
            return;
        }

        const value = textarea.value;
        const selectedText = value.substring(start, end);
        const updatedText =
            value.substring(0, start) + `[${selectedText}]` + value.substring(end);

        // テキストを更新
        setPostText(updatedText);

        // カーソルの位置を調整
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + selectedText.length + 2;
    };

    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.style.height = "auto"; // 高さをリセット
            textarea.style.height = `${textarea.scrollHeight}px`; // 内容に応じた高さを設定
        }
    }, [text]);

    return (
        <div className="mt-2">
            <Textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                disabled={disabled}
                placeholder={placeHolder}
                styles={{
                    input: {
                        fontSize: 16,
                    },
                }}
                maxLength={max}
                autosize
                minRows={2}
            />
            {!disabled && <Text size="sm">{text.length}/{max}</Text>}
            {error && <Alert variant="light" color="red">{error}</Alert>}
            {isEnableBrackets &&
                <div className="flex justify-center gap-4 mb-8">
                    <Button size="large" onClick={handleAddBrackets} disabled={text.length === 0}>
                        {locale.CreatePost_AddBrackets}
                    </Button>
                </div>
            }
        </div>
    );
};

export default AutoResizeTextArea;
