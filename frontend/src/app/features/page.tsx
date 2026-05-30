import { cookies, headers } from 'next/headers';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { Badge, Button, Container, Group, Text, ThemeIcon, Title } from '@mantine/core';
import { BookOpenText, EyeOff, KeyRound, ListChecks, LockKeyhole, Pencil, ShieldCheck, UsersRound } from 'lucide-react';
import { resolveLocale } from '@/logic/locale';
import en from '@/locales/en';
import ja from '@/locales/ja';
import { ScrollReveal } from './ScrollReveal';
import classes from './FeaturesPage.module.css';

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
  previewVisibility: string;
  visibilityTitle: string;
  visibilityLead: string;
  workflowTitle: string;
  workflowLead: string;
  jsonLdDescription: string;
};

const pageCopy: Record<'ja' | 'en', FeaturePageCopy> = {
  ja: {
    eyebrow: 'Features',
    title: '伏せ字の先に、読める人を選べます。',
    description: 'SkyblurはBlueskyへの投稿を伏せ字にして、全文や補足をSkyblur側で表示します。公開範囲を選べるので、全体公開からフォロワー限定、リスト限定、パスワード付きまで、話したい相手に合わせて読ませ方を調整できます。',
    primaryAction: '投稿してみる',
    secondaryAction: 'トップに戻る',
    previewTitle: '投稿すると、こう見えます',
    previewStatus: 'フォロワー限定',
    previewPostLabel: 'Blueskyには',
    previewPostText: 'あの展開、○○○○○○○○○。続きはSkyblurで。',
    previewVisibilityLabel: 'Skyblurでは',
    previewVisibility: 'あなたのフォロワーだけが、伏せた部分と補足を読めます',
    visibilityTitle: '公開範囲を投稿ごとに選択',
    visibilityLead: 'Blueskyには伏せ字の本文を投稿し、Skyblurでは選んだ条件を満たす人だけが全文と補足を読めます。',
    workflowTitle: '投稿の流れ',
    workflowLead: '伏せたい箇所と読ませたい相手を決めてから投稿します。',
    jsonLdDescription: 'Skyblurの伏せ字投稿、公開範囲指定、フォロワー限定・リスト限定・パスワード付き公開などの機能紹介です。'
  },
  en: {
    eyebrow: 'Features',
    title: 'Choose who can read beyond the blur.',
    description: 'Skyblur posts masked text to Bluesky and shows the full text on Skyblur. Visibility settings let you choose the right audience for each post, from public access to followers, selected lists, or password-protected reading.',
    primaryAction: 'Create a post',
    secondaryAction: 'Back to home',
    previewTitle: 'What people see after posting',
    previewStatus: 'Followers only',
    previewPostLabel: 'On Bluesky',
    previewPostText: 'That twist was ********. Continue on Skyblur.',
    previewVisibilityLabel: 'On Skyblur',
    previewVisibility: 'Only your followers can read the hidden text and note',
    visibilityTitle: 'Visibility per post',
    visibilityLead: 'Bluesky receives the masked post. Skyblur shows the full text and additional info only to people who match the selected visibility setting.',
    workflowTitle: 'How posting works',
    workflowLead: 'Choose what to hide and who can read it before publishing.',
    jsonLdDescription: 'Features for Skyblur, including masked Bluesky posts, visibility settings, followers-only access, list-only access, and password-protected reading.'
  }
};

async function getLocale() {
  const cookieStore = await cookies();
  const headersList = await headers();
  return resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const copy = pageCopy[lang];

  return {
    title: `${copy.visibilityTitle} - Skyblur`,
    description: copy.jsonLdDescription,
    openGraph: {
      title: `${copy.visibilityTitle} - Skyblur`,
      description: copy.jsonLdDescription,
      url: 'https://skyblur.uk/features',
      siteName: 'Skyblur',
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
      images: ['/ogp.png']
    },
    twitter: {
      card: 'summary_large_image',
      title: `${copy.visibilityTitle} - Skyblur`,
      description: copy.jsonLdDescription,
      images: ['/ogp.png']
    }
  };
}

export default async function FeaturesPage() {
  const lang = await getLocale();
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

  const workflowItems = [
    {
      icon: Pencil,
      title: locale.Home_Landing001Title,
      description: locale.Home_Landing001Descrtption
    },
    {
      icon: ShieldCheck,
      title: locale.CreatePost_PublishMethodTitle,
      description: locale.CreatePost_PublishMethodDescription
    },
    {
      icon: EyeOff,
      title: locale.Home_Landing002Title,
      description: locale.Home_Landing002Descrtption
    },
    {
      icon: BookOpenText,
      title: locale.Home_Landing003Title,
      description: locale.Home_Landing003Descrtption
    }
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${copy.visibilityTitle} - Skyblur`,
    url: 'https://skyblur.uk/features',
    description: copy.jsonLdDescription,
    inLanguage: lang,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Skyblur',
      url: 'https://skyblur.uk'
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: visibilityItems.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        description: item.description
      }))
    }
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
            <div className={classes.actions}>
              <Button component="a" href="/console/posts/new" leftSection={<Pencil size={16} />}>
                {copy.primaryAction}
              </Button>
              <Button component="a" href="/" variant="default">
                {copy.secondaryAction}
              </Button>
            </div>
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
                <Text size="sm">{copy.previewVisibility}</Text>
              </div>
            </div>
          </div>
        </section>

        <ScrollReveal>
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
          </section>
        </ScrollReveal>
      </Container>
    </>
  );
}
