import * as React from 'react';
import Box from '@mui/material/Box';
import Snackbar, { SnackbarOrigin } from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

interface SnackbarProps {
    message: string;
    open: boolean;
    onClose: () => void;
}

interface State extends SnackbarOrigin {}

export default function PositionedSnackbar(props: SnackbarProps) {
    const [state] = React.useState<State>({
        vertical: 'top',
        horizontal: 'center',
    });
    const { vertical, horizontal } = state;

    return (
        <Box sx={{ width: 500 }}>
            <Snackbar
                anchorOrigin={{ vertical, horizontal }}
                open={props.open}
                onClose={props.onClose}
                autoHideDuration={2000}
                key={vertical + horizontal}
            >
                <Alert severity="success" variant="outlined">
                    {props.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
