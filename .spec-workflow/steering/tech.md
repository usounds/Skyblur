# Technology Stack

## Project Type

Skyblur は AT Protocol / Bluesky と連携する Web アプリケーション兼 API サービスである。

- `frontend/`: Next.js によるユーザー向け Web アプリ、OAuth クライアント、XRPC プロキシ、投稿作成・閲覧 UI。
- `backend/`: Cloudflare Workers / Hono による Skyblur API、OAuth 関連エンドポイント、制限付き投稿保存、AT Protocol service proxy 対応。
- `lexicon/`: Skyblur 独自 XRPC と record schema の Lexicon JSON。

## Core Technologies

### Primary Language(s)

- **Language**: TypeScript
- **Runtime/Compiler**: Node.js 22 以上、Cloudflare Workers Runtime、Next.js runtime
- **Package Manager**: pnpm 9 以上
- **Lexicon Generation**: `@atcute/lex-cli`

### Key Dependencies/Libraries

- **Next.js 16**: frontend の App Router、server routes、standalone build。
- **React 19**: UI コンポーネント。
- **Mantine 9**: フォーム、ボタン、通知、レイアウトなどの UI 基盤。
- **lucide-react**: UI アイコン。
- **zustand**: frontend のセッション・XRPC agent・UI 状態管理。
- **@atcute/client / @atcute/atproto / @atcute/bluesky**: XRPC クライアント、Bluesky API、AT Protocol 型。
- **@atcute/oauth-node-client**: OAuth セッション、認可、トークン管理。
- **@atcute/lexicons**: Lexicon 検証と生成型。
- **Hono**: backend Worker の HTTP routing。
- **Cloudflare Workers / Durable Objects / KV / R2**: backend 実行環境、セッション保存、制限付き投稿保存、キャッシュ、バックアップ。
- **Vitest**: frontend/backend の単体・統合テスト。
- **Playwright**: frontend の E2E テスト。主に WebKit を重点確認する。

### Application Architecture

Skyblur は frontend と backend が分かれた構成だが、どちらも TypeScript と atcute 系ライブラリを共有する。

- frontend はユーザー操作、OAuth login/session、投稿作成、投稿詳細、投稿一覧、設定 UI を担当する。
- frontend の `/xrpc/[method]` route は、ログインセッションを使う XRPC proxy と public Skyblur method の proxy を担当する。
- backend は `uk.skyblur.*` XRPC、制限付き投稿の保存・取得、OAuth metadata、DID document、admin 系 route を担当する。
- Lexicon JSON を source of truth とし、frontend/backend の生成型を同期する。
- 公開範囲の認可判定はサーバー側で行い、UI はその結果を分かりやすく表示する。

### Data Storage

- **Primary storage**:
  - Cloudflare Durable Objects `OAuthStoreDO`: OAuth session/state 等。
  - Cloudflare Durable Objects `RestrictedPostDO`: フォロワー限定・フォロー中限定・相互フォロー限定などの制限付き投稿本文と補足。
- **Caching**:
  - Cloudflare KV `SKYBLUR_KV_CACHE`: DID document などのキャッシュ用途。
  - frontend runtime/state 内の一時的な UI・profile・session 状態。
- **Backup**:
  - Cloudflare R2 `SKYBLUR_BACKUP`: production では cron trigger によるバックアップ。
- **Data formats**:
  - Lexicon JSON、AT Protocol records、XRPC JSON、AT URI、DID、JWT/JWK、Blob。

### External Integrations

- **Bluesky AppView**: `https://public.api.bsky.app` および `did:web:api.bsky.app#bsky_appview`。
- **User PDS**: OAuth セッションの audience / token info に基づく XRPC 呼び出し。
- **AT Protocol OAuth**: `atproto`, `include:uk.skyblur.permissionSet`, `rpc:*`, `repo:*`, `blob:*/*` の scope。
- **AT Protocol Identity**: DID PLC、did:web、handle 解決。
- **Constellation / Microcosm / Slingshot 系 API**: reactions や backlinks など、Bluesky 周辺データの取得。
- **Cloudflare platform APIs**: Worker, KV, Durable Object, R2, observability。

### Monitoring & Dashboard Technologies

- **User-facing dashboard**: Next.js / React UI。
- **Development workflow dashboard**: spec-workflow dashboard `http://localhost:5000`。
- **Diagnostics**: frontend XRPC route は必要に応じて elapsed/stage/proxy 関連 header を返す。
- **Observability**: backend preview/production の Worker observability は wrangler config で有効化する。

## Development Environment

### Build & Development Tools

- **frontend dev**: `rtk pnpm dev`。Next.js dev server は通常 port `4500`。
- **frontend build**: `rtk pnpm build`。このプロジェクトでは Next.js build は必ず権限付きで実行する。
- **backend dev**: `rtk pnpm dev`。Wrangler dev を使用する。
- **Lexicon generation**:
  - frontend: `rtk pnpm gen-lex`
  - backend: `rtk pnpm gen-lex`
- **Cloudflare deploy**:
  - backend: `rtk pnpm deploy`
  - frontend: SST / OpenNext Cloudflare 系 script。

