import Step1 from '@/pages/create/Step1';
import Step2 from '@/pages/create/Step2';
import { useLocaleStore } from "@/state/Locale";
import { useTempPostStore } from "@/state/TempPost";
import { useXrpcStore } from "@/state/Xrpc";
import { MatchInfo } from "@/type/types";
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import Content from '../login/Content';
import AppTheme from '../shared-theme/AppTheme';
import { MENTION_REGEX,TAG_REGEX,TRAILING_PUNCTUATION_REGEX } from "@/type/regex";
import BlueskySession from '@/component/BlueskySession';

export default function CreatePost(props: { disableCustomTheme?: boolean }) {
    const [activeStep, setActiveStep] = React.useState(0);
    const locale = useLocaleStore((state) => state.localeData);
    const [warning, setWarning] = useState("");
    const steps = [locale.CreatePost_Post, locale.CreatePost_PreviewStep];
    const text = useTempPostStore((state) => state.text);
    const simpleMode = useTempPostStore((state) => state.simpleMode);
    const setBlurredText = useTempPostStore((state) => state.setBlurredText);
    const setMention = useTempPostStore((state) => state.setMention);
    const setHashtag = useTempPostStore((state) => state.setHashtag);
    const apiXrpc = useXrpcStore((state) => state.apiXrpc);
    const [isLoading, setIsLoading] = React.useState(false);

    const navigate = useNavigate();

    function getStepContent(step: number) {
        switch (step) {
            case 0:
                return <Step1 setWarning={setWarning} warning={warning} />;
            case 1:
                return <Step2 />;
            case 2:
                return <Content />;
            default:
                throw new Error('Unknown step');
        }
    }

    async function detectMention(str: string): Promise<MatchInfo[]> {
        if (!apiXrpc) return []
        const matches: MatchInfo[] = [];
        let match: RegExpExecArray | null;

        while ((match = MENTION_REGEX.exec(str)) !== null) {
            try {
                const handle = match[0].trim()
                console.log(handle)
                const result = await apiXrpc.get("app.bsky.actor.getProfile", { params: { actor: handle.slice(1) } })

                matches.push({
                    detectedString: match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    key: result.data.did
                });
            } catch (e) {
                console.error(e)

            }
        }

        return matches;
    }

    async function detectHashtag(str: string): Promise<MatchInfo[]> {
        const matches: MatchInfo[] = [];
        let match: RegExpExecArray | null;

        while ((match = TAG_REGEX.exec(str)) !== null) {
            try {
                const hashtag = match[0].trim().replace(TRAILING_PUNCTUATION_REGEX, '')
                if (hashtag.length === 0 || hashtag.length > 64) continue

                matches.push({
                    detectedString: hashtag,
                    startIndex: match.index,
                    endIndex: match.index +hashtag.length,
                    key: hashtag.slice(1)
                });
            } catch (e) {
                console.error(e)

            }
        }

        return matches;
    }

    const handleNext = async () => {
        if (!warning) {
            if (activeStep === 0) {
                if (!text) return
                setIsLoading(true);
                let newBlurredText = text;
                if (simpleMode) {
                    const lines = text.split('\n');
                    // 行数が2行以上の場合にのみ処理を実行
                    if (lines.length > 1) {
                        newBlurredText = lines.map((line, index, lines) => {
                            // 2行目の最初に "[" を追加
                            if (index === 1) {
                                line = `[${line}`;
                            }
                            // 最後の行に "]" を追加
                            if (index === lines.length - 1) {
                                line = `${line}]`;
                            }
                            return line;
                        }).join('\n');
                    }
                }

                newBlurredText = newBlurredText.replace(/\[(.*?)\]/gs, (_, match) => {
                    // マッチした文字列内の改行を維持しつつ ommitChar で置換
                    return match.replace(/./g, locale.CreatePost_OmmitChar);
                });

                setBlurredText(newBlurredText);
                const mentions = await detectMention(newBlurredText);
                console.log(mentions)
                setMention(mentions);
                const hashtags = await detectHashtag(newBlurredText);
                setHashtag(hashtags)
                setIsLoading(false);
            }
            setActiveStep(activeStep + 1);
        }
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
                        maxWidth: { sm: '100%', md: 720 },
                        width: {
                            xs: '100%',
                            sm: '620px',
                            md: '720px',
                        },
                        alignItems: 'start',
                        pt: { xs: 0, sm: 2 },
                        gap: { xs: 3, md: 3 },
                        marginX: { xs: 2, sm: 0 },
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center', // 子要素である内側のBoxを中央揃えにする
                            alignItems: 'center',
                            width: '100%',
                            maxWidth: { sm: '100%', md: 720 },
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
                                        sx={{ '.MuiStepLabel-labelContainer': { maxWidth: '120px' } }}
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
                                    <Button
                                        startIcon={<ChevronLeftRoundedIcon />}
                                        onClick={handleBack}
                                        variant="text"
                                        sx={{ display: { xs: 'none', sm: 'flex' } }}
                                    >
                                        {locale.Menu_Back}
                                    </Button>
                                    <Button
                                        startIcon={<ChevronLeftRoundedIcon />}
                                        onClick={handleBack}
                                        variant="outlined"
                                        fullWidth
                                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                                    >
                                        {locale.Menu_Back}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        endIcon={<ChevronRightRoundedIcon />}
                                        onClick={handleNext}
                                        disabled={isLoading}
                                        sx={{ width: { xs: '100%', sm: 'fit-content' } }}
                                    >
                                        {activeStep === 0 && locale.CreatePost_PreviewStep}
                                        {activeStep === 1 && locale.CreatePost_CreateButton}
                                    </Button>
                                </Box>
                            </React.Fragment>
                        )}
                    </Box>
                </Grid>
            </Grid>
            <BlueskySession />
        </AppTheme>
    );
}