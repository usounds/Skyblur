# Project Structure

## Directory Organization

```text
Skyblur/
├── AGENTS.md                         # Codex/agent 向けのプロジェクト指示
├── RTK.md                            # shell command に rtk prefix を付ける運用ルール
├── README.md                         # プロダクト概要
├── .spec-workflow/                   # spec-driven development の文書と承認状態
│   ├── README.md                     # Skyblur 固有の spec-workflow 運用
│   ├── steering/                     # product / tech / structure の steering 文書
│   ├── specs/                        # 機能ごとの Requirements / Design / Tasks
│   ├── templates/                    # spec-workflow 標準テンプレート
│   └── user-templates/               # Skyblur 固有テンプレート
├── lexicon/                          # Skyblur Lexicon JSON の source of truth
│   └── uk/skyblur/
│       ├── post/                     # uk.skyblur.post record/procedure
│       └── preference/               # uk.skyblur.preference record
├── frontend/                         # Next.js Web アプリ
│   ├── src/
│   │   ├── app/                      # App Router routes/pages/server routes
│   │   ├── components/               # 再利用 UI と主要画面部品
│   │   ├── lexicon/                  # frontend 生成済み Lexicon 型
│   │   ├── locales/                  # 日本語/英語 UI 文言と規約 markdown
│   │   ├── logic/                    # OAuth、ID 解決、日時、画像などのアプリロジック
│   │   ├── state/                    # zustand store
│   │   └── types/                    # 共有型、定数、正規表現
│   ├── e2e/                          # Playwright E2E
│   ├── scripts/                      # E2E coverage などの補助 script
│   └── public/                       # 静的 asset
└── backend/                          # Cloudflare Workers API
    ├── src/
    │   ├── api/                      # XRPC/API handler と Durable Object
    │   ├── lexicon/                  # backend 生成済み Lexicon 型
    │   ├── logic/                    # OAuth、認証、暗号、DID 解決
    │   ├── scheduled/                # cron/backup
    │   ├── scripts/                  # 開発・検証用 script
    │   ├── utils/                    # test/development utility
    │   └── index.ts                  # Hono app、routes、middleware、Env
    └── test/                         # Worker mock などのテスト支援
```

## Naming Conventions

### Files

- **React components**: `PascalCase.tsx` を基本にする。例: `CreatePost.tsx`, `PostList.tsx`。
- **Next.js routes/pages**: App Router の規約に合わせて `page.tsx`, `route.ts`, `main.tsx` を使う。
- **CSS Modules**: 対応する component/page 名に合わせて `*.module.css` とする。
- **Logic modules**: 既存に合わせて `camelCase.ts` または機能名 `PascalCase.ts` を使う。新規は周辺ファイルの命名に合わせる。
- **Tests**: frontend は `__test__/*.test.ts`、backend は `__tests__/*.test.ts`、E2E は `*.spec.ts`。
- **Lexicon JSON**: `lexicon/uk/skyblur/{namespace}/{method-or-record}.json` に置く。

### Code

- **Types / Interfaces / Classes**: `PascalCase`。
- **Functions / Methods / Variables**: `camelCase`。
- **Constants**: 既存の共有定数は `UPPER_SNAKE_CASE`。OAuth の TTL や scope 定数も用途が分かる名前にする。
- **Visibility values**: record に保存する値は lowercase string。例: `public`, `password`, `login`, `followers`, `following`, `mutual`。
- **Lexicon identifiers**: `uk.skyblur.post.*` 形式を維持する。

## Import Patterns

### Import Order

1. 外部依存関係。
2. `@/` alias による内部 module。
3. 相対 import。
4. CSS module や静的 asset。

### Module/Package Organization

- frontend/backend ともに TypeScript path alias `@/` を使う。
- `lexicon/` の JSON を更新した場合は、frontend/backend の `src/lexicon/` 生成物を同期する。
- UI から backend storage や Durable Object へ直接依存しない。UI は XRPC/API client を経由する。
- backend handler は Hono `Context` と Lexicon validation を境界にし、認証・認可・保存処理を明確に分ける。

## Code Structure Patterns

### Frontend Components

1. `"use client"` が必要な component はファイル先頭に置く。
2. imports。
3. props/type 定義。
4. component state と store selector。
5. helper function。
6. event handler。
7. render。

`CreatePost.tsx` のような大きな component に新機能を追加する場合も、可能な限り選択肢、検証、外部 API 取得、表示部品を小さな helper/component に分ける。

### Next.js Route Handlers

1. external/internal imports。
2. method allowlist、timeout、proxy などの constants。
3. error class / type。
4. request helper。
5. `GET` / `POST` などの exported handler。

XRPC proxy route では、session restore、proxy choice、public fallback、diagnostic header、timeout を混ぜすぎないように helper 境界を保つ。

### Backend API Handlers

