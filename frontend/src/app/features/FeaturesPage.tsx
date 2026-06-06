import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { Badge, Container, Group, Text, ThemeIcon, Title } from '@mantine/core';
import { EyeOff, FileText, History, KeyRound, ListChecks, LockKeyhole, LogIn, Pencil, ShieldCheck, Type, UsersRound } from 'lucide-react';
import en from '@/locales/en';
import ja from '@/locales/ja';
import { FeatureActions, FeaturePrimaryAction } from './FeatureActions';
import { ScrollReveal } from './ScrollReveal';
import classes from './FeaturesPage.module.css';
import type { Locales } from '@/state/Locale';

type FeaturePageCopy = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  previewTitle: string;
  previewStatus: string;
  previewPostLabel: string;
  previewPostText: string;
  previewVisibilityLabel: string;
  previewFullText: string;
  previewVisibility: string;
  visibilityTitle: string;
  visibilityLead: string;
  editorTitle: string;
  editorLead: string;
  editorRichTextTitle: string;
  editorRichTextDescription: string;
  editorNoteTitle: string;
  editorNoteDescription: string;
  editorDraftTitle: string;
  editorDraftDescription: string;
  faq1Question: string;
  faq1Answer: string;
  faq2Question: string;
  faq2Answer: string;
  faq3Question: string;
  faq3Answer: string;
  faq4Question: string;
  faq4Answer: string;
  workflowTitle: string;
  workflowLead: string;
  workflowOAuthTitle: string;
  workflowOAuthDescription: string;
  workflowWriteTitle: string;
  workflowWriteDescription: string;
  workflowVisibilityDescription: string;
  workflowPostTitle: string;
  workflowPostDescription: string;
  workflowAction: string;
  seoTitle: string;
  jsonLdDescription: string;
};

