import { useLocaleStore } from "@/state/Locale";
import { MODAL_TIME } from "@/types/types";
import { Button, Dialog, PartialReablocksTheme, ThemeProvider, extendTheme, theme } from 'reablocks';
import React, { useState } from "react";

interface DeleteModalProp {
  content: string;
  onConfirm: () => void;
  onClose: (isDeleted : boolean) => void;
}

export const DeleteModal: React.FC<DeleteModalProp> = ({ content, onConfirm, onClose }) => {
  const [open, setOpen] = useState<boolean>(true)
  const [isDeletesing, setIsDeletesing] = useState<boolean>(false)

  const customTheme: PartialReablocksTheme = {
    components: {
      dialog: {
        base: theme.components.dialog.base + " text-gray-800",
        inner:"flex flex-col box-border outline-0 pointer-events-auto overflow-auto  max-w-screen-md bg-panel text-text-primary border border-panel-accent rounded shadow-2xl ",
        header: {
          text: theme.components.dialog.header.text + ' text-gray-800 text-xl ',
        },
      },
      button: {
        base:"inline-flex whitespace-no-wrap select-none items-center justify-center px-2.5 py-1 rounded-lg font-sans text-text-primary font-semibold",
    },
    },
  };

  const locale = useLocaleStore((state) => state.localeData);

  const handleSubmit = async () => {
    setIsDeletesing(true)
    await onConfirm();
    handleClose(true)
  };
  const handleClose = (isDeleted:boolean) => {
    setOpen(false);
    setTimeout(() => {
      onClose(isDeleted);
    }, MODAL_TIME);
  };

  const handleJustClose = () => {
    handleClose(false)

  }

  return (
    <ThemeProvider theme={extendTheme(theme, customTheme)}>
      <Dialog open={open} onClose={handleJustClose} header={locale.DeleteList_ConfirmDelete} size="90%" >
        {() => (
          <>
            <div className="mb-6 text-gray-700">{content.replace(/\[|\]/g, '')}</div>
            <footer className="flex justify-end space-x-4">
              <Button
                disabled={isDeletesing}
                className="px-4 py-2 text-white font-normal"
                onClick={() => {
                  handleSubmit()
                }}
                color="error"
              >
                {locale.DeleteList_DeleteButton}
              </Button>
              <Button
                className="px-4 py-2 text-gray-700 border-gray-400 font-normal"
                onClick={() => {
                  handleJustClose()
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