### Code Quality Tools

- **Static Analysis**: ESLint、TypeScript。
- **Testing**:
  - frontend: Vitest、Playwright、E2E coverage scripts。
  - backend: Vitest、Cloudflare Workers mock。
- **E2E priority**: Safari/WebKit 互換性を重視し、主要フローは WebKit で確認する。
- **Formatting**: 既存コードスタイルに従う。大規模な自動整形や無関係な churn は避ける。

### Version Control & Collaboration

- **VCS**: Git。
- **Branching Strategy**: Codex 作業ブランチを作る場合は `codex/` prefix を標準にする。
- **Review Process**: 変更は既存の未コミット差分を尊重し、ユーザーまたは他エージェントの変更を巻き戻さない。
- **Spec workflow**: Requirements → Design → Tasks → Implementation の順に dashboard approval を通す。

### Dashboard Development

- **Spec Workflow Dashboard**: `http://localhost:5000`。
- **Approval Rule**: dashboard または VS Code extension 上の承認だけを正式承認とし、口頭承認では次フェーズに進まない。
- **Language Rule**: spec、steering、implementation log は原則日本語で記述する。

## Deployment & Distribution

- **frontend target**: Next.js standalone / OpenNext / SST / Cloudflare deployment。
- **backend target**: Cloudflare Workers。
- **Environments**:
  - local/dev: `dev.skyblur.uk`, `devapi.skyblur.uk`
  - preview: `preview.skyblur.uk`, `previewapi.skyblur.uk`
  - production: `skyblur.uk`, `api.skyblur.uk`
- **Cloudflare resources**: KV, Durable Objects, R2, cron triggers, custom domains。

## Technical Requirements & Constraints

### Performance Requirements

- XRPC proxy や外部 API 呼び出しは、UI を長時間固着させないよう timeout と recoverable error を設計する。
- 認可判定では必要最小限の外部 API データを取得する。
- 投稿作成 UI は画像処理、暗号化、Blob upload、制限付き保存、Bluesky 投稿作成の進行を段階的に表示する。

### Compatibility Requirements

- **Node.js**: 22 以上。
- **pnpm**: 9 以上。
- **Browser**: Safari/WebKit を重要ターゲットとして扱う。
- **AT Protocol**: Lexicon、AT URI、DID、OAuth、XRPC の仕様に従う。
- **Cloudflare Workers**: Worker runtime と `nodejs_compat` の制約内で動かす。

### Security & Compliance

- OAuth session、state、cookie はサーバー側で安全に扱い、不要になったセッションや cookie を適切に削除する。
- server-side fetch は SSRF を防ぐため、HTTPS、公的 host、credential なし URL、IP literal / localhost / private suffix 拒否などの guard を維持する。
- 制限付きコンテンツは deny-by-default とし、認証・認可・外部 API 判定に失敗した場合は隠された本文や補足情報を返さない。
- CSRF protection は browser POST と ATProto service proxy request の違いを考慮して維持する。
- CORS は Skyblur 管理ドメインと許可されたサブドメインに限定する。
- エラー応答やログは secret、password、private key、hidden content を漏らさない。

### Scalability & Reliability

- Cloudflare Workers / Durable Objects の分散実行モデルに合わせ、request 単位の状態に依存しすぎない。
- Durable Object lock は deadlock 防止の TTL を持つ。
- 外部 API の遅延・失敗は timeout、fallback、明確な error code で扱う。
- 生成済み Lexicon 型の不整合は runtime validation や build failure に直結しやすいため、Lexicon JSON 変更時は frontend/backend ともに同期する。

## Technical Decisions & Rationale

### Decision Log

1. **TypeScript を frontend/backend/Lexicon 周辺で統一する**: AT Protocol 型、Lexicon 生成型、XRPC client を共有しやすくするため。
2. **Next.js App Router を frontend の基盤にする**: UI、server route、metadata、proxy route を同一アプリ内で扱えるため。
3. **Cloudflare Workers + Hono を backend に使う**: 軽量な XRPC service と Durable Object/KV/R2 連携に適しているため。
4. **atcute 系ライブラリを採用する**: AT Protocol、Bluesky API、OAuth、Lexicon の型と client を一貫して扱えるため。
5. **制限付きコンテンツは Durable Object に保存する**: 公開 Bluesky record には伏せ字・メタデータを置き、隠し本文や補足は server-side authorization 後に返すため。
6. **Spec workflow を日本語で運用する**: このプロジェクトの実装意図とユーザー判断を日本語で残し、後続の Design/Tasks/Implementation で誤読を減らすため。

## Known Limitations

- Lexicon JSON と生成済み TypeScript 型は手動生成 step に依存するため、変更時に frontend/backend の片方だけ更新されるリスクがある。
- 外部 AppView、PDS、Microcosm 系 API の可用性と遅延が閲覧・認可フローに影響する。
- browser / PDS / Worker / Next.js route の境界が多く、OAuth や XRPC の失敗原因を UI から即座に特定しづらい場合がある。
- Cloudflare Durable Object と local test mock の差異により、storage や lock 周辺は E2E/統合テストで補う必要がある。
