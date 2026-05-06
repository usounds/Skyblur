# CreatePost 互換性監査

作成日: 2026-05-06

## 目的

旧 `frontend/src/components/CreatePost.tsx` が実現していた投稿機能を、新 `post-composer` 実装へ移したときの互換性を確認する。

この文書が受け入れられるまで、旧 `CreatePostForm` は削除しない。

## ビジネスインパクト

本監査で `要修正` または MVP 削除ブロッカーに分類した項目は、UI刷新の見た目調整ではなく投稿体験の信頼性リスクとして扱う。

password 編集、draft 復元、保存 payload、部分成功表示の回帰は、投稿不能、編集不能、復元欠落、保存済み範囲の誤認、公開事故、データ消失感、再入力負荷、問い合わせ増加に直結する。そのため、`CreatePostForm` 削除前に解消する。

## `CreatePostForm` 削除条件

旧 `CreatePostForm` は、以下をすべて満たすまで削除しない。

1. 重大な回帰疑い 1-4 が修正済みである。
2. 新規 public/password/restricted/list、返信あり、facets あり、threadgate/postgate あり、編集同一保存形式、restricted -> non-restricted cleanup の代表 payload が unit test または contract test で固定されている。
3. 新規投稿の draft 復元/破棄/保存成功後 clear と、編集 route で復元モーダルが出ないことが E2E で確認されている。
4. password 投稿 edit unlock 後の再入力不要、password 境界変更不可、非 password 同士の公開範囲変更可がテストで確認されている。
5. `threadgate/postgate` の edit 保存は本文・補足保存と分離され、gate 側の失敗が本文・補足保存を巻き込まないことが確認されている。

重大な回帰疑い 1-4 を仕様変更として残す場合は、ユーザー影響、代替導線、データ損失/漏洩リスクがないこと、E2E または unit test による固定、明示的な承認理由を同じ節に記録する。単に「MVP対象外」として削除条件を満たした扱いにはしない。

## 削除承認条件

`CreatePostForm` の削除は、実装担当以外のレビュー担当が、MVP 削除ブロッカーの修正 PR、対応テスト名、代表 payload fixture/snapshot、未解消リスクの承認者、削除 PR を確認したうえで明示的に承認する。

承認時には、残す `未確認` / `仕様変更` 項目が投稿・編集・復元・保存安全性を損なわない理由を記録する。`OK` 判定は、根拠となるコード箇所、テスト名、または確認方法を追跡できる状態にする。根拠を追跡できない `OK` は削除承認上は `未確認` として扱う。

## リリース停止 / ロールバック条件

MVP 削除ブロッカーのいずれかで、投稿不能、編集不能、draft 消失、password 再入力ループ、本文・補足保存の巻き添え失敗、保存済み範囲不明が再現する場合は、旧 `CreatePostForm` 削除、新 composer 単独化、本番 route の完全切替を停止する。

必要に応じて feature flag rollback、または旧 `CreatePostForm` route への fallback を行い、旧導線を残したまま修正 PR を優先する。ユーザー通知には、保存済み範囲、未保存範囲、再入力が必要かどうかを含める。

## MVP 削除ブロッカー

`CreatePostForm` 削除前に必須とするのは、ユーザーが投稿・編集・復元・保存を安全に完了できることに直結する項目に限定する。

- password 投稿 edit unlock 後、再入力なしで保存できる。
- edit route / `/console` 経由の unlocked password cache が保持される。
- 新規投稿 draft の本文・補足・visibility・password draft・返信先が復元される。復元できない項目がある場合は、本文・補足を消さず、復元できなかった項目だけを明示する。
- public/password/restricted/list、reply、facets、threadgate/postgate create、edit visibility cleanup の代表 payload が unit test または contract test で固定される。
- edit の `threadgate/postgate` 保存失敗が、本文・補足保存を巻き込まない。
- 保存成功後に draft が clear され、保存失敗時は draft/state が保持される。

## post-MVP 確認項目

以下は `CreatePostForm` 削除後でもよい。ただし、UI刷新の完了条件として別途追跡する。

- 連続伏せ字省略を編集時にも表示するか、旧仕様通り新規だけに戻すかの仕様確定。
- 投稿中の段階表示を、Notification と button loading のどちらへ寄せるかの調整。
- visual / responsive / dark mode の追加 polish。ただし、本文、補足、visibility、password、返信/引用設定、保存済み範囲をユーザーが誤認する表示崩れは post-MVP に送らず、削除前確認へ戻す。

## 判定

- `OK`: 旧 `CreatePostForm` 相当、または意図した仕様変更として成立しており、コードまたはテスト上の根拠がある。
- `NG`: 未実装、部分実装、または旧挙動/本監査の受け入れ条件を満たしていない。
- `要修正`: 実装はあるが、旧挙動または現在の要件とズレている。
- `未確認`: コード上の根拠が足りず、追加確認またはテストが必要。
- `仕様変更`: 旧 UI から変えたが、今回の要件上は許容する。備考に受け入れ理由を記載する。

