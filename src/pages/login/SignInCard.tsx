import { configureOAuth, createAuthorizationUrl, resolveFromIdentity } from '@atcute/oauth-browser-client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MuiCard from '@mui/material/Card';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/FormLabel';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import * as React from 'react';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import InputAdornment from '@mui/material/InputAdornment';
import { useLocaleStore } from "../../state/Locale";
import CircularProgress from '@mui/material/CircularProgress';
import { useXrpcStore } from '../../state/Xrpc';
//import { useNavigate } from 'react-router-dom';
import BlueskySession from '@/component/BlueskySession';
import LanguageSelect from "../../component/LanguageSelect"

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  [theme.breakpoints.up('sm')]: {
    width: '450px',
  },
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

export default function SignInCard() {
  const [handleError, setHandleError] = React.useState(false);
  const handleMessage = useXrpcStore((state) => state.blueskyLoginMessage);
  const setHandleMessage = useXrpcStore((state) => state.setBlueskyLoginMessage);
  const locale = useLocaleStore((state) => state.localeData);
  const [blueskyLoginMessage, setBlueskyLoginMessage] = React.useState("");
  const handle = useXrpcStore((state) => state.handle);
  const setHandle = useXrpcStore((state) => state.setHandle);
  const [isAuth, setIsAuth] = React.useState(false);

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // デフォルトのフォーム送信を防ぐ
    event.preventDefault();

    // エラーチェック
    if (handleError) {
      return; // エラーがある場合は処理を中断する
    }

    setIsAuth(true)

    setBlueskyLoginMessage(locale.Login_PDSResolve)
    configureOAuth({
      metadata: {
        client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
        redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
      },
    });

    try {
      // 非同期関数を呼び出す

      const { identity, metadata } = await resolveFromIdentity(handle || '');

      let host = identity.pds.hostname

      if (host.endsWith("bsky.network")) {
        host = "bsky.social";
      }

      setBlueskyLoginMessage(locale.Login_Redirect.replace("{1}", host))

      const authUrl = await createAuthorizationUrl({
        metadata: metadata,
        identity: identity,
        scope: 'atproto transition:generic',
      });

      // recommended to wait for the browser to persist local storage before proceeding
      await sleep(200);

      // redirect the user to sign in and authorize the app
      window.location.assign(authUrl);
    } catch (e) {
      console.error(e)
      setHandleError(true);
      setHandleMessage(locale.Login_InvalidHandle);
      setIsAuth(false)
    }


  };

  const validateInputs = () => {
    const email = document.getElementById('username') as HTMLInputElement;

    let isValid = true;

    if (!email.value) {
      setHandleError(true);
      setHandleMessage('Please input handle.');
      isValid = false;
    } else {
      setHandleError(false);
      setHandleMessage('');
    }


    return isValid;
  };


  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHandle(event.target.value);

    // ここでエラーチェックをして、必要に応じてエラーを設定できます。
    if (event.target.value.includes('@')) {
      setHandleError(true);
      setHandleMessage('ハンドルに@は不要です');

    }else if (!event.target.value.includes('.')) {
      setHandleError(true);
      setHandleMessage('ハンドルはドット(.)が必要です。bsky.socialを忘れていないか確認してください');


    } else {
      setHandleError(false);
      setHandleMessage('');
    }
  };


  return (
    <Card variant="outlined">
      <BlueskySession />
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}
      >

        <FormControl>
          <InputLabel htmlFor="handle">Handle</InputLabel>
          <TextField
            error={handleError}
            helperText={handleMessage}
            id="username"
            type="username"
            name="username"
            placeholder="alice.bsky.social"
            autoComplete="username"
            autoFocus
            required
            fullWidth
            variant="outlined"
            color={handleError ? 'error' : 'primary'}
            value={handle}
            onChange={handleInputChange}


            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AlternateEmailIcon />
                </InputAdornment>
              ),
            }}
          />
        </FormControl>
        <Button
          type="submit"
          fullWidth
          onClick={validateInputs}
          disabled={isAuth}
          color="secondary"
          variant= 'contained'
        >
          {isAuth ?
            <>
              <CircularProgress color="inherit" size={20} sx={{ mr: 1 }} />{blueskyLoginMessage}
            </>
            :
            <>
              <svg
                className="h-5 w-5"
                width="24"
                height="24"
                viewBox="0 0 1452 1452"
                xmlns="http://www.w3.org/2000/svg"
                style={{ marginRight: '8px' }}
              >
                <path
                  d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z"
                  fill="currentColor"
                />
              </svg>
              {locale.Login_Login}
            </>
          }
        </Button>
        <Link
          href="https://bsky.app/"
          variant="body2"
          sx={{ alignSelf: 'center' }}
        >
          <Typography sx={{ textAlign: 'center' }}>
            <span>
              Blueskyのアカウントが必要です
            </span>
          </Typography>
        </Link>
        <FormControl>
          <InputLabel htmlFor="handle">Language</InputLabel>
          <LanguageSelect />
        </FormControl>
      </Box>
    </Card>
  );
}