const pageCopy: Record<Locales, FeaturePageCopy> = {
  ja: {
    eyebrow: 'Features',
    title: '伏せ字の先に、読める人を選べます。',
    description: 'SkyblurはBlueskyへの投稿を伏せ字にして、全文や補足をSkyblur側で表示します。公開範囲を選べるので、全体公開からフォロワー限定、リスト限定、パスワード付きまで、話したい相手に合わせて読ませ方を調整できます。',
    primaryAction: '投稿してみる',
    secondaryAction: 'トップに戻る',
    previewTitle: '投稿すると、こう見えます',
    previewStatus: 'フォロワー限定',
    previewPostLabel: 'Blueskyに表示される内容',
    previewPostText: 'あの展開、○○○○○○○○○。続きはSkyblurで。',
    previewVisibilityLabel: 'Skyblurで読める内容',
    previewFullText: 'あの展開、犯人は親友だった。続きはSkyblurで。',
    previewVisibility: 'あなたをフォローしている人だけが、伏せた本文と補足を読めます。',
    visibilityTitle: '公開範囲を投稿ごとに選択',
    visibilityLead: 'Blueskyには伏せ字の本文を投稿し、Skyblurでは選んだ条件を満たす人だけが全文と補足を読めます。',
    editorTitle: '快適なエディタ・投稿機能',
    editorLead: 'ハッシュタグやリンク、補足テキストなど、Blueskyへのポストをより便利にする多彩な機能を備えています。',
    editorRichTextTitle: 'リッチテキスト（ハッシュタグ・メンション・リンク）対応',
    editorRichTextDescription: 'ハッシュタグ（#ハッシュタグ）、メンション（@handle）、Webリンク（URL）は入力時に自動検出され、Blueskyと同様にクリック可能なリッチテキスト（リンクやタグ情報）として正しく投稿されます。',
    editorNoteTitle: '最大10,000文字の「補足」テキスト',
    editorNoteDescription: 'Blueskyの300文字制限を超えた長文の考察やネタバレ感想も、Skyblur専用の「補足」エリアに最大10,000文字まで入力して、対象のユーザーだけに安全に届けることができます。',
    editorDraftTitle: '自動下書き復元機能',
    editorDraftDescription: '入力中の内容はブラウザに一時的に自動保存されます。不意の読み込みやブラウザ終了が起きても、作成途中のテキストや設定をワンタップで復元して、途中から書き直せます。',
    faq1Question: 'Skyblurで投稿すると、Bluesky上ではどのように表示されますか？',
    faq1Answer: 'Blueskyのタイムライン上では、本文内の [ ] で囲んだ部分が「○○○○」などの伏せ字に置き換えられたテキストが表示されます。投稿に自動的に挿入されるSkyblurのリンクをタップすることで、全文や追加の補足を安全に閲覧できます。',
    faq2Question: '投稿の公開範囲（閲覧制限）は設定できますか？',
    faq2Answer: 'はい。全体公開に加えて、フォロワー限定、フォロー中限定、相互フォロー限定、作成したBlueskyリスト限定、パスワードによる保護、ログイン必須などの詳細なアクセス制限を投稿ごとに柔軟に設定できます。',
    faq3Question: 'ハッシュタグやメンション、リンクなどのリッチテキストは使えますか？',
    faq3Answer: 'はい。ハッシュタグ（#タグ）やメンション（@handle）、Webリンク（URL）は入力時に自動的に認識され、Blueskyと同様にリッチテキスト（リンクやタグ情報）として正しく機能します。',
    faq4Question: 'ログインの安全性について教えてください。',
    faq4Answer: 'SkyblurはBlueskyのパスワードをお預かりしません。Bluesky/AT Protocol公式が提供する安全な認証規格である「atproto OAuth」を利用して安全にログインいただけます。',
    workflowTitle: '投稿の流れ',
    workflowLead: '伏せたい箇所と読ませたい相手を決めてから投稿します。',
    workflowOAuthTitle: 'atprotoのOAuthでログイン',
    workflowOAuthDescription: 'SkyblurはBlueskyのパスワードを預かりません。atprotoのOAuthで安全にログインして、投稿に必要な権限だけを確認します。',
    workflowWriteTitle: '本文と補足を作る',
    workflowWriteDescription: '伏せたい本文を入力し、必要ならSkyblurだけで読める補足を10000文字まで追加できます。',
    workflowVisibilityDescription: '誰に公開するか、パスワードで保護するかを投稿ごとに選べます。',
    workflowPostTitle: '投稿する',
    workflowPostDescription: 'Blueskyには伏せ字にした本文が投稿され、続きはSkyblurで読めるようになります。',
    workflowAction: 'さあ始めよう',
    seoTitle: '機能紹介・限定公開の仕組み',
    jsonLdDescription: 'Blueskyでの伏せ字投稿や、フォロワー・リスト・パスワード限定公開など、Skyblur의機能と仕組みを説明します。atprotoの仕組みを利用しています。'
  },
  en: {
    eyebrow: 'Features',
    title: 'Choose who can read beyond the blur.',
    description: 'Skyblur posts masked text to Bluesky and shows the full text on Skyblur. Visibility settings let you choose the right audience for each post, from public access to followers, selected lists, or password-protected reading.',
    primaryAction: 'Create a post',
    secondaryAction: 'Back to home',
    previewTitle: 'What people see after posting',
    previewStatus: 'Followers only',
    previewPostLabel: 'Shown on Bluesky',
    previewPostText: 'That twist was ********. Continue on Skyblur.',
    previewVisibilityLabel: 'Readable on Skyblur',
    previewFullText: 'That twist was the friend all along. Continue on Skyblur.',
    previewVisibility: 'Only people who follow you can read the hidden text and note.',
    visibilityTitle: 'Visibility per post',
    visibilityLead: 'Bluesky receives the masked post. Skyblur shows the full text and additional info only to people who match the selected visibility setting.',
    editorTitle: 'Rich Editor & Posting Features',
    editorLead: 'Skyblur includes powerful editor utilities to make writing and formatting your Bluesky posts simple and seamless.',
    editorRichTextTitle: 'Rich Text Support (Hashtags, Mentions, Links)',
    editorRichTextDescription: 'Hashtags (#tag), mentions (@handle), and links (URLs) are automatically recognized as you type and published as clickable rich text facets, preserving the native Bluesky experience.',
    editorNoteTitle: 'Up to 10,000-character Notes',
    editorNoteDescription: 'Go beyond Bluesky\'s 300-character limit. You can add up to 10,000 characters of additional notes and commentary that are safely stored and displayed only on Skyblur to eligible readers.',
    editorDraftTitle: 'Automatic Draft Recovery',
    editorDraftDescription: 'Your work is automatically saved locally as a draft. If you refresh or accidentally close the page, you can easily restore your text and settings to resume exactly where you left off.',
    faq1Question: 'What does a post look like on Bluesky when published via Skyblur?',
    faq1Answer: 'On Bluesky, any text enclosed in brackets [ ] will be replaced with masked characters (e.g., "****"). A link to Skyblur is automatically attached to the post, allowing authorized readers to click and read the full unmasked text on Skyblur.',
    faq2Question: 'What visibility options are available for posts?',
    faq2Answer: 'Skyblur supports extensive visibility settings per post, including public, logged-in users only, password-protected, followers only, following only, mutual followers only, and custom Bluesky list members.',
    faq3Question: 'Does Skyblur support rich text like hashtags, mentions, and links?',
    faq3Answer: 'Yes. Hashtags (#tag), mentions (@handle), and links (URLs) are automatically recognized in your text and published as clickable rich text facets, preserving the native Bluesky experience.',
    faq4Question: 'Is logging into Skyblur safe?',
    faq4Answer: 'Yes. Skyblur does not store or request your Bluesky password. Logging in is handled securely via standard atproto OAuth, granting only the specific permissions required to post.',
    workflowTitle: 'How posting works',
    workflowLead: 'Choose what to hide and who can read it before publishing.',
    workflowOAuthTitle: 'Log in with atproto OAuth',
    workflowOAuthDescription: 'Skyblur does not handle your Bluesky password. Sign in safely with atproto OAuth so Skyblur can confirm only the permissions needed to post.',
    workflowWriteTitle: 'Write the post and note',
    workflowWriteDescription: 'Enter the text you want to hide, then add an optional Skyblur-only note of up to 10,000 characters.',
    workflowVisibilityDescription: 'Choose who can read it, or protect it with a password for each post.',
    workflowPostTitle: 'Publish',
    workflowPostDescription: 'Skyblur posts the masked text to Bluesky, then readers can continue on Skyblur.',
    workflowAction: 'Start now',
    seoTitle: 'Features & Visibility Settings',
    jsonLdDescription: 'Learn about Skyblur features, including masked Bluesky posts and visibility settings (followers, lists, passwords). Powered by atproto.'
  }
};

