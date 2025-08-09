"use client"
import Loading from "@/components/Loading";
import { useEffect, useState } from "react";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Loading />
    );
  }

  return (
    <main >
      <section className="bg-white">
        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h1 className="text-2xl font-semibold text-gray-800 capitalize lg:text-3xl">プライバシーポリシー & 利用規約</h1>
          <p className="mt-4 text-gray-500 xl:mt-6">
            Skyblur（以下，「本サイト」といいます。）は、本サイト上におけるユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下、「本ポリシー」といいます。）を定めます。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 capitalize lg:text-3xl">個人情報の収集・利用</h2>
          <p className="mt-4 text-gray-500 xl:mt-6">
            本サイトは、サービスの提供のために当サイト利用者（以下利用者）から、個人情報を収集しません。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 capitalize lg:text-3xl">データの第三者提供について</h2>
          <p className="mt-4 text-gray-500 xl:mt-6">
            当サイトでは法令及びガイドラインに別段の定めがある場合を除き、 同意を得ないで第三者に利用者の個人情報を提供することはいたしません。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 capitalize lg:text-3xl">アクセス解析ツールについて</h2>
          <p className="mt-4 text-gray-500 xl:mt-6">
            当サイトでは、Cloudflareによるアクセス解析ツール「Web Analytics」を利用しています。 このトラフィックデータは匿名で収集されており、利用者の個人を特定するものではありません。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 capitalize lg:text-3xl">利用規約</h2>
          <p className="mt-4 text-gray-500 xl:mt-6">
            投稿はすべてBlueskyのPDSに保存されます。削除を希望される場合は、ご自身で本サイトの削除機能を使用してください。現在のBlueskyでは、他人のPDSの情報は他人から削除することはできません。どこからかクレームが来た場合は速やかにご自身にて削除をお願いします。また、BlueskyのPDSの情報は全て公開情報となりますので、Skyblurを何かを隠匿する目的では使用できません。
          </p>
          <p className="mt-4 text-gray-500 xl:mt-6">
            それ以外はBluesky、または、PDSの利用規約に準じます。
          </p>
          <p className="mt-4 text-gray-500 xl:mt-6">
            運営者の判断で投稿を本サイトから非表示にする場合がありますが、データは全てPDSに保存されたままとなります。その場合はご自身でデータを救出してください。（その場合であっても一切のサポートは致しません）
          </p>
          <p className="mt-4 text-gray-500 xl:mt-6">
            個人運営のため、急にサービスを停止する場合があります。また、不具合等については可能な限り対応を検討しますが、お約束をするものではありません。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 capitalize lg:text-3xl">運営者情報</h2>
          <p className="mt-4 text-gray-500 xl:mt-6">
            当サイトはゆー(<a href='https://bsky.app/profile/usounds.work' target="_blank">@usounds.work)</a>によって開発・運営されています。
          </p>
        </div>

      </section>

    </main >
  );
}