## 分類

- `旧互換回帰`: 旧 `CreatePostForm` でできていたことが、新 composer で欠けている、または壊れている。
- `新仕様リスク`: 旧実装の単純移植ではなく、新 composer の追加仕様や保存設計によって発生したリスク。
- `UX/運用リスク`: 保存 payload よりも、ユーザー理解、復元、導線、運用上の安心感に関わるリスク。

## 重大な回帰疑い

### 1. password 編集 unlock 後の password が composer に渡っていない

- 分類: 旧互換回帰
- 旧: `CreatePostForm` は `prevBlur.encryptKey` がある場合、編集画面で `encryptKey` を保持し、password 形式のまま保存できた。
- 新: `PasswordUnlockGate` は `onUnlocked({ text, additional, password, encryptKey })` を返しているが、`EditPostLoader` が `initialData.password` に渡していない。
- 影響: password 投稿を解除して編集しても、composer state の `password` が空になり、Audience step で password 必須エラーになる可能性がある。
- ユーザーに見える症状: パスワードを解除したのに、編集保存前にもう一度 password 入力を求められる、または保存に進めない。
- 判定: OK
- 根拠: `EditPostLoader.applyPasswordUnlockToInitialData` が `initialData.password` に unlock 済み password を渡す。`frontend/src/components/post-composer/__tests__/EditPostLoader.test.tsx` の `keeps the unlocked password in password edit initial data` で固定。
- 対象: `frontend/src/components/post-composer/EditPostLoader.tsx`, `frontend/src/components/post-composer/PasswordUnlockGate.tsx`

### 2. edit route の unlock 結果が unlocked password cache に保存されていない

- 分類: 旧互換回帰 / UX運用リスク
- 旧: `/console` 側で password 投稿を解除した本文・補足・password を編集に使えた。
- 新: `PostList` の解除処理は `setUnlockedPasswordPost` を呼ぶ。一方、`PasswordUnlockGate` は `setSensitiveDraft` のみで `unlockedBlurUri` を設定しない。
- 影響: edit route 上で一度解除した後、route 再読み込みや再訪問時に再入力を求められる可能性がある。
- ユーザーに見える症状: 解除済みの投稿を編集しようとしても、画面遷移や再表示のたびに同じ password を入力させられる。
- 判定: OK
- 根拠: `PasswordUnlockGate` の解除結果は `EditPostLoader` で `setUnlockedPasswordPost` へ保存され、`unlockedBlurUri` が一致する場合に再利用される。`SensitiveDraft.test.ts` の `stores an unlocked password post separately from the new-post password draft` で cache 分離を固定。
- 対象: `frontend/src/state/SensitiveDraft.ts`, `frontend/src/components/post-composer/PasswordUnlockGate.tsx`, `frontend/src/components/post-composer/EditPostLoader.tsx`

### 3. 新規投稿 draft 復元で返信先 URI が replyPost に復元されない

- 分類: 旧互換回帰
- 旧: `tempReply` がある場合、復元時に `app.bsky.feed.getPosts` で返信先投稿を取得し、`replyPost` を復元した。
- 新: `syncCreateDraft` は `tempPost.setReply(state.replyPost?.uri ?? "")` を保存するが、`PostComposerRouteScaffold` の `createInitialData` は `tempReply` を読んでおらず、返信先投稿の再取得もしていない。
- 影響: 返信先を選んだ状態の新規投稿 draft を復元しても、返信先が消える可能性がある。
- ユーザーに見える症状: 返信先を選んで書きかけ保存された投稿を復元しても、通常投稿として復元されてしまう。
- 判定: OK
- 根拠: `PostComposerRouteScaffold` が create draft の `tempReply` を `app.bsky.feed.getPosts` で再取得する。`frontend/e2e/oauth-xrpc.spec.ts` の `/console restores draft content with a selected reply target` で production route 復元を確認。
- 対象: `frontend/src/components/post-composer/PostComposerRouteScaffold.tsx`

### 4. edit の threadgate/postgate 更新が既存 record 不在時に applyWrites 全体を失敗させる可能性