export function generateFeaturesMetadata(lang: Locales): Metadata {
  const copy = pageCopy[lang];

  return {
    title: `${copy.seoTitle} - Skyblur`,
    description: copy.jsonLdDescription,
    alternates: {
      canonical: `/${lang}/features`,
      languages: {
        ja: '/ja/features',
        en: '/en/features',
        'x-default': '/features'
      }
    },
    openGraph: {
      title: `${copy.seoTitle} - Skyblur`,
      description: copy.jsonLdDescription,
      url: `https://skyblur.uk/${lang}/features`,
      siteName: 'Skyblur',
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
      images: ['/ogp.png']
    },
    twitter: {
      card: 'summary_large_image',
      title: `${copy.seoTitle} - Skyblur`,
      description: copy.jsonLdDescription,
      images: ['/ogp.png']
    }
  };
}

export function renderFeaturesPage(lang: Locales) {
  const locale = lang === 'ja' ? ja : en;
  const copy = pageCopy[lang];

  const visibilityItems = [
    {
      icon: UsersRound,
      title: locale.Visibility_Public,
      description: locale.CreatePost_VisibilityPublicDescription
    },
    {
      icon: LockKeyhole,
      title: locale.Visibility_Login,
      description: locale.CreatePost_VisibilityLoginDescription
    },
    {
      icon: KeyRound,
      title: locale.Visibility_Password,
      description: locale.CreatePost_VisibilityPasswordDescription
    },
    {
      icon: UsersRound,
      title: locale.CreatePost_VisibilityFollowers,
      description: locale.CreatePost_VisibilityFollowersDescription
    },
    {
      icon: UsersRound,
      title: locale.CreatePost_VisibilityFollowing,
      description: locale.CreatePost_VisibilityFollowingDescription
    },
    {
      icon: ShieldCheck,
      title: locale.CreatePost_VisibilityMutual,
      description: locale.CreatePost_VisibilityMutualDescription
    },
    {
      icon: ListChecks,
      title: locale.CreatePost_VisibilityList,
      description: locale.CreatePost_VisibilityListDescription
    }
  ];

  const editorItems = [
    {
      icon: Type,
      title: copy.editorRichTextTitle,
      description: copy.editorRichTextDescription
    },
    {
      icon: FileText,
      title: copy.editorNoteTitle,
      description: copy.editorNoteDescription
    },
    {
      icon: History,
      title: copy.editorDraftTitle,
      description: copy.editorDraftDescription
    }
  ];

  const workflowItems = [
    {
      icon: LogIn,
      title: copy.workflowOAuthTitle,
      description: copy.workflowOAuthDescription
    },
    {
      icon: Pencil,
      title: copy.workflowWriteTitle,
      description: copy.workflowWriteDescription
    },
    {
      icon: ShieldCheck,
      title: locale.CreatePost_PublishMethodTitle,
      description: copy.workflowVisibilityDescription
    },
    {
      icon: EyeOff,
      title: copy.workflowPostTitle,
      description: copy.workflowPostDescription
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `https://skyblur.uk/${lang}/features#webpage`,
        'url': `https://skyblur.uk/${lang}/features`,
        'name': `${copy.seoTitle} - Skyblur`,
        'description': copy.jsonLdDescription,
        'inLanguage': lang,
        'isPartOf': {
          '@type': 'WebSite',
          '@id': 'https://skyblur.uk/#website',
          'name': 'Skyblur',
          'url': 'https://skyblur.uk'
        },
        'mainEntity': [
          {
            '@type': 'ItemList',
            'name': copy.visibilityTitle,
            'description': copy.visibilityLead,
            'itemListElement': visibilityItems.map((item, index) => ({
              '@type': 'ListItem',
              'position': index + 1,
              'name': item.title,
              'description': item.description
            }))
          },
          {
            '@type': 'ItemList',
            'name': copy.editorTitle,
            'description': copy.editorLead,
            'itemListElement': editorItems.map((item, index) => ({
              '@type': 'ListItem',
              'position': index + 1,
              'name': item.title,
              'description': item.description
            }))
          },
          {
            '@type': 'HowTo',
            'name': copy.workflowTitle,
            'description': copy.workflowLead,
            'step': workflowItems.map((item, index) => ({
              '@type': 'HowToStep',
              'position': index + 1,
              'name': item.title,
              'text': item.description
            }))
          }
        ]
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `https://skyblur.uk/${lang}/features#software`,
        'name': 'Skyblur',
        'operatingSystem': 'All',
        'applicationCategory': 'SocialNetworkingApplication',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'USD'
        }
      },
      {
        '@type': 'FAQPage',
        '@id': `https://skyblur.uk/${lang}/features#faq`,
        'mainEntity': [
          {
            '@type': 'Question',
            'name': copy.faq1Question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': copy.faq1Answer
            }
          },
          {
            '@type': 'Question',
            'name': copy.faq2Question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': copy.faq2Answer
            }
          },
          {
            '@type': 'Question',
            'name': copy.faq3Question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': copy.faq3Answer
            }
          },
          {
            '@type': 'Question',
            'name': copy.faq4Question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': copy.faq4Answer
            }
          }
        ]
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Container size="lg" className={classes.wrapper}>
        <section className={classes.hero}>
          <div>
            <Text className={classes.eyebrow}>{copy.eyebrow}</Text>
            <Title order={1} className={classes.title}>
              {copy.title}
            </Title>
            <Text className={classes.description}>
              {copy.description}
            </Text>
            <FeatureActions
              primaryAction={copy.primaryAction}
              secondaryAction={copy.secondaryAction}
              homeHref={`/${lang}`}
            />
          </div>

          <div className={classes.preview} aria-label={copy.previewTitle}>
            <div className={classes.previewHeader}>
              <Text fw={700}>{copy.previewTitle}</Text>
              <Badge variant="light">{copy.previewStatus}</Badge>
            </div>
            <div className={classes.previewBody}>
              <div className={classes.postBox}>
                <Group gap="xs" mb="xs">
                  <EyeOff size={16} />
                  <Text size="sm" fw={700}>{copy.previewPostLabel}</Text>
                </Group>
                <Text size="sm">{copy.previewPostText}</Text>
                <div className={classes.maskedLine} />
              </div>
              <div className={classes.postBox}>
                <Group gap="xs" mb="xs">
                  <ShieldCheck size={16} />
                  <Text size="sm" fw={700}>{copy.previewVisibilityLabel}</Text>
                </Group>
                <Text size="sm" className={classes.previewFullText}>{copy.previewFullText}</Text>
                <Text size="xs" c="dimmed" mt="xs">{copy.previewVisibility}</Text>
              </div>
            </div>
          </div>
        </section>

        <ScrollReveal resetKey={lang}>
          <section className={classes.section}>
            <Title order={2} className={classes.sectionTitle}>
              {copy.visibilityTitle}
            </Title>
            <Text className={classes.sectionLead}>
              {copy.visibilityLead}
            </Text>
            <div className={classes.visibilityGrid}>
              {visibilityItems.map((item, index) => (
                <article
                  className={`${classes.card} ${classes.revealItem}`}
                  key={item.title}
                  style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties}
                >
                  <ThemeIcon variant="light" size={42} radius={42} mb="md">
                    <item.icon size={18} strokeWidth={1.6} />
                  </ThemeIcon>
                  <Text fw={700} mb={6}>{item.title}</Text>
                  <Text size="sm" c="dimmed" lh={1.7}>{item.description}</Text>
                </article>
              ))}
            </div>
          </section>

          <section className={classes.section}>
            <Title order={2} className={classes.sectionTitle}>
              {copy.editorTitle}
            </Title>
            <Text className={classes.sectionLead}>
              {copy.editorLead}
            </Text>
            <div className={classes.featureGrid}>
              {editorItems.map((item, index) => (
                <article
                  className={`${classes.card} ${classes.revealItem}`}
                  key={item.title}
                  style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties}
                >
                  <ThemeIcon variant="light" size={42} radius={42} mb="md">
                    <item.icon size={18} strokeWidth={1.6} />
                  </ThemeIcon>
                  <Text fw={700} mb={6}>{item.title}</Text>
                  <Text size="sm" c="dimmed" lh={1.7}>{item.description}</Text>
                </article>
              ))}
            </div>
          </section>

          <section className={classes.section}>
            <Title order={2} className={classes.sectionTitle}>
              {copy.workflowTitle}
            </Title>
            <Text className={classes.sectionLead}>
              {copy.workflowLead}
            </Text>
            <div className={classes.steps}>
              {workflowItems.map((item, index) => (
                <article
                  className={`${classes.step} ${classes.revealItem}`}
                  key={item.title}
                  style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties}
                >
                  <div className={classes.stepIcon}>
                    <item.icon size={18} strokeWidth={1.7} />
                  </div>
                  <div>
                    <Text fw={700} className={classes.stepTitle}>{item.title}</Text>
                    <Text size="sm" c="dimmed" lh={1.7} mt={4}>{item.description}</Text>
                  </div>
                </article>
              ))}
            </div>
            <div className={`${classes.bottomCtaCard} ${classes.revealItem}`} style={{ '--reveal-delay': '280ms' } as CSSProperties}>
              <div className={classes.bottomCtaTextContent}>
                <Title order={3} className={classes.bottomCtaTitle}>
                  {locale.Home_BottomCtaTitle}
                </Title>
                <Text className={classes.bottomCtaDesc}>
                  {locale.Home_BottomCtaDescription}
                </Text>
              </div>
              <div className={classes.bottomCtaAction}>
                <FeaturePrimaryAction label={copy.workflowAction} />
              </div>
            </div>
          </section>
        </ScrollReveal>
      </Container>
    </>
  );
}
