import en from "@/locales/en";
import { Button, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useRef, useState } from "react";
import classes from './AutoResizeTextArea.module.css';

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
    const [hasSelection, setHasSelection] = useState(false);

    const updateSelectionState = useCallback(() => {
        const textarea = textareaRef.current;
        setHasSelection(!!textarea && textarea.selectionStart !== textarea.selectionEnd);
    }, []);

    const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto"; // 高さをリセット
            textarea.style.height = `${textarea.scrollHeight}px`; // 内容に応じた高さを設定
        }
        setPostText(event.target.value);
        updateSelectionState();
    };

    const handleAddBrackets = () => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start === end) {
            notifications.show({
                title: locale.CreatePost_AddBrackets,
                message: locale.CreatePost_SelectTextForBrackets,
                color: "yellow",
            });
            textarea.focus();
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
        setHasSelection(false);
    };

    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.style.height = "auto"; // 高さをリセット
            textarea.style.height = `${textarea.scrollHeight}px`; // 内容に応じた高さを設定
        }
    }, [text]);

    useEffect(() => {
        const handleSelectionChange = () => {
            if (document.activeElement === textareaRef.current) {
                updateSelectionState();
            }
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [updateSelectionState]);

    return (
        <div className="mt-2">
            <Textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onClick={updateSelectionState}
                onFocus={updateSelectionState}
                onSelect={updateSelectionState}
                onKeyUp={updateSelectionState}
                onMouseUp={updateSelectionState}
                onTouchEnd={updateSelectionState}
                disabled={disabled}
                placeholder={placeHolder}
                styles={{
                    input: {
                        fontSize: 16,
                    },
                }}
                classNames={{ input: classes.input }}
                maxLength={max}
                autosize
                minRows={2}
            />
            {!disabled && <Text size="sm">{text.length}/{max}</Text>}
            {error && <Text size="sm" c="red" mt={4}>{error}</Text>}
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
