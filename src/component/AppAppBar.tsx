import LanguageToggle from "@/component/LanguageSwitcher";
import { isDidString } from "@/logic/HandleBluesky";
import ColorModeSelect from '@/pages/shared-theme/ColorModeSelect';
import { useLocaleStore } from "@/state/Locale";
import { useXrpcStore } from '@/state/Xrpc';
import { OAuthUserAgent, deleteStoredSession, getSession } from '@atcute/oauth-browser-client';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import { alpha, styled } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { Link as InnerLink, useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: `calc(${theme.shape.borderRadius}px + 8px)`,
    backdropFilter: 'blur(24px)',
    border: '1px solid',
    borderColor: (theme).palette.divider,
    backgroundColor: alpha(theme.palette.background.default, 0.4),
    boxShadow: (theme).shadows[1],
    padding: '8px 12px',
}));

export default function AppAppBar() {
    const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);
    const [open, setOpen] = React.useState(false);
    const userProf = useXrpcStore((state) => state.userProf);
    const locale = useLocaleStore((state) => state.localeData);
    const did = useXrpcStore((state) => state.did);
    const setUserProf = useXrpcStore((state) => state.setUserProf);
    const setLoginXrpc = useXrpcStore((state) => state.setLoginXrpc);
    const setDid = useXrpcStore((state) => state.setDid);
    const setBlueskyLoginMessage = useXrpcStore((state) => state.setBlueskyLoginMessage);
    const navigate = useNavigate();

    const [openBackDrop, setOpenBackDrop] = React.useState(false);

    const handleBackDropClose = () => {
        setOpenBackDrop(false);
    };
    const handleBackDropOpen = () => {
        setOpenBackDrop(true);
    };



    const toggleDrawer = (newOpen: boolean) => () => {
        setOpen(newOpen);
    };

    const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const handleTermOfUse = () => {
        navigate("/termofuse")
    };


    const logout = async (): Promise<void> => {

        if (!isDidString(did)) return
        try {
            handleCloseUserMenu()
            handleBackDropOpen()

            const session = await getSession(did, { allowStale: true });

            const agent = new OAuthUserAgent(session);
            await agent.signOut();

            setBlueskyLoginMessage('')
            setLoginXrpc(undefined)
            setDid('')
            setUserProf(null)
            handleBackDropClose()
            navigate("/login")


        } catch (e) {
            deleteStoredSession(did)
            console.error(e)
        }

    }

    return (
        <AppBar
            position="fixed"
            enableColorOnDark
            sx={{
                boxShadow: 0,
                bgcolor: 'transparent',
                backgroundImage: 'none',
                mt: 'calc(var(--template-frame-height, 0px) + 28px)',
            }}
        >
            <Backdrop
                sx={(theme) => ({
                    color: '#fff',
                    zIndex: theme.zIndex.modal + 1 // ここでzIndexをモーダルの1つ上に設定
                })}
                open={openBackDrop}
                onClick={handleBackDropClose}
            >
                <CircularProgress color="inherit" />
            </Backdrop>
            <Container maxWidth="lg">
                <StyledToolbar variant="dense" disableGutters>

                    <Box >
                        <InnerLink to={"/"} style={{ textDecoration: 'none' }}>
                            <Button variant="text" color="info">
                                Skyblur
                            </Button>
                        </InnerLink>
                        <InnerLink to="/termofuse" style={{ textDecoration: 'none' }}>
                            <Button
                                variant="text"
                                color="info"
                                onClick={handleTermOfUse}
                                sx={{
                                    display: { xs: 'none', sm: 'inline-block' }, // xs では非表示、それ以外で表示
                                }}
                            >
                                {locale.Menu_TermOfUse}
                            </Button>
                        </InnerLink>
                    </Box>
                    <Box
                        sx={{
                            display: { xs: 'none', md: 'flex' },
                            gap: 1,
                            alignItems: 'center',
                        }}
                    >
                        <LanguageToggle />
                        <ColorModeSelect />
                        {userProf && (
                            <Box sx={{ flexGrow: 0, width: '2.25rem', height: '2.25rem' }}>
                                <IconButton
                                    onClick={handleOpenUserMenu}
                                    sx={{ p: 0, width: '2.25rem', height: '2.25rem', border: 'none' }}
                                >
                                    <Avatar alt={userProf?.handle} src={userProf?.avatar} />
                                </IconButton>
                                <Menu
                                    id="menu-appbar"
                                    anchorEl={anchorElUser}
                                    anchorOrigin={{
                                        vertical: 'top',
                                        horizontal: 'right',
                                    }}
                                    keepMounted
                                    transformOrigin={{
                                        vertical: 'top',
                                        horizontal: 'right',
                                    }}
                                    open={Boolean(anchorElUser)}
                                    onClose={handleCloseUserMenu}
                                    PaperProps={{
                                    }}
                                    sx={{ mt: '45px' }}
                                >
                                    <Stack
                                        direction="row"
                                        sx={{
                                            p: 1,
                                            gap: 1,
                                            alignItems: 'center',
                                            borderColor: 'divider',
                                        }}
                                    >
                                        <Avatar
                                            sizes="small"
                                            src={userProf?.avatar}
                                            sx={{ width: 36, height: 36 }}
                                        />
                                        <Box sx={{ mr: 'auto' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }}>
                                                {userProf.displayName}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                @{userProf.handle}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <MenuItem onClick={logout}>
                                        <LogoutIcon sx={{ marginRight: 1 }} />
                                        <Typography sx={{ textAlign: 'center' }}>{locale.Menu_Logout}</Typography>
                                    </MenuItem>
                                </Menu>
                            </Box>
                        )}
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1 }}>
                        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', px: 0 }}>
                            <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                                <Button variant="text" color="info" sx={{ fontSize: '24px !important' }}>
                                    Skyblur
                                </Button>
                            </Box>
                        </Box>
                        <LanguageToggle />
                        <ColorModeSelect />
                        <IconButton aria-label="Menu button" onClick={toggleDrawer(true)}>
                            <MenuIcon />
                        </IconButton>
                        <Drawer
                            anchor="top"
                            open={open}
                            onClose={toggleDrawer(false)}
                            PaperProps={{
                                sx: {
                                    top: 'var(--template-frame-height, 0px)',
                                },
                            }}
                        >
                            <Box sx={{ p: 2, backgroundColor: 'background.default' }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                    }}
                                >
                                    <IconButton onClick={toggleDrawer(false)}>
                                        <CloseRoundedIcon />
                                    </IconButton>
                                </Box>
                                <Typography sx={{ textAlign: 'center', textTransform: 'lowercase' }} onClick={handleTermOfUse}>{locale.Menu_TermOfUse}</Typography>
                                <Divider sx={{ my: 3 }} />
                                <MenuItem>
                                    {userProf &&
                                        <Box sx={{ flexGrow: 0 }}>
                                            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0, border: 'none' }}>
                                                <Avatar alt={userProf?.handle} src={userProf?.avatar} />
                                            </IconButton>
                                            <Menu
                                                sx={{ mt: '45px' }}
                                                id="menu-appbar"
                                                anchorEl={anchorElUser}
                                                anchorOrigin={{
                                                    vertical: 'top',
                                                    horizontal: 'right',
                                                }}
                                                keepMounted
                                                transformOrigin={{
                                                    vertical: 'top',
                                                    horizontal: 'right',
                                                }}
                                                open={Boolean(anchorElUser)}
                                                onClose={handleCloseUserMenu}
                                            >
                                                <Stack
                                                    direction="row"
                                                    sx={{
                                                        p: 1,
                                                        gap: 1,
                                                        alignItems: 'center',
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    <Avatar
                                                        sizes="small"
                                                        src={userProf?.avatar}
                                                        sx={{ width: 36, height: 36 }}
                                                    />
                                                    <Box sx={{ mr: 'auto' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }}>
                                                            {userProf.displayName}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                            @{userProf.handle}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                                <MenuItem onClick={logout}>
                                                    <LogoutIcon sx={{ marginRight: 1 }} />
                                                    <Typography sx={{ textAlign: 'center' }}>{locale.Menu_Logout}</Typography>
                                                </MenuItem>
                                            </Menu>
                                        </Box>
                                    }
                                </MenuItem>
                            </Box>
                        </Drawer>
                    </Box>
                </StyledToolbar>
            </Container>
        </AppBar>
    );
}