import { configureOAuth } from '@atcute/oauth-browser-client';
import { XRPC } from '@atcute/client';
import { OAuthUserAgent, finalizeAuthorization } from '@atcute/oauth-browser-client';
import { useEffect } from 'react';
import { useXrpcStore } from '../../state/Xrpc';
import { useNavigate } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import { useLocaleStore } from "../../state/Locale";
import Typography from '@mui/material/Typography';

const OauthCallBack = () => {
    const setBlueskyLoginMessage = useXrpcStore((state) => state.setBlueskyLoginMessage);
    const setUserProf = useXrpcStore((state) => state.setUserProf);
    const setLoginXrpc = useXrpcStore((state) => state.setLoginXrpc);
    const setDid = useXrpcStore((state) => state.setDid);
    const setIsLoginProcess = useXrpcStore((state) => state.setIsLoginProcess);
    const isLoginProcess = useXrpcStore((state) => state.isLoginProcess);
    const navigate = useNavigate();
    const locale = useLocaleStore((state) => state.localeData);

    useEffect(() => {
        if(isLoginProcess) return
        setBlueskyLoginMessage('')
        setIsLoginProcess(true)
        const params = new URLSearchParams(location.hash.slice(1));
        console.log(params.size)
        if (params.size === 4) {
            setBlueskyLoginMessage('Negative Navigation')
            console.log(params)
            navigate('/login');
            return
        }
        console.log('isAuth')

        // 非同期関数をuseEffect内に定義
        const fetchData = async () => {
            console.log('isAuth2')

            configureOAuth({
                metadata: {
                    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
                    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
                },
            });

            try {
                // this is optional, but after retrieving the parameters, we should ideally
                // scrub it from history to prevent this authorization state to be replayed,
                // just for good measure.
                history.replaceState(null, '', location.pathname + location.search);

                // you'd be given a session object that you can then pass to OAuthUserAgent!
                const session = await finalizeAuthorization(params);

                // now you can start making requests!
                const agent = new OAuthUserAgent(session);

                if (agent) {
                    const xrpc = new XRPC({ handler: agent });

                    setLoginXrpc(xrpc)

                    const ret = await xrpc.get("app.bsky.actor.getProfile", { params: { actor: agent.sub } })
                    setUserProf(ret.data)
                    setDid(agent.sub)
                    setIsLoginProcess(false)

                    navigate('/');

                }
            } catch (e) {
                setIsLoginProcess(false)
                setBlueskyLoginMessage(''+e)

            }
        };

        // 非同期関数を即座に呼び出し
        fetchData();
    }, []); // 空の依存配列を使用して、コンポーネントのマウント時にのみ実行

    return (
        <>
            <CssBaseline enableColorScheme />
            <Stack
                component="main"
                direction="column"
                sx={[
                    {
                        justifyContent: 'top', // 垂直方向のセンタリング
                        alignItems: 'center', // 水平方向のセンタリング
                        height: 'calc((1 - var(--template-frame-height, 0)) * 100%)',
                        minHeight: '100vh', // vhを使ってビュー全体の高さに対応付け
                        position: 'relative', // 擬似要素の絶対配置のために相対位置付けを行う
                        '&::before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            zIndex: -1,
                            inset: 0,
                        },
                        marginTop: 4,
                    }
                ]}
            >
                <CircularProgress color="inherit" />
                <Typography>{locale.Home_inAuthProgress}</Typography>
            </Stack>
        </>
    );
}

export default OauthCallBack;