- 分類: 新仕様リスク
- 旧: `CreatePostForm` は新規投稿時のみ threadgate/postgate を作成していた。編集時の gate 更新は旧実装の主要機能ではなかった。
- 新: edit では常に `update-threadgate` と `update-postgate` を write target に含め、`applyWrites` を 1 回にまとめている。
- 影響: 対象 gate record が存在しない、または scope が不足している場合、Skyblur 本文・補足更新まで失敗する可能性がある。
- 方針: edit 初期化時に `com.atproto.repo.getRecord` で `app.bsky.feed.threadgate` と `app.bsky.feed.postgate` を直接取得する。取得できた record を元に gate の初期値と dirty 判定を作る。`cid` precondition は使わない。
- 方針: 取得対象 rkey は編集対象投稿の rkey とする。
- 方針: `getRecord` 成功時は record が存在する扱いにし、ユーザーが gate 設定を変更した場合だけ update または delete を発行する。変更していない場合は gate write を発行しない。
- 方針: `getRecord` が 404 の場合は「現時点で gate record は存在しない」と扱う。ユーザーが gate 設定を変更した場合のみ create し、変更していない場合は gate write を発行しない。
- 方針: `getRecord` が 401/403 の場合は gate 編集だけを無効化し、本文・補足編集は継続できるようにする。保存時も gate write を発行しない。
- 方針: `getRecord` が 5xx または network error の場合は一時的な gate 初期化失敗として扱い、gate 編集だけを無効化する。本文・補足編集をブロックしない。
- 方針: gate を「制限なし / 引用許可」へ戻す操作は、record がある場合に delete で表現する。record が存在しない場合は何もしない。空 record update は使わない。
- 方針: gate 更新は Skyblur record 保存と分離する。本文・補足の保存が gate record 不在、scope 不足、通信失敗で巻き添え失敗しないようにする。
- 方針: 部分成功時は「本文と補足は保存済み。返信/引用設定は保存できませんでした。」のように、何が保存され何が残ったかをユーザーに明示する。再試行時は gate だけを保存し、本文・補足や Bluesky post を二重更新しない。
- ユーザーに見える症状: 本文や補足だけを直したいのに、返信/引用設定側の都合で保存全体が失敗する。
- 判定: OK
- 根拠: `EditPostLoader` が `app.bsky.feed.threadgate` / `app.bsky.feed.postgate` を `com.atproto.repo.getRecord` で取得し、`save.ts` が dirty の gate だけを本文保存後に別 `applyWrites` で保存する。`save.test.ts` の gate edit 系テストと `AudienceStep.test.tsx` の gate controls lock テストで固定。
- 対象: `frontend/src/logic/postComposer/save.ts`

## 機能別互換性マトリクス

