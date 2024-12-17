import { useRef, useEffect } from "react";
import { ErrorCallout } from 'reablocks';
import { Button,Textarea } from 'reablocks';

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


    return (
        <div className="space-y-2">
            <Textarea fullWidth value={text} onChange={handleTextChange} disabled={disabled} size="medium"placeholder={placeHolder}maxLength={max} error={error?true:false} />
            {error && <ErrorCallout text={error} variant="error" />}
            {!disabled && <div className="block text-sm text-gray-600 mt-1">{text.length}/{max}</div>}
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
