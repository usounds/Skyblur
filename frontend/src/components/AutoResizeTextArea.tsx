
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

    // Scroll states for custom scrollbar indicator
    const [scrollState, setScrollState] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

    const updateSelectionState = useCallback(() => {
        const textarea = textareaRef.current;
        setHasSelection(!!textarea && textarea.selectionStart !== textarea.selectionEnd);
    }, []);

    const adjustHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto"; // 高さをリセット
            const scrollHeight = textarea.scrollHeight;
            // 最大高さを400pxに制限
            if (scrollHeight > 400) {
                textarea.style.height = "400px";
                textarea.style.overflowY = "auto";
            } else {
                textarea.style.height = `${scrollHeight}px`;
                textarea.style.overflowY = "hidden";
            }
        }
    }, []);

    const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
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

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        setScrollState({
            scrollTop: target.scrollTop,
            scrollHeight: target.scrollHeight,
            clientHeight: target.clientHeight,
        });
    };

    const updateScrollState = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            setScrollState({
                scrollTop: textarea.scrollTop,
                scrollHeight: textarea.scrollHeight,
                clientHeight: textarea.clientHeight,
            });
        }
    }, []);

    // Sync scroll state on text changes
    useEffect(() => {
        adjustHeight();
        updateScrollState();
    }, [text, adjustHeight, updateScrollState]);

    // Observe changes in textarea size
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const observer = new ResizeObserver(() => {
            updateScrollState();
        });
        observer.observe(textarea);
        return () => observer.disconnect();
    }, [updateScrollState]);

    useEffect(() => {
        const handleSelectionChange = () => {
            if (document.activeElement === textareaRef.current) {
                updateSelectionState();
            }
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [updateSelectionState]);

    // Handle dragging the custom scrollbar thumb
    const handleMouseDown = (
        e: React.MouseEvent<HTMLDivElement>
    ) => {
        e.preventDefault();
        const startY = e.clientY;
        const ref = textareaRef;
        const trackH = trackHeight;
        const thumbH = thumbHeight;
        const startScrollTop = ref.current ? ref.current.scrollTop : 0;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!ref.current) return;
            const deltaY = moveEvent.clientY - startY;
            const scrollableTrackHeight = trackH - thumbH;
            if (scrollableTrackHeight <= 0) return;
            
            const scrollableContentHeight = ref.current.scrollHeight - ref.current.clientHeight;
            const scrollDelta = (deltaY / scrollableTrackHeight) * scrollableContentHeight;
            ref.current.scrollTop = startScrollTop + scrollDelta;
            
            updateScrollState();
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Calculate dimensions for custom scrollbar
    const showScroll = scrollState.scrollHeight > scrollState.clientHeight;
    const trackHeight = scrollState.clientHeight - 8;
    const thumbHeight = scrollState.clientHeight > 0 
        ? Math.max(24, (scrollState.clientHeight / scrollState.scrollHeight) * trackHeight)
        : 24;
    const maxScrollTop = scrollState.scrollHeight - scrollState.clientHeight;
    const thumbTop = maxScrollTop > 0
        ? (scrollState.scrollTop / maxScrollTop) * (trackHeight - thumbHeight) + 4
        : 4;

    return (
        <div className="mt-2">
            <div className={classes.wrapper}>
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
                    onScroll={handleScroll}
                    disabled={disabled}
                    placeholder={placeHolder}
                    styles={{
                        input: {
                            fontSize: 16,
                            paddingRight: !disabled ? '16px' : undefined,
                        },
                    }}
                    classNames={{ input: classes.input }}
                    maxLength={max}
                    minRows={2}
                />
                {showScroll && (
                    <div className={classes.scrollTrack}>
                        <div
                            className={classes.scrollThumb}
                            style={{
                                top: `${thumbTop}px`,
                                height: `${thumbHeight}px`
                            }}
                            onMouseDown={handleMouseDown}
                        />
                    </div>
                )}
            </div>
            {!disabled && (
                <div className={classes.footerInfo}>
                    <Text size="sm" c="dimmed">
                        {text.length.toLocaleString()}/{max.toLocaleString()}
                    </Text>
                </div>
            )}
            {error && <Text size="sm" c="red" mt={4}>{error}</Text>}
            {isEnableBrackets &&
                <div className={classes.bracketActions}>
                    <Button size="large" onClick={handleAddBrackets} disabled={text.length === 0}>
                        {locale.CreatePost_AddBrackets}
                    </Button>
                </div>
            }
        </div>
    );
};

export default AutoResizeTextArea;
