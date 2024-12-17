import { useLocaleStore } from "@/state/Locale";
import { MODAL_TIME } from "@/types/types";
import { Button, Dialog, PartialReablocksTheme, ThemeProvider, extendTheme, theme } from 'reablocks';
import React, { useState } from "react";

interface RestoreTempPostModalProp {
    content: string;
    onApply: () => void;
    onDelete: () => void;
    onClose: () => void;
}

export const RestoreTempPost: React.FC<RestoreTempPostModalProp> = ({ content, onApply,onDelete, onClose }) => {
    const [open, setOpen] = useState<boolean>(true)
    const [isDeletesing, setIsDeletesing] = useState<boolean>(false)

    const customTheme: PartialReablocksTheme = {
        components: {
            dialog: {
                base: theme.components.dialog.base + " text-gray-800",
                inner: "flex flex-col box-border outline-0 pointer-events-auto overflow-auto  max-w-screen-md bg-panel text-text-primary border border-panel-accent rounded shadow-2xl ",
                header: {
                    text: theme.components.dialog.header.text + ' text-gray-800 text-xl ',
                },
            },
            button: {
                base: "inline-flex whitespace-no-wrap select-none items-center justify-center px-2.5 py-1 rounded-lg font-sans text-text-primary font-semibold",
            },
        },
    };

    const locale = useLocaleStore((state) => state.localeData);

    const handleApply = async () => {
        setIsDeletesing(true)
        await onApply();
        handleClose()
    };
    const handleDelete = () => {
        onDelete()
        setOpen(false);
        setTimeout(() => {
            onClose();
        }, MODAL_TIME);
    };
    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            onClose();
        }, MODAL_TIME);
    };

    return (
        <ThemeProvider theme={extendTheme(theme, customTheme)}>
            <Dialog open={open} onClose={handleClose} header={locale.CreatePost_RestoreTitle} size="90%" >
                {() => (
                    <>
                        <div className="mb-6 text-black">{content.replace(/\[|\]/g, '')}</div>
                        <footer className="flex justify-end space-x-4">
                            <Button
                                disabled={isDeletesing}
                                className="px-4 py-2 text-white font-normal"
                                onClick={() => {
                                    handleApply()
                                }}
                                color="primary"
                            >
                                {locale.CreatePost_RestoreButton}
                            </Button>
                            <Button
                                className="px-4 py-2 text-white font-normal"
                                onClick={() => {
                                    handleDelete()
                                }}
                                color="error"
                            >
                                {locale.DeleteList_DeleteButton}
                            </Button>
                            <Button
                                className="px-4 py-2 font-normal"
                                onClick={() => {
                                    handleClose()
                                }}
                                variant="outline"
                            >
                                {locale.DeleteList_CancelButton}
                            </Button>
                        </footer>
                    </>
                )}
            </Dialog>
        </ThemeProvider>
    );
};