| 領域 | 旧 CreatePost の挙動 | 新 composer の現状 | 判定 | 備考 |
| --- | --- | --- | --- | --- |
| 本文入力 | 本文を `postText` として保持 | `PostComposerState.text` | OK | `PostComposerScreen.createInitialComposerState` と `WriteStep.applyText` で保持。300文字制限は `AutoResizeTextArea` に継承 |
| 補足入力 | `addText` を Skyblur のみへ保存 | `state.additional` | OK | `WriteStep` が `additional` を更新し、public/login は Skyblur record、restricted/list は store、password は encrypt body に入る |
| 伏せ字指定 | `[]` で伏せる範囲を指定 | `transformPostText` を共用 | OK | `text.ts` の `buildRecordText` / `buildBlurredText` を使用 |
| 選択範囲を `[]` で括る | `AutoResizeTextArea` のボタン | `WriteStep` で同部品利用 | OK | `isEnableBrackets={!state.simpleMode}` で旧部品を利用。未選択時の notification は `AutoResizeTextArea` 側依存 |
| 全角括弧検出 | `［］` を警告し変換ボタン表示 | `hasFullWidthBrackets` で変換ボタン表示 | OK | `WriteStep` が `normalizeFullWidthBrackets` ボタンを表示 |
| 括弧 validation | 閉じ忘れ、入れ子、不一致を警告 | `validatePostText` と `getStepError` | OK | write step error と step 進行ブロックあり |
| シンプルモード | 切替時に確認し、本文を消す | `WriteStep` で確認 modal | OK | `CreatePost_ChangeSimpleMode` modal 後に本文関連 state を空にする |
| シンプルモード中の括弧禁止 | warning で投稿不可 | step error で進行不可 | OK | `validatePostText` の `bracket-in-simple-mode` を `getStepError` が拾う |
| 連続伏せ字省略 | 新規投稿のみ表示 | 新規投稿のみ表示 | OK | ユーザー判断により旧仕様へ合わせた。`WriteStep` は `state.mode === "create"` の時だけ表示 |
| Bluesky preview | `書く` 画面内で disabled textarea preview | `チェック` 画面に集約 | 仕様変更 | 3 step 方針として許容。編集時の Bluesky 本文非更新表示は `SkyblurCheckStep` 側の実装確認が必要 |
| 一時保存 | 新規投稿のみ `TempPost` に保存 | 新規投稿のみ `onStateChange` で保存 | OK | `PostComposerRouteScaffold` が create のみ `syncCreateDraft` を渡す |
| password draft | 旧 store は `encryptKey` も保持 | `SensitiveDraft` に分離 | OK | `TempPost` は password visibility の本文/補足/password を `SensitiveDraft` へ逃がす |
| 復元モーダル | 新規投稿で temp があると表示 | 新規投稿のみ hydrated 後に表示 | OK | `PostComposerRouteScaffold` は create のみ restore decision を持つ |
| 復元時の返信先 | `tempReply` から投稿を再取得 | `tempReply` から `app.bsky.feed.getPosts` で再取得。失敗時は本文・補足を消さず返信先だけ復元不可と表示 | OK | `/console restores draft content with a selected reply target` と `/console keeps draft text when the saved reply target cannot be restored` E2E で固定 |
| 投稿成功後 draft clear | `clearTempPost` | `clearSensitiveDraft` + `clearTempPost` | OK | `PostComposerRouteScaffold.onSubmit` 成功時に両方 clear |
| 戻る確認 | 編集時 `ConfirmBack` | 編集で dirty な write step から戻る場合は確認 modal を表示 | OK | `PostComposerScreen` に旧 `ConfirmBack` 相当を実装。`/console post list supports reveal, reaction, edit, and delete actions` E2E で固定 |
| public visibility | record に full text/additional | `public-record` | OK | `buildSkyblurRecordValue` public branch が `textForRecord` と `additional` を保存 |
| login visibility | record に full text/additional | `public-record` | OK | public と同じ record 保存形式 |
| password visibility | encrypt -> uploadBlob -> Skyblur record | 同順序 | OK | `buildSkyblurRecordValue` が encrypt -> uploadBlob -> `encryptBody` record を作る。失敗表示は stage 別の画面内 Alert に分離 |
| followers/following/mutual/list | `uk.skyblur.post.store` 後に Skyblur record | 同順序 | OK | restricted-store branch で `uk.skyblur.post.store` 後、Skyblur record value を作る。list は `listUri` を含める |
| list 必須 validation | list 未選択なら保存不可 | audience step で進行不可 | OK | `getStepError` が `listUri` なしを audience blocker にする |
| password 空白 validation | 保存前と入力欄でエラー | audience step で進行不可 | OK | `getPasswordWhitespaceError` を `getStepError` が拾う |
| password 境界変更 | edit で password と非passwordの相互変更禁止 | save plan で禁止 | OK | `buildPostComposerSavePlan` が password boundary change を `unsupported-storage-change` にする |
| 非password visibility 変更 | 旧実装では選択可能 | 新 save plan で許可 | OK | `changesPasswordBoundary` 以外は update-same-storage を返す |
| restricted -> non-restricted cleanup | `deleteStored` を best effort | `deleteStored` を呼び、失敗時は保存成功 warning と Notification で残存可能性を表示 | OK | `postComposerSave` は cleanup 失敗を投稿保存失敗にせず `restricted-cleanup-failed` warning を返す。`save.test.ts` の `keeps restricted cleanup failure as a successful save warning` で固定 |
| app.bsky.feed.post create | 新規投稿時のみ作成 | 新規投稿時のみ作成 | OK | `postComposerSave` は `mode === "create"` の時だけ app.bsky.feed.post create を追加 |
| Skyblur record update | 編集時は `uk.skyblur.post` update | update 実装あり。`swapRecord` は付けない | OK | audit 方針通り cid precondition は使わない。`save.test.ts` の restricted cleanup case で `swapRecord` 不在を固定 |
| `validate` parameter | 旧は付けない | 新も付けない | OK | applyWrites input に `validate` は付けていない |
| OGP embed | external embed を付与 | 実装済み | OK | `buildBlueskyPostValue` が external embed と password suffix を付与 |
| `via: Skyblur` | 付与 | 付与 | OK | `buildBlueskyPostValue` に `via: "Skyblur"` |
| custom fields | `uk.skyblur.post.uri`, visibility | 付与 | OK | `buildBlueskyPostValue` に `uk.skyblur.post.uri` / `uk.skyblur.post.visibility` |
| langs | `franc` + locale fallback | 同様 | OK | `detectLanguage` が `franc` と `CreatePost_Lang` fallback を使用 |
| hashtag facet | `TAG_REGEX` | 実装済み | OK | `buildFacets` で tag facet を生成 |
| mention facet | `MENTION_REGEX` + IdentityResolver | 実装済み | OK | `buildFacets` で IdentityResolver 成功時だけ mention facet を生成。旧の重複 push は解消 |
| URL facet | URL regex | 実装済み | OK | `buildFacets` で URL facet を生成し byte index は UTF-8 計算 |
| 返信先選択 | ReplyList で選択 | 詳細設定内で選択 | OK | `AudienceStep` が `ReplyList` から `replyPost` を設定 |
| 返信先表示 | 選択後はカード表示、一覧を隠す | 選択後はカード表示 | OK | `AudienceStep` は `replyPost` があると選択済み表示へ切替 |
| 返信先 label | 旧は投稿カード全文 | Check では先頭50文字 | 仕様変更 | ユーザー指摘に沿う仕様変更として許容 |
| 返信制限 | mention/following/followers | 実装済み | OK | `AudienceStep` の `threadGate` と `buildThreadGateWrite` |
| 引用制限 | quote allow chip | `postGate.allowQuote` | OK | `AudienceStep` の `postGate.allowQuote` と `buildPostGateWrite` |
| threadgate create | 新規のみ作成 | 新規作成あり | OK | create 時に `threadGate.length` があれば threadgate create |
| postgate create | 引用不許可時に新規作成 | 同様 | OK | create 時に `allowQuote === false` なら postgate create |
| threadgate/postgate edit | 旧は主要保存フロー外 | getRecord/dirty/create/update/delete/分離保存を実装。初期化不可時は controls を無効化し説明を表示 | OK | `gateControlsEditable=false` では返信・引用設定だけ編集不可にし、本文・補足保存は継続。`AudienceStep.test.tsx` で固定 |
| 暗号化失敗表示 | notification | stage別の画面内 Alert | OK | `encrypt-failed` は `PostComposer_ErrorEncryptFailed` を表示し、本文・補足・password が保持されることを明示。Notification との二重表示はしない |
| blob upload失敗表示 | notification | stage別の画面内 Alert | OK | `blob-upload-failed` は `PostComposer_ErrorBlobUploadFailed` を表示し、投稿未作成と再試行可能性を明示。Notification との二重表示はしない |
| restricted store失敗表示 | notification | stage別の画面内 Alert | OK | `restricted-store-failed` は `PostComposer_ErrorRestrictedStoreFailed` を表示し、本文・補足保持を明示。Notification との二重表示はしない |
| applyWrites失敗表示 | notification | stage別の画面内 Alert | OK | `apply-writes-failed` / unauthorized / conflict は保存未完了または再ログイン/競合として区別。Notification との二重表示はしない |
| 投稿中 loading | notification + button loading | button loading のみ | NG | encrypt/blob/store/applyWrites の段階表示が未実装 |
| Skyblur Check | 旧は preview +説明中心 | 2 section 比較 | OK | `SkyblurCheckStep` と `buildSkyblurCheckSummary` で実装。ただし visual polish は別項目 |
| dark mode | 旧は単純フォーム | 新は一部 CSS 調整中 | NG | 互換マトリクス上、コード根拠だけでは全 check/audience/write 表示の dark mode 破綻なしを確認できない |
| mobile visibility grid | 旧 base 2 cols | 新 base 2, xs 3, sm 4 | OK | `AudienceStep` 側で responsive grid を反映済み |

