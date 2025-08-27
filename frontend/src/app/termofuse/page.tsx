export default function Home() {

  return (
    <main >
      <section className="">
        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h1 className="text-2xl font-semibold capitalize lg:text-3xl">プライバシーポリシー & 利用規約</h1>
          <p className="mt-4 xl:mt-6">
            Skyblur（以下，「本サイト」といいます。）は、本サイト上におけるユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下、「本ポリシー」といいます。）を定めます。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">個人情報の収集・利用</h2>
          <p className="mt-4 xl:mt-6">
            本サイトは、サービスの提供のために当サイト利用者（以下利用者）から、個人情報を収集しません。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">データの第三者提供について</h2>
          <p className="mt-4 xl:mt-6">
            当サイトでは法令及びガイドラインに別段の定めがある場合を除き、 同意を得ないで第三者に利用者の個人情報を提供することはいたしません。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">アクセス解析ツールについて</h2>
          <p className="mt-4 xl:mt-6">
            当サイトでは、Cloudflareによるアクセス解析ツール「Web Analytics」を利用しています。 このトラフィックデータは匿名で収集されており、利用者の個人を特定するものではありません。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">外部サービスについて</h2>
          <div className="mt-4 xl:mt-6 ml-2">
            <p className='mb-1'>当サイトは下記の外部サービスを利用しているため、各サービスへの通信が発生します。加えて利用者のPDSへの通信が発生します。</p>
            <li className='mb-1'><a href='https://developers.cloudflare.com/1.1.1.1/privacy/cloudflare-resolver-firefox/' target="_blank">Cloudflare Resolver for Firefox</a></li>
            <li className='mb-1'><a href='https://plc.directory/' target="_blank">DID PLC Directory</a></li>
            <li className='mb-1'><a href='https://public.api.bsky.app/' target="_blank">Bluesky API</a></li>
            <li className='mb-1'><a href='https://constellation.microcosm.blue/' target="_blank">constellation</a></li>
          </div>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">著作権の帰属</h2>
          <p className="mt-4 xl:mt-6">
            利用者が本サイトに投稿したすべてのコンテンツの著作権は、投稿者本人に帰属します。本サイトは利用者の投稿を表示するのみを行います。</p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">責任の所在</h2>
          <p className="mt-4 xl:mt-6">
            利用者は、投稿に関する全ての法的責任を負い、何らかの問題が発生した場合は利用者は自らの費用と責任で問題を解決するものとします。</p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">禁止事項</h2>
          <p className="mt-4 xl:mt-6">
            利用者が禁止行為を行なったことを本サイトが確認した場合、当サービスは利用者に対して、ログイン不可、新規投稿の停止、投稿の非表示化などの利用停止を行うことがあります。</p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">利用規約</h2>
          <p className="mt-4 xl:mt-6">
            投稿はすべてBlueskyのPDSに保存されます。削除を希望される場合は、ご自身で本サイトの削除機能を使用してください。現在のBlueskyでは、他人のPDSの情報は他人から削除することはできません。どこからかクレームが来た場合は速やかにご自身にて削除をお願いします。また、BlueskyのPDSの情報は全て公開情報となりますので、Skyblurを何かを隠匿する目的では使用できません。
          </p>

          <p className="mt-4 xl:mt-6">
            本サイトは「伏せ字」を使った投稿や長文を投稿する目的でのみ使用できます。利用者間のやり取りの目的での使用は禁止とします。
          </p>
          <p className="mt-4 xl:mt-6">
            運営者の判断で投稿を本サイトから非表示にする場合がありますが、データは全てPDSに保存されたままとなります。その場合はご自身でデータを救出してください。（その場合であっても一切のサポートは致しません）
          </p>
          <p className="mt-4 xl:mt-6">
            個人運営のため、急にサービスを停止する場合があります。また、不具合等については可能な限り対応を検討しますが、お約束をするものではありません。
          </p>
          <p className="mt-4 xl:mt-6">
            それ以外はBluesky、または、PDSの利用規約に準じます。
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">改訂履歴</h2>
          <p className="mt-4 xl:mt-6">
            2025/08/28 利用規約に著作権と責任を明記し、チャットツールとしての利用を禁止するようにしました
          </p>
          <p className="mt-4 xl:mt-6">
            2025/08/21 外部サービスについて追記しました
          </p>
        </div>

        <div className="container px-6 pt-4 pb-10 mx-auto">
          <h2 className="text-2xl font-semibold capitalize lg:text-3xl">運営者情報</h2>
          <p className="mt-4 xl:mt-6">
            当サイトはゆー(<a href='https://bsky.app/profile/usounds.work' target="_blank">@usounds.work)</a>によって開発・運営されています。
          </p>
        </div>

      </section>
    </main >
  );
}
