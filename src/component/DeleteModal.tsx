import PostTextWithBold from "@/component/PostTextWithBold";
import { MODAL_TIME } from "@/type/types";
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { grey, red } from '@mui/material/colors';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import * as React from 'react';
import { useLocaleStore } from "../state/Locale";

interface DeleteModalProp {
  title: string;
  execLabel: string;
  content: string;
  onConfirm: () => void;
  onClose: () => void;
}

  export const AlertDialog: React.FC<DeleteModalProp> = ({ title,execLabel, content, onConfirm, onClose }) => {
  const [open, setOpen] = React.useState(true);
  const locale = useLocaleStore((state) => state.localeData);

  const handleClose = () => {
    setOpen(false);

    setTimeout(() => {
      onClose();
    }, MODAL_TIME);
  };

  const theme = createTheme({
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            // デフォルトのスタイル（全てのボタンに適用されます）
          },
          // outlinedバリアントに対するスタイル
          outlined: ({ theme }) => ({
            border: `none`,
            // secondaryカラーのアウトラインボタンに対するスタイルを定義
            '&.MuiButton-outlinedWarning': {
              color: red[500],
              border: `1px solid ${red[300]}`,
              '&:hover': {
                backgroundColor: red[100],
              },
              '&:active': {
                color: "white",
                backgroundColor: red[400],
              },
              ...theme.applyStyles('dark', {
                borderColor: red[700],
                '&:hover': {
                  color: red[600],
                  backgroundColor: grey[800],
                  border: `1px solid ${red[600]}`,
                },
                '&:active': {
                  color: "white",
                  backgroundColor: red[900],
                },
              }),
            },
          })
        },
      },
    },
  });

  return (
    <React.Fragment>
      <ThemeProvider theme={theme}>
        <Dialog
          open={open}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            {title}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              <PostTextWithBold postText={content} isValidateBrackets={true} />
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={handleClose}>{locale.DeleteList_CancelButton}</Button>
            <Button variant="outlined" color="warning"onClick={onConfirm}>
              {execLabel}
            </Button>
          </DialogActions>
        </Dialog>
      </ThemeProvider>
    </React.Fragment>
  );
}


export default AlertDialog;