## 保存 payload assertion

保存 payload 固定では、各ケースについて以下を assertion として明記する。

- 必須 field: `text`、`langs`、`via`、`createdAt`、Skyblur custom field、`uri`、`visibility` など、ケースごとの必須値が存在する。
- 禁止 field: password 平文、restricted/list の全文、`additional` の誤保存、不要な `listUri`、不要な `encryptBody` が混入しない。
- API 呼び出し順: `encrypt`、`uploadBlob`、`store`、`applyWrites`、`deleteStored` の順序が旧仕様と矛盾しない。
- facets: tag/mention/url の byte index が UTF-8 で正しく、resolver 失敗時に不正 facet を作らない。
- reply: root/parent strong ref が正しく、返信先 draft 復元後も同じ payload になる。
- createdAt: `app.bsky.feed.post` と `uk.skyblur.post` の生成時刻が同一投稿内で矛盾しない。
- draft/state: 保存失敗時に本文・補足・password draft・reply が失われない。
- cleanup: restricted -> public/login の cleanup 失敗は投稿保存失敗として扱わないが、古い restricted store が残った可能性を追跡できる。

### visibility別の必須/禁止 field

| visibility | 必須 field / 保存先 | 禁止 field / 混入禁止 |
| --- | --- | --- |
| public/login | Bluesky post は伏せ字済み `text`、Skyblur record は全文 `text` と `additional` を持つ | password 平文、`encryptBody`、不要な `listUri` |
| password | `encryptBody`、`visibility: password`、伏せ字済み `text`、password suffix 付き OGP description | password 平文、復号本文、復号補足、Skyblur record の平文 `additional` |
| followers/following/mutual | `uk.skyblur.post.store` に全文/補足を保存し、Skyblur record は伏せ字済み `text` と restricted visibility を持つ | restricted 全文、補足本文、不要な `encryptBody`、不要な `listUri` |
| list | `uk.skyblur.post.store` に全文/補足/listUri を保存し、Skyblur record は伏せ字済み `text`、`visibility: list`、`listUri` を持つ | restricted 全文、補足本文、不要な `encryptBody`、未選択 list の `listUri` |
| non-password edit | password 境界をまたがず、保存形式に応じた field だけを更新する | password visibility への暗黙移行、password 平文、不要な gate write |

## sensitive state / password cache 保持条件

password unlock cache は、同じブラウザの `SensitiveDraft` 永続 storage に保持してよい。TTL は設けない。対象 account DID と post URI が一致する場合にのみ利用する。

- 保存成功時、復元破棄時、明示破棄時、ログアウト時、アカウント切替時は clear する。
- 新規投稿 draft と edit unlock cache は用途を分け、別投稿/別アカウントに流用しない。
- `SensitiveDraft` 以外の永続 storage には password 平文、復号本文、復号補足を保存しない。
- account DID または post URI が一致しない場合は unlock cache を利用せず破棄する。
- route 離脱後も、unlock cache の対象 account DID/post URI と一致する場合だけ再利用する。
- password 解除済み編集で再入力を求める状態は回帰として扱う。

