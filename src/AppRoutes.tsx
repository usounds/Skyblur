import Stack from '@mui/material/Stack';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppAppBar from './component/AppAppBar';
import CreatePost from './pages/create/CreatePost';
import SignInSide from './pages/login/SignInSide';
import AppTheme from './pages/shared-theme/AppTheme';
import TermOfUse from './pages/termofuse/TermOfUse';
//const MyPage = React.lazy(() => import('./pages/mypage/MyPage'));
const OauthCallBack = React.lazy(() => import('./pages/oauth/OauthCallback'));
//const TermOfUse = React.lazy(() => import('./pages/termofuse/termofuse'));
import BlueskySession from './component/BlueskySession';
import MyPage from './pages/mypage/MyPage'
import CssBaseline from '@mui/material/CssBaseline';
//import OauthCallBack from './pages/oauth/OauthCallback'
//const SignInSide = React.lazy(() => import('./pages/login/SignInSide'));
//const CreatePost = lazy(() => import('./pages/create/CreatePost'));
import Footer from "@/component/Footer"

const AppRoutes = () => {
  return (
    <>
      <CssBaseline enableColorScheme />
      <BrowserRouter>
        <Stack
          direction="column"
          component="main"
          sx={{
            mt: 'calc(var(--template-frame-height, 0px) + 28px + 64px)', // AppBarの高さを加える
          }}
        >
          <AppTheme >
            <AppAppBar />
            <BlueskySession />

            <Routes>
              <Route path="/login" element={<SignInSide />} />
              <Route path="/termofuse" element={<TermOfUse />} />
              <Route path="/oauth" element={<OauthCallBack />} />
              <Route path="/" element={<MyPage />} />
              <Route path="/create" element={<CreatePost />} />
            </Routes>
            <Footer />
          </AppTheme >

        </Stack>
      </BrowserRouter>
    </>
  );
}

export default AppRoutes;