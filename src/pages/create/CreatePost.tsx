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
import { useLocaleStore } from "@/state/Locale";
import Step1 from '@/pages/create/Step1';
import Step2 from '@/pages/create/Step2';
import { useState } from "react";
import { useTempPostStore } from "@/state/TempPost";
import { MatchInfo } from "@/type/types";
import { useXrpcStore } from '@/state/Xrpc';
import twitterText from 'twitter-text';

export default function CreatePost(props: { disableCustomTheme?: boolean }) {
    const [activeStep, setActiveStep] = React.useState(0);
    const locale = useLocaleStore((state) => state.localeData);
    const [warning, setWarning] = useState("");
    const text = useTempPostStore((state) => state.text);
    const setBlurredText = useTempPostStore((state) => state.setBlurredText);
    const apiXrpc = useXrpcStore((state) => state.apiXrpc);
    const setHashtag = useTempPostStore((state) => state.setHashtag);
    const setMention = useTempPostStore((state) => state.setMention);
    const simpleMode = useTempPostStore((state) => state.simpleMode);

    const steps = [locale.CreatePost_Post, locale.CreatePost_PreviewStep, locale.ReplyList_Reply,];

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


    const detectPatternWithDetails = async (str: string): Promise<MatchInfo[]> => {
        if (!apiXrpc) return [];
        const matches: MatchInfo[] = [];
        const regex = /@[a-z]+(?:\.[a-z]+)+(?=\s|$|[\u3000-\uFFFD])/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(str)) !== null) {
            try {
                const result = await apiXrpc.get("app.bsky.actor.getProfile", { params: { actor: match[0].slice(1) } });

                matches.push({
                    detectedString: match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    did: result.data.did,
                });
            } catch (e) {
                console.error(e);
            }
        }

        return matches;
    };


    const handleNext = async () => {
        if (!text) return
        if (!warning) {
            if(activeStep==0){

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

                const mentions = await detectPatternWithDetails(text);
                console.log(mentions)
                setMention(mentions);
                setHashtag(twitterText.extractHashtagsWithIndices(text))
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
                                        sx={{ width: { xs: '100%', sm: 'fit-content' } }}
                                    >
                                        {activeStep === steps.length - 1 ? 'Place order' : locale.CreatePost_PreviewStep}
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