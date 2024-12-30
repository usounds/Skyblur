import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import AppTheme from '../shared-theme/AppTheme';
import Content from '../login/Content';
import { useNavigate } from 'react-router-dom';
import { Link as InnerLink } from 'react-router-dom';

const steps = ['拾いたい単語の設定', '除外したい単語の設定'];
function getStepContent(step: number) {
    switch (step) {
        case 0:
            return <Content />;
        case 1:
            return <Content />;
        case 2:
            return <Content />;
        default:
            throw new Error('Unknown step');
    }
}
export default function CreatePost(props: { disableCustomTheme?: boolean }) {
    const [activeStep, setActiveStep] = React.useState(0);

    const navigate = useNavigate();

    const handleNext = () => {
        setActiveStep(activeStep + 1);
    };
    const handleBack = () => {
        if (activeStep === 0) {
            navigate('/')
        } else {
            setActiveStep(activeStep - 1);
        }
    };
    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />

            <Grid
                container
                justifyContent="center" // 子要素を水平方向に中央揃え
                sx={{
                    mt: {
                        xs: 4,
                        sm: 0,
                    },
                }}
            >
                <Grid
                    size={{ sm: 12, md: 7, lg: 8 }}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        maxWidth: { sm: '100%', md: 800 },
                        width: '100%',
                        alignItems: 'start',
                        pt: { xs: 0, sm: 2 },
                        gap: { xs: 2, md: 2 },
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center', // 子要素である内側のBoxを中央揃えにする
                            alignItems: 'center',
                            width: '100%',
                            maxWidth: { sm: '100%', md: 800 },
                        }}
                    >
                        <Box
                            sx={{
                                display: { xs: 'none', md: 'flex' },
                                flexDirection: 'column',
                                justifyContent: { sm: 'space-between', md: 'flex-end' },
                                alignItems: 'center',
                                maxWidth: { sm: '100%', md: 600 },
                                flexGrow: 1,
                            }}
                        >
                            <Stepper
                                id="desktop-stepper"
                                activeStep={activeStep}
                                sx={{ width: '100%', height: 30 }}
                            >
                                {steps.map((label) => (
                                    <Step
                                        sx={{ ':first-child': { pl: 0 }, ':last-child': { pr: 0 } }}
                                        key={label}
                                    >
                                        <StepLabel>{label}</StepLabel>
                                    </Step>
                                ))}
                            </Stepper>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            flexGrow: 1,
                            width: '100%',
                            maxWidth: { sm: '100%', md: 800 },
                            maxHeight: '720px',
                            gap: { xs: 5, md: 'none' },
                        }}
                    >
                        <Stepper
                            id="mobile-stepper"
                            activeStep={activeStep}
                            alternativeLabel
                            sx={{ display: { sm: 'flex', md: 'none' } }}
                        >
                            {steps.map((label) => (
                                <Step
                                    sx={{
                                        ':first-child': { pl: 0 },
                                        ':last-child': { pr: 0 },
                                        '& .MuiStepConnector-root': { top: { xs: 6, sm: 12 } },
                                    }}
                                    key={label}
                                >
                                    <StepLabel
                                        sx={{ '.MuiStepLabel-labelContainer': { maxWidth: '70px' } }}
                                    >
                                        {label}
                                    </StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                        {activeStep === steps.length ? (
                            <Stack spacing={2} useFlexGap>
                                <Typography variant="h1">📦</Typography>
                                <Typography variant="h5">Thank you for your order!</Typography>
                                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                    Your order number is
                                    <strong>&nbsp;#140396</strong>. We have emailed your order
                                    confirmation and will update you once its shipped.
                                </Typography>
                                <Button
                                    variant="contained"
                                    sx={{ alignSelf: 'start', width: { xs: '100%', sm: 'auto' } }}
                                >
                                    Go to my orders
                                </Button>
                            </Stack>
                        ) : (
                            <React.Fragment>
                                {getStepContent(activeStep)}
                                <Box
                                    sx={[
                                        {
                                            display: 'flex',
                                            flexDirection: { xs: 'column-reverse', sm: 'row' },
                                            alignItems: 'end',
                                            flexGrow: 1,
                                            gap: 1,
                                            pb: { xs: 12, sm: 0 },
                                            mt: { xs: 2, sm: 0 },
                                            mb: '10px',
                                        },
                                        { justifyContent: 'space-between' },
                                    ]}
                                >
                                    <InnerLink to="/"  style={{ textDecoration: 'none' }}>
                                        <Button
                                            startIcon={<ChevronLeftRoundedIcon />}
                                            onClick={handleBack}
                                            variant="text"
                                            sx={{ display: { xs: 'none', sm: 'flex' } }}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            startIcon={<ChevronLeftRoundedIcon />}
                                            onClick={handleBack}
                                            variant="outlined"
                                            fullWidth
                                            sx={{ display: { xs: 'flex', sm: 'none' } }}
                                        >
                                            Previous
                                        </Button>
                                    </InnerLink>
                                    <Button
                                        variant="contained"
                                        endIcon={<ChevronRightRoundedIcon />}
                                        onClick={handleNext}
                                        sx={{ width: { xs: '100%', sm: 'fit-content' } }}
                                    >
                                        {activeStep === steps.length - 1 ? 'Place order' : 'Next'}
                                    </Button>
                                </Box>
                            </React.Fragment>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </AppTheme>
    );
}