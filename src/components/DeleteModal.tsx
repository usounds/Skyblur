import React, { useState } from "react";
import { Button, Dialog } from 'reablocks';
import { ThemeProvider, PartialReablocksTheme, extendTheme } from 'reablocks';
import { theme } from 'reablocks';
import { useLocaleStore } from "@/state/Locale";

interface DeleteModalProp {
  content: string;
  onConfirm: () => void;
  onClose: () => void;
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
    },
  };

  const locale = useLocaleStore((state) => state.localeData);

  const handleSubmit = async () => {
    setIsDeletesing(true)
    await onConfirm();
    handleClose()
  };
  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <ThemeProvider theme={extendTheme(theme, customTheme)}>
      <Dialog open={open} onClose={handleClose} header={locale.DeleteList_ConfirmDelete} size="90%" >
        {() => (
          <>
            <div className="mb-6 text-black">{content.replace(/\[|\]/g, '')}</div>
            <footer className="flex justify-end space-x-4">
              <Button
                disabled={isDeletesing}
                className="px-4 py-2 text-white"
                onClick={() => {
                  handleSubmit()
                }}
                color="error"
              >
                {locale.DeleteList_DeleteButton}
              </Button>
              <Button
                className="px-4 py-2 text-black"
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