## 保存 payload 比較

### 新規 public/login

- Bluesky post: `text` は伏せ字済み、`langs`、`via`、`uk.skyblur.post.uri`、`uk.skyblur.post.visibility`、`createdAt`、`facets`、external embed を含む。
- Skyblur record: `uri`、`text: state.textForRecord`、`additional`、`createdAt`、`visibility`。
- 判定: OK。`save.test.ts` の `creates the same public applyWrites shape as CreatePost` と `/console create post form writes reply and quote controls from the screen` E2E で representative payload を固定。

### 新規 password

- 事前処理: `uk.skyblur.post.encrypt` -> `com.atproto.repo.uploadBlob`。
- Bluesky post: 伏せ字済み本文と password suffix 付き OGP description。
- Skyblur record: `text` は伏せ字済み、`additional` は空、`encryptBody`、`visibility: password`。
- 判定: OK。`save.test.ts` の `creates password payloads without leaking plaintext into records` で暗号化 request、blob upload、`encryptBody`、password suffix、平文混入禁止を固定。編集 unlock 後の password state 受け渡しは `EditPostLoader.test.tsx` で固定。

### 新規 restricted/list

- 事前処理: `uk.skyblur.post.store`。list の場合は `listUri` を含める。
- Bluesky post: 伏せ字済み本文。
- Skyblur record: `text` は伏せ字済み、`visibility`、list の場合は `listUri`。
- 判定: OK。`save.test.ts` の `creates restricted list payloads through store before applyWrites` で `uk.skyblur.post.store` request、API順序、Skyblur record の `visibility/listUri`、全文/補足混入禁止を固定。

### 返信あり新規

- Bluesky post に `app.bsky.feed.post#replyRef` を付与。
- root は返信先 root があれば root、なければ返信先自身。
- 判定: OK。root/parent strong ref は `save.test.ts` の `creates reply refs from the selected reply target`、返信先 draft 復元は `/console restores draft content with a selected reply target` E2E で固定。

### threadgate/postgate

- 新規: threadgate は rule がある場合のみ create。postgate は引用不許可の場合のみ create。
- 編集: 現状は update を試みるが、direct `getRecord` 方針へ変更する。
- 判定: OK。新規 create payload は `save.test.ts` の `creates threadgate and postgate records for new posts when selected` と `/console create post form writes reply and quote controls from the screen` E2E、編集 getRecord/dirty/create/update/delete/分離保存は `EditPostLoader.test.tsx` と `save.test.ts` の gate edit 系テストで固定。
- 編集時の受け入れ条件:
  - 初期化時に `app.bsky.feed.threadgate` / `app.bsky.feed.postgate` を `com.atproto.repo.getRecord` で直接取得する。
  - 取得成功時は record が存在する扱いにし、dirty の場合だけ gate 保存する。`cid` precondition は使わない。
  - 404時は record 不在として扱い、ユーザーが変更した場合だけ create する。
  - 制限なし/引用許可へ戻す場合は、既存 record があれば delete する。空 update は使わない。
  - gate 保存は本文・補足保存と分離し、gate 失敗時は部分成功として表示する。

### 編集 non-password visibility 変更

- password 境界をまたがない変更は許可。
- restricted へ広がる場合は `store` 後に Skyblur record を update。
- restricted から non-restricted へ戻す場合は `deleteStored` を best effort。
- 判定: OK。`save.test.ts` の `cleans up restricted storage after changing an edited post to non-restricted visibility` と `keeps restricted cleanup failure as a successful save warning` で、Skyblur record update、`deleteStored` cleanup、cleanup 失敗 warning を固定。

## save failure / operation observability

保存失敗は、少なくとも以下の段階ごとに区別して表示・ログ化する。

- `encrypt`: password 投稿の暗号化失敗。本文・補足・password draft は保持する。
- `uploadBlob`: 暗号化 blob upload 失敗。再試行可能として表示し、Skyblur/Bluesky record は作成しない。
- `restrictedStore`: restricted/list の全文保存失敗。Skyblur/Bluesky record は作成しない。
- `skyblurRecord`: `uk.skyblur.post` create/update 失敗。Bluesky post の二重作成を避けるため、どこまで完了したかを表示する。
- `blueskyApplyWrites`: Bluesky post/threadgate/postgate applyWrites 失敗。write target と保存済み範囲を追跡できるようにする。
- `gateSave`: edit の threadgate/postgate 保存失敗。本文・補足保存は成功扱いのまま、gate だけ未保存として表示する。
- `restrictedCleanup`: restricted -> public/login cleanup 失敗。投稿保存失敗として扱わないが、古い restricted store が残った可能性を追跡できるようにする。

