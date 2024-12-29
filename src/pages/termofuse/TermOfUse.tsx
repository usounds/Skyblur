"use client"
export const runtime = 'edge';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CssBaseline from '@mui/material/CssBaseline';

export default function TermOfUse() {

    return (
        <>
            <CssBaseline enableColorScheme />
            <Stack
                component="main"
                direction="column"
                sx={[
                    {
                        justifyContent: 'center',  // Vertical centering
                        alignItems: 'center',      // Horizontal centering
                        minHeight: '100%',
                        height: 'calc((1 - var(--template-frame-height, 0)) * 100%)',
                        position: 'relative',      // for absolute positioning of pseudo-element
                        marginTop: 4,
                        '&::before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            zIndex: -1,
                            inset: 0,
                        },
                    }
                ]}
            >
                <Stack
                    sx={{
                        minWidth: '0',
                        width: {
                            xs: '100%',
                            sm: '600px',
                            md: '720px',
                        },
                    }}
                    spacing={2} // 子要素間のギャップを設定（例: 2 = 8px）
                >
                    <Typography variant="h2">利用規約</Typography>
                    <Typography >
                        Skyblur（以下，「本サイト」といいます。）は、以下のとおりプライバシーポリシー並びに利用規約を定めます。
                    </Typography>

                    <Typography variant="h2">個人情報の収集・利用</Typography>
                    <Typography >
                        本サイトは、サービスの提供のために当サイト利用者（以下利用者）から、個人情報を収集しません。
                    </Typography>

                    <Typography variant="h2">アクセス解析ツールについて</Typography>
                    <Typography >
                        当サイトでは、Cloudflareによるアクセス解析ツール「Web Analytics」を利用しています。 このトラフィックデータは匿名で収集されており、利用者の個人を特定するものではありません。

                    </Typography>

                    <Typography variant="h2">利用規約</Typography>
                    <Typography >
                        投稿はすべてBlueskyのPDSに保存されます。削除を希望される場合は、ご自身で本サイトの削除機能を使用してください。現在のBlueskyでは、他人のPDSの情報は他人から削除することはできません。どこからかクレームが来た場合は速やかにご自身にて削除をお願いします。また、BlueskyのPDSの情報は全て公開情報となりますので、Skyblurを何かを隠匿する目的では使用できません。

                    </Typography>
                    <Typography >
                        それ以外はBluesky、または、PDSの利用規約に準じます。
                    </Typography>
                    <Typography >
                        運営者の判断で投稿を本サイトから非表示にする場合がありますが、データは全てPDSに保存されたままとなります。その場合はご自身でデータを救出してください。（その場合であっても一切のサポートは致しません）
                    </Typography>
                    <Typography >
                        個人運営のため、急にサービスを停止する場合があります。また、不具合等については可能な限り対応を検討しますが、お約束をするものではありません。
                    </Typography>
                    <Typography >
                        運営者の判断で投稿を本サイトから非表示にする場合がありますが、データは全てPDSに保存されたままとなります。その場合はご自身でデータを救出してください。（その場合であっても一切のサポートは致しません）
                    </Typography>

                    <div className="container px-6 pt-4 pb-10 mx-auto">
                        <h2 className="text-2xl font-semibold text-gray-800 capitalize lg:text-3xl">運営者情報</h2>
                        <p className="mt-4 text-gray-500 xl:mt-6">
                            当サイトはゆー(<a href='https://bsky.app/profile/usounds.work' target="_blank">@usounds.work)</a>によって開発・運営されています。
                        </p>
                    </div>

                </Stack>
            </Stack>
        </>
    );
}