1. Lexicon schema import。
2. Hono `Context` と認証 helper。
3. `safeParse` による input validation。
4. DID / AT URI / collection / requester 整合性検証。
5. 認可判定。
6. Durable Object / external API 呼び出し。
7. JSON response。

認可失敗時は hidden text や additional を返さない。既存の制限付き公開範囲と同じ応答形を優先する。

### Durable Object

- Durable Object は保存責務に集中させる。
- SQL schema 変更が必要な場合は既存データとの互換性を考慮する。
- `GET`, `PUT`, `DELETE` の method ごとの責務を明確に保つ。
- DO に認可判断を押し込みすぎず、handler 側で requester/author/visibility を検証する。

### Lexicon

- `lexicon/` 配下の JSON を source of truth とする。
- record schema と procedure input/output は同じ visibility 値を一貫して扱う。
- `format: "at-uri"`、required fields、enum は可能な限り Lexicon 側で表現する。
- Lexicon JSON 更新後は frontend/backend の生成型を両方更新する。

## Code Organization Principles

1. **Single Responsibility**: UI、XRPC route、backend handler、Durable Object、Lexicon schema の責務を混ぜない。
2. **Modularity**: 新しい公開範囲や認可判定は、既存の visibility branching を壊さず、共有 helper へ寄せる。
3. **Testability**: external API 呼び出し、OAuth session、Durable Object、XRPC proxy は mock しやすい関数境界にする。
4. **Consistency**: 既存の公開範囲、locale key、error code、progress notification のパターンに合わせる。
5. **Deny-by-default**: 不明な visibility、認証失敗、認可確認失敗、外部 API 異常は非公開コンテンツを返さない。

## Module Boundaries

### Frontend UI Boundary

- `frontend/src/components/`: UI とユーザー操作。
- `frontend/src/state/`: login session、XRPC agent、temporary post state。
- `frontend/src/logic/`: OAuth、identity、日時、画像など UI から再利用される処理。
- `frontend/src/app/api/`: frontend app 内の server-side helper route。
- `frontend/src/app/xrpc/[method]/route.ts`: browser/client からの XRPC proxy。

UI component は backend Durable Object や secret へ直接触れない。投稿・取得・削除は agent/XRPC route を経由する。

### Backend Boundary

- `backend/src/index.ts`: Hono app、middleware、routing、Env、Durable Object export。
- `backend/src/api/`: XRPC method handler。Lexicon validation と request/response の境界。
- `backend/src/logic/`: 認証、OAuth、暗号、DID 解決など handler から使うロジック。
- `backend/src/scheduled/`: production cron/backup。

backend handler は `Context` を受け取り、認証・検証・認可・保存を順番に行う。外部 API の結果を信用しすぎず、失敗時は安全側に倒す。

### Lexicon Boundary

- `lexicon/`: source of truth。
- `frontend/src/lexicon/`: generated frontend types/schema。
- `backend/src/lexicon/`: generated backend types/schema。

Lexicon を変更した PR/作業では、JSON と生成物の差分をセットで扱う。

### Test Boundary

- frontend unit/integration: `frontend/src/**/__test__/`。
- frontend E2E: `frontend/e2e/`。
- backend API/logic tests: `backend/src/**/__tests__/`。
- backend Worker mocks: `backend/test/mocks/`。

認可や公開範囲の変更は backend handler tests と frontend UI/E2E の両方で確認する。

## Code Size Guidelines

- **新規ファイル**: 1 つの目的を持つ小さな file を優先する。
- **既存巨大 component への追加**: `CreatePost.tsx` などに直接追加する場合も、選択肢定義、検証、fetch helper、表示 helper を分離する。
- **Function size**: 1 関数に validation、fetch、render、side effect を詰め込まない。分岐が増えたら helper に切り出す。
- **Nesting depth**: 認可判定や UI 条件分岐は early return や helper で浅く保つ。
- **Comments**: 自明な処理にはコメントしない。OAuth、SSRF guard、認可判定、Lexicon 互換性など、意図を残す価値がある箇所だけ短く書く。

## Dashboard/Monitoring Structure

- `.spec-workflow/`: 開発時の spec/steering/tasks/implementation logs。
- `frontend/e2e/` と `frontend/scripts/e2e-*`: UI/E2E coverage の確認。
- backend Worker observability: wrangler config の preview/production env で有効。
- XRPC diagnostics: frontend proxy route は必要に応じて stage/elapsed/proxy header を返す。

spec-workflow の approval は dashboard または VS Code extension 上でのみ正式承認とする。承認後は approval request を delete してから次フェーズへ進む。

## Documentation Standards

- steering、requirements、design、tasks、implementation logs は原則日本語で書く。
- Requirements は user story と受け入れ基準を明確にし、実装詳細に踏み込みすぎない。
- Design は既存 module/file との接続点、データモデル、認可、テスト方針を具体化する。
- Tasks は 1 task あたり 1〜3 file 程度を目安に、実装 prompt と成功条件を含める。
- 重要な設計判断、エラー解決、完了した大きな作業は ICM に保存する。