保存・通信系のエラーは composer 内の画面内 Alert で表示する。Alert には、保存済みの範囲、未保存の範囲、再試行で安全にやり直せる範囲を含める。Notification は同じ文言の二重表示に使わず、保存成功後の cleanup warning など、画面遷移後にも残す必要がある補助通知に限定する。部分成功時は本文・補足の保存成功を取り消さず、失敗した gate/cleanup だけを追跡可能にする。password 解除済み編集で再入力を求める状態は仕様変更ではなく回帰として扱う。

入力中に判定できる validation エラーは Notification に逃がさず、該当 step 上のフィールド付近に表示し、stepper と次へ/投稿をブロックする。

operation log には本文、補足、password 平文、復号本文、復号補足を出力しない。出力先と severity は実装前に固定し、operation id、account DID、post uri、stage、result、retryable、saved scopes、failed scopes、再試行対象で検索できるようにする。ユーザー通知と運用ログの stage 名は一致させる。

Alert / Notification の受け入れ条件:

- 保存済み範囲、未保存範囲、次にできる操作がユーザーに読める文言で表示される。
- `gateSave` の部分成功では、本文・補足が保存済みで、返信/引用設定だけ未保存であることを明示する。
- `restrictedCleanup` 失敗では、投稿保存は完了しているが古い restricted store が残った可能性を運用で追えることを明示する。
- 画面内 Alert と Notification は同じ原因・同じ文言を二重表示しない。
- 代表的な部分成功文言は E2E または表示スナップショットで固定する。

## 部分成功後の再試行状態

部分成功後の再試行では、すでに成功した Skyblur record / Bluesky post を再作成・再更新せず、失敗した gate/cleanup のみを対象にする状態を保持する。

- 同一画面内の再試行では、失敗した stage だけを再実行する。
- reload / route 離脱時に未保存 gate 状態は保持しない。
- gate 失敗後に離脱する場合は「本文と補足は保存済み。返信/引用設定は未保存です。」相当の通知を出す。
- gate だけを再試行できるのは同一画面内に限る。reload / route 離脱後は、画面を開き直して現在の gate 状態を再取得する。
- 本文・補足を再編集した場合は、古い gate-only retry 状態を破棄するか、本文保存とは独立した未保存 gate として明示する。
- gate/cleanup の再試行は Notification または専用UIから行い、本文・補足や Bluesky post の二重更新を発生させない。

## テスト方針

保存 payload の互換性確認は unit test または contract test を必須とし、production route 上の draft 復元、password edit cache、保存成功後 clear、入力不備時の step blocking は E2E を主とする。E2E は、payload の必須/禁止 field、API 呼び出し順、facets byte index、password 平文混入なしの代替にはしない。

- unit test: `buildPostComposerSavePlan` / save helper の write target、record payload、API 呼び出し順、必須/禁止 field、facets byte index、失敗時 state 保持を検証する。
- E2E: production route の代表フローで、画面文言、step進行可否、localStorage clear、復元モーダル、新規/編集 route 差分、部分成功時の表示文言を検証する。
- E2E は payload 全組み合わせの網羅に使わず、ユーザー導線と統合点の代表確認に限定する。
- 削除条件に含まれる draft 復元、password edit cache、保存成功後 clear、編集 route 差分は、production route の E2E で確認する。preview/test-only route の確認のみでは削除条件を満たさない。

## E2E 反映が必要な項目

### draft / restore

- 新規投稿成功後、`zustand.temptext` と `zustand.sensitive-post-draft` が clear される。
- 新規投稿のみ復元モーダルが表示され、編集 route では表示されない。
- 復元モーダルで「復元する」「破棄する」「新しく書く」相当の選択ができ、typing 中に遅れて表示されない。
- 復元モーダルで本文、補足、visibility、list、password draft、返信先 URI が復元される。
- `tempReply` がある場合は `app.bsky.feed.getPosts` 等で返信先投稿を再取得し、取得失敗時は返信先だけ復元できないことを表示する。

### validation / step blocking

- 本文エラー、password 空白、list 未選択、unsupported password 境界変更では stepper と次へ/投稿で進めない。
- 保存ボタンを押すまで分からない入力エラーを増やさず、可能なものは該当 step 上で表示する。
- password 境界変更不可エラーは二重表示しない。

### password edit

- password 投稿 edit unlock 後、password が composer state に入り、そのまま保存できる。
- `/console` で password 解除済みの投稿を edit route へ進めた場合、再入力なしで編集できる。
- edit route 上で解除した結果も unlocked password cache に保存され、再表示時に再入力を求めない。

### save payload

- public with facets/reply/threadgate/postgate の representative payload を固定する。
- password の encrypt request、blob upload、Bluesky post、Skyblur record payload を固定する。
- restricted/list の store request、Bluesky post、Skyblur record payload を固定する。
- restricted -> public/login cleanup の `deleteStored` 呼び出しと、cleanup失敗時の扱いを固定する。
- edit non-password visibility 変更で、password 境界をまたがない変更が保存できる。

### gate edit

