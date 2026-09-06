import fs from 'node:fs';
import path from 'node:path';
import en from '@/locales/en';
import ja from '@/locales/ja';
import type { Locales } from '@/state/Locale';

type PageMarkdownResult = {
  markdown: string;
  title: string;
  description: string;
};

const SITE_URL = 'https://skyblur.uk';
const OGP_IMAGE = 'https://skyblur.uk/ogp.png';

function buildFrontmatter(title: string, description: string, image = OGP_IMAGE): string {
  return [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    `image: ${image}`,
    '---',
    '',
  ].join('\n');
}

function generateHomeMarkdown(locale: Locales): PageMarkdownResult {
  const isJa = locale === 'ja';
  const copy = isJa ? ja : en;

  const title = isJa ? 'Skyblur - Bluesky向け伏せ字・公開範囲設定投稿サービス' : 'Skyblur - Masked & Visibility-Restricted Posting for Bluesky';
  const description = copy.Common_OGDescription || copy.Common_Description;

  const frontmatter = buildFrontmatter(title, description);

  const body = isJa
    ? `# Skyblurへようこそ

Skyblur（スカイブラー）は、AT Protocol（atproto）およびBluesky向けの、伏せ字投稿および閲覧権限・公開範囲設定サービスです。

## 主な機能

1. **伏せ字（ネタバレ防止）投稿**
   - 隠したいテキストを \`[秘密だよ]\` のように角括弧で囲んで投稿すると、Bluesky上では「○○○○」に自動変換されます。
   - タイムラインを汚さず、ネタバレやセンシティブな感想を安心して共有できます。

2. **閲覧制限・公開範囲の柔軟な制御**
   - **全体公開 (Public)**: 誰でもSkyblur上で原文を閲覧できます。
   - **ログイン必須 (Login Required)**: Blueskyにログインしているユーザーのみ閲覧できます。
   - **フォロワー限定 (Followers Only)**: あなたをフォローしているユーザーのみ閲覧できます。
   - **フォロー中限定 (Following Only)**: あなたがフォローしているユーザーのみ閲覧できます。
   - **相互フォロー限定 (Mutuals Only)**: 相互フォロー関係にあるユーザーのみ閲覧できます。
   - **Blueskyリスト限定 (List Only)**: 指定したBlueskyリストのメンバーのみ閲覧できます。
   - **パスワード保護 (Password Lock)**: 設定したパスワードを知っている人のみ閲覧できます。

3. **最大10,000文字の「補足」エリア**
   - Blueskyの300文字制限を超えた長文の考察や感想も、Skyblur専用エリアに最大10,000文字まで追記して届けることができます。

4. **安全な認証 (atproto OAuth)**
   - パスワードは預かりません。公式のatproto OAuth規格を使用して安全にログインします。

## リンク
- [機能紹介・詳しい使い方](${SITE_URL}/ja/features)
- [利用規約・プライバシーポリシー](${SITE_URL}/ja/termofuse)
- [LLMs.txt](${SITE_URL}/llms.txt)
`
    : `# Welcome to Skyblur

Skyblur is a web application built for the AT Protocol (atproto) and Bluesky that enables masked spoiler posting, audience visibility restrictions, and extended notes.

## Core Features

1. **Masked (Blur / Spoiler) Posting**
   - Wrap text in brackets \`[like this]\` when posting. On Bluesky, it appears as masked characters (e.g. \`********\`).
   - Readers click the link to read the unmasked text and commentary on Skyblur.

2. **Audience & Visibility Controls**
   - **Public**: Anyone can read the full text.
   - **Login Required**: Only authenticated Bluesky users can view.
   - **Followers Only**: Only your followers can view.
   - **Following Only**: Only accounts you follow can view.
   - **Mutuals Only**: Only mutual followers can view.
   - **List Only**: Only members of a designated Bluesky list can view.
   - **Password Protected**: Only users with the correct passcode can unlock.

3. **Extended Notes up to 10,000 Characters**
   - Add detailed explanations, full essays, or spoiler thoughts beyond Bluesky's standard 300-character limit.

4. **Secure Authentication via atproto OAuth**
   - Skyblur never sees or stores your password. Authentication uses the official atproto OAuth standard.

## Links
- [Features & Usage Guide](${SITE_URL}/en/features)
- [Terms of Use & Privacy Policy](${SITE_URL}/en/termofuse)
- [LLMs.txt](${SITE_URL}/llms.txt)
`;

  return {
    markdown: `${frontmatter}${body}`,
    title,
    description,
  };
}

