import { useRef, useEffect } from "react";
import { ErrorCallout } from 'reablocks';
import { Button } from 'reablocks';

type AutoResizeTextAreaProps = {
    text: string;
    setPostText: (value: string) => void;
    disabled: boolean;
    placeHolder: string;
    locale: any;
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
        <div className="space-y-2">
            <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                disabled={disabled}
                className="border bg-gray-50 text-gray-800 m-2 py-3 px-4 block w-full border-gray-200 rounded-lg text-sm focus:border-gray-500 focus:ring-gray-500"
                placeholder={placeHolder}
                style={{ overflow: "hidden", resize: "none", fontSize: "16px" }}
                maxLength={max}
            />
            {!disabled && <div className="block text-sm text-gray-600 mt-1">{text.length}/{max}</div>}
            {error && <ErrorCallout text={error} variant="error" />}
            {isEnableBrackets &&
                <div className="flex justify-center gap-4 mb-8">
                    <Button color="primary" size="large" className="text-white text-base font-normal" onClick={handleAddBrackets} disabled={text.length===0}>
                        {locale.CreatePost_AddBrackets}
                    </Button>
                </div>
            }
        </div>
    );
};

export default AutoResizeTextArea;