- edit 初期化時に `threadgate/postgate` を `com.atproto.repo.getRecord` で直接取得する。
- 取得対象 rkey は編集対象投稿の rkey とする。
- gate record ありの場合は dirty 判定に基づき、変更時だけ gate write を発行する。`cid` precondition は使わない。
- gate record 404の場合、未変更なら gate write を発行しない。変更時だけ create する。
- 401/403/5xx/network error の場合は gate 編集だけを無効化し、本文・補足編集は継続できる。
- scope不足、record不在、通信失敗などで gate 保存に失敗しても、本文・補足保存は失敗扱いにしない。
- 部分成功時は、本文・補足が保存済みで gate 設定だけ失敗したことをユーザーに表示する。再試行では gate だけを保存し、本文・補足や Bluesky post を二重更新しない。

### visual / responsive

- wide/dark/mobile の Skyblur Check は縦並び、余計な外枠なし、public 時に `それ以外` タブなし。
- mobile で本文、補足、visibility、password、返信/引用設定、保存済み範囲が読み取れ、誤認につながる表示崩れがない。
- 編集時の Skyblur Check では Bluesky 側本文を表示しない。Bluesky 側本文/OGP/card は更新対象外であることだけを表示する。

## Deletion Gate Scorecard

`CreatePostForm` 削除 PR には、以下の scorecard を埋める。未記入または `hold` が残る場合は削除しない。

| 項目 | 必須成果物 | 判定 |
| --- | --- | --- |
| 重大回帰 1 password edit unlock | 修正PR、対応 unit/E2E、reviewer | implemented / reviewer pending |
| 重大回帰 2 unlocked password cache | 修正PR、対応 E2E、reviewer | implemented / reviewer pending |
| 重大回帰 3 draft reply restore | 修正PR、対応 E2E、reviewer | implemented / reviewer pending |
| 重大回帰 4 gate edit 分離保存 | 修正PR、対応 unit/E2E、reviewer | implemented / reviewer pending |
| 代表 payload | public/password/restricted/list/reply/facets/gate/cleanup の fixture または snapshot | implemented / reviewer pending |
| production route E2E | draft restore、password edit cache、保存成功後 clear、step blocking、部分成功通知のテスト名 | partially covered / reviewer pending |
| sensitive cache | `SensitiveDraft` 保存、TTLなし、account DID/post URI照合、clear trigger の確認 | implemented / reviewer pending |
| rollback readiness | 旧導線 fallback、停止条件、operation log 検索キー、ユーザー通知の確認 | pending |
| accepted risks | 残す `未確認` / `仕様変更` の承認者と理由 | pending |
| final decision | approve / hold / reject | hold |

## 次の修正候補順

1. password edit unlock の password 受け渡しを直し、同時に該当 unit/E2E を固定する。
2. edit route の unlock 結果を `setUnlockedPasswordPost` に保存し、`/console` 経由と edit route 直接解除の両方を E2E で固定する。
3. draft 復元時に `tempReply` を読んで返信先投稿を再取得し、復元失敗時の表示も固定する。
4. 代表 payload を unit test 中心で固定する。public/password/restricted/list、reply、facets、threadgate/postgate create、edit visibility cleanup を対象にする。
5. edit の threadgate/postgate は、`com.atproto.repo.getRecord` で既存 record を取得し、dirty の場合だけ create/update/delete する。`cid` precondition は使わない。制限解除は delete で表現する。
6. edit の threadgate/postgate 保存は本文・補足保存と分離する。scope 不足、record不在、通信失敗などで gate 保存に失敗しても本文保存を巻き込まず、部分成功を Notification で表示する。
7. post-MVP として、連続伏せ字省略を編集でも表示するか、旧仕様通り新規だけに戻すか決める。
8. post-MVP として、投稿中の段階表示を Notification と button loading のどちらへ寄せるか決める。

## MAGIレビュー反映メモ

- `旧互換回帰` と `新仕様リスク` を混ぜずに扱う。
- 重大項目には「ユーザーに見える症状」を必ず書く。
- 実装修正は、UX上の痛みと保存安全性が大きい `password edit unlock/cache` を最優先にする。
- `threadgate/postgate edit` は旧互換ではなく、新 composer が追加した編集対象であるため、本文・補足保存を巻き込まない設計にする。
- payload未固定の `OK` は `未確認` に落とし、代表 payload の unit test / contract test を通してから `OK` に戻す。
- `仕様変更` は、ユーザー体験上の受け入れ理由を備考に書く。
- `CreatePostForm` 削除は、重大回帰修正と代表 payload 固定が完了するまでブロックする。
- subagent MAGIレビューにより、MVP 削除ブロッカーと post-MVP 確認項目を分離した。
- 保存失敗は段階ごとに識別し、保存済み範囲、未保存範囲、再試行可能範囲をユーザーと運用が追える形にする。
- no-context subagent MAGIレビューにより、ビジネスインパクト、削除承認条件、リリース停止/ロールバック条件、sensitive state 保持条件、visibility別 payload assertion、部分成功後の再試行状態、production route E2E 条件を追加した。