function generateFeaturesMarkdown(locale: Locales): PageMarkdownResult {
  const isJa = locale === 'ja';
  const title = isJa ? '機能紹介・限定公開の仕組み - Skyblur' : 'Features & Visibility Settings - Skyblur';
  const description = isJa
    ? 'Blueskyでの伏せ字投稿や、フォロワー・リスト・パスワード限定公開など、Skyblurの機能と仕組みを説明します。'
    : 'Learn about Skyblur features, including masked Bluesky posts and visibility settings (followers, lists, passwords).';

  const frontmatter = buildFrontmatter(title, description);

  const body = isJa
    ? `# 機能紹介・限定公開の仕組み

SkyblurはBlueskyへの投稿を伏せ字にして、全文や補足をSkyblur側で表示します。公開範囲を選べるので、全体公開からフォロワー限定、リスト限定、パスワード付きまで、話したい相手に合わせて読ませ方を調整できます。

## 公開範囲一覧

| 公開範囲 | 説明 |
| :--- | :--- |
| **全体公開** | 誰でもSkyblur上で全文と補足を読めます。 |
| **ログイン必須** | Blueskyアカウントでログインしたユーザーのみ読めます。 |
| **フォロワー限定** | あなたのアカウントをフォローしている人だけが読めます。 |
| **フォロー中限定** | あなたがフォローしている人だけが読めます。 |
| **相互フォロー限定** | 相互にフォローし合っている人だけが読めます。 |
| **リスト限定** | 選択したBlueskyリストに含まれるユーザーだけが読めます。 |
| **パスワード保護** | 設定したパスワードを入力した人だけが読めます。 |

## エディタ機能
- **リッチテキスト対応**: ハッシュタグ（#タグ）、メンション（@handle）、URLリンクを入力時に自動検出し、Blueskyのリッチテキストファセットとして正しく投稿します。
- **最大10,000文字の補足**: Blueskyの300文字制限を超えた長文感想や考察をSkyblur専用エリアに追記できます。
- **自動下書き保存**: ブラウザ内に下書きが自動保存され、誤って閉じた場合でも復元できます。

## 投稿の流れ
1. **atproto OAuthで安全にログイン**: パスワードの入力は不要です。
2. **本文と補足を作成**: 伏せたい部分を \`[ ]\` で囲みます。
3. **公開範囲を選択**: 読ませたい相手の条件を指定します。
4. **投稿完了**: Blueskyには伏せ字で投稿され、リンクからSkyblurで全文が読めます。

## よくある質問 (FAQ)
- **Q. Bluesky上ではどのように見えますか？**
  - A. \`[ ]\` で囲んだ部分が「○○○○」に変換され、Skyblurへのリンクが付きます。
- **Q. ログインは安全ですか？**
  - A. atproto公式のOAuth認証を採用しており、Skyblurがパスワードを保持することはありません。
`
    : `# Features & Visibility Settings

Skyblur posts masked text to Bluesky and shows the full text and additional commentary on Skyblur. Visibility settings let you choose the right audience for each post, from public access to followers, selected lists, or password-protected reading.

## Visibility Settings

| Visibility Option | Description |
| :--- | :--- |
| **Public** | Anyone can read the full post and notes on Skyblur. |
| **Login Required** | Only users signed in with a Bluesky account can read. |
| **Followers Only** | Only accounts following you can read. |
| **Following Only** | Only accounts you follow can read. |
| **Mutuals Only** | Only mutual followers can read. |
| **List Only** | Only members of a chosen Bluesky list can read. |
| **Password Protected** | Only readers with the secret password can unlock. |

## Editor Features
- **Rich Text Support**: Hashtags (\`#tag\`), mentions (\`@handle\`), and URLs are automatically recognized as clickable Bluesky facets.
- **10,000-character Notes**: Go beyond the 300-character limit with extended notes displayed only on Skyblur.
- **Draft Recovery**: Your in-progress drafts are saved locally in the browser.

## How It Works
1. **Sign in via atproto OAuth**: Safe and passwordless authentication.
2. **Write your text and notes**: Wrap spoilers in \`[ ]\` brackets.
3. **Select visibility**: Choose who can read the post.
4. **Publish**: The masked text is sent to Bluesky with a link to Skyblur.

## FAQ
- **Q. How does it look on Bluesky?**
  - A. Bracketed text is replaced by \`********\` with a link to read the full text on Skyblur.
- **Q. Is login safe?**
  - A. Yes, authentication uses official atproto OAuth, so your credentials are never exposed to Skyblur.
`;

  return {
    markdown: `${frontmatter}${body}`,
    title,
    description,
  };
}

function generateTermsMarkdown(locale: Locales): PageMarkdownResult {
  const isJa = locale === 'ja';
  const title = isJa ? '利用規約・プライバシーポリシー - Skyblur' : 'Terms of Use & Privacy Policy - Skyblur';
  const description = isJa
    ? 'Skyblurの利用規約およびプライバシーポリシーです。当サービスを利用する上での条件を定義しています。'
    : 'Terms of Use and Privacy Policy for Skyblur, defining the conditions for using our service.';

  const frontmatter = buildFrontmatter(title, description);

  let termsBody = '';
  try {
    const filePath = path.join(process.cwd(), 'src', 'locales', 'terms', `${locale}.md`);
    termsBody = fs.readFileSync(filePath, 'utf-8');
  } catch {
    termsBody = isJa ? '# 利用規約\n\n利用規約を読み込めませんでした。' : '# Terms of Use\n\nFailed to load terms.';
  }

  return {
    markdown: `${frontmatter}${termsBody}`,
    title,
    description,
  };
}

export function generateMarkdownForPath(pathname: string): PageMarkdownResult | null {
  // Normalize path
  const cleanPath = pathname.replace(/\/$/, '') || '/';

  // Determine locale and route
  let locale: Locales = 'ja';
  let route = cleanPath;

  if (cleanPath.startsWith('/en')) {
    locale = 'en';
    route = cleanPath.replace(/^\/en/, '') || '/';
  } else if (cleanPath.startsWith('/ja')) {
    locale = 'ja';
    route = cleanPath.replace(/^\/ja/, '') || '/';
  }

  if (route === '/' || route === '') {
    return generateHomeMarkdown(locale);
  }

  if (route === '/features') {
    return generateFeaturesMarkdown(locale);
  }

  if (route === '/termofuse') {
    return generateTermsMarkdown(locale);
  }

  return null;
}
