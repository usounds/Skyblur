# JetstreamによるSkyblurレコード・ミラー移行計画

## 目的

`uk.skyblur.post.getPost`が投稿レコードを都度PDSから取得する構造をやめ、
Skyblur専用Jetstream consumerが受信・保存したローカルミラーから読む。

Airglowは利用しない。ライブイベントの入力元はJetstreamだけとする。

## 構成

```text
Bluesky Jetstream US-East
          │ WebSocket
          ▼
Go consumer（Fly.ioまたはRailway / Virginia / 256MB）
          │ HMAC付きmicro-batch
          ▼
JetstreamIngestDO（単一）
  ├─ 永続Inbox
  ├─ committed cursor（Unix microseconds）
  └─ 投影待ちキュー
          │ Durable Object Alarm
          ▼
PostMirrorDO（DID別）
  ├─ 現在の投稿レコード
  ├─ delete tombstone
  ├─ 最新状態の順序情報
  └─ PDSバックフィルcursor
```

Fly/Railway側には永続データを置かない。consumer停止時はDOに保存済みの
cursorを5秒巻き戻して再接続し、canonical event IDで重複を除去する。

## 正常性の境界

- consumerがWebSocketで受信しただけではcursorを進めない。
- Ingest DOがInbox保存とcursor更新を同一トランザクションで完了した後だけ応答する。
- consumerは応答されたcursorが直前値からbatch cursorまでの範囲にあることを検証する。
- 投影失敗はInboxに残し、Alarmで無期限に再試行する。
- 構造を読める不正frameはraw payloadを保存せずhash・cursor・理由と読取可能なDID/collection/rkeyだけを永続隔離してからcursorを進める。
- deleteは物理削除せずtombstoneとして保存する。
- `time_us`はミリ秒へ丸めずマイクロ秒のまま保持する。

## Consumer

- Goの単一バイナリとする。
- `wantedCollections=uk.skyblur.post`を必須指定する。
- US-East 2台を優先し、障害時はUS-West 2台へ切り替える。
- WebSocket ping、指数バックオフ、full jitter、5秒rewindを使用する。
- queueは8メッセージ、message/batchは各1MiBを初期上限とする。
- queue満杯時はイベントを捨てず、socketを閉じてdurable cursorから再取得する。
- SIGTERM時は新規受信を止め、処理中の永続化を期限付きでdrainする。
- ローカルVolumeを使用しない。

## Backend

### JetstreamIngestDO

- `event_id`を主キーにした永続Inboxを持つ。
- batch保存と`committedCursor`更新を`transactionSync`で原子的に行う。
- checkpointだけのbatchも受け付け、不要イベント区間のcursorを進める。
- Alarmはpendingイベントを時刻順にDID別PostMirrorDOへ投影する。
- 投影成功後だけInboxを`projected`へ変更する。
- queue深度、投影位置、最終受信時刻を状態APIで返す。
- 状態APIは最古pending/dead-letterと隔離frame数も返し、途中の詰まりを隠さない。
- 投影成功したInbox行は即時削除し、未反映・再試行中のイベントだけを保持する。

### PostMirrorDO

- `did + collection + rkey`ごとに現在状態を保持する。
- 累積event履歴は保存せず、最新レコード・順序情報・watermarkを同一トランザクションで更新する。
- 順序はsource、`time_us`、rev、operation、event IDで決定する。
- 同時刻・同revではdeleteをupdate/createより優先する。
- `live Jetstream > backfill`とし、バックフィルがliveやtombstoneを上書きしない。
- 既存の保存済みミラーデータは削除しない。

## バックフィル

- PDS `listRecords`のopaque cursorをDID別PostMirrorDOに保存する。
- 状態は`pending / running / completed / failed`とする。
- ページ適用と次cursor更新を同一トランザクションにする。
- live mirrorに既に存在するレコードやtombstoneは上書きしない。
- Jetstreamの再生可能範囲を越えた停止を検知した場合も同じバックフィル経路を使う。

## セキュリティ

- consumerからのGET/POSTはraw bodyに対するHMAC-SHA256で認証する。
- timestamp許容幅は5分とする。
- HTTPS以外へsecretを送らない。
- canonical event IDをBackendでも再計算する。
- raw record、署名、secretをログへ出さない。
- 検査APIは別のBearer tokenで保護し、`Cache-Control: no-store`を付ける。

## 移行

1. consumerとBackendをpreviewで接続する。
2. PDS readを維持したまま`MIRROR_SHADOW_READ=true`で値を比較する。
3. create/update/delete、再接続、consumer kill、投影失敗を検証する。
4. DID単位バックフィルを実行する。
5. 欠損率と差分率が許容値になったらローカルreadへ切り替える。
6. 問題時はconsumerを止め、読取り元だけ従来PDSへ戻す。

## 受入条件

- 同一イベントの再送で現在状態が変化しない。
- 古いupdateが新しいdeleteを復活させない。
- Inbox保存前にcursorが進まない。
- consumer/Jetstream/API/DOの一時停止後に欠損なく追いつく。
- 未来5分を超えるcursorはconsumer・API・DOの各境界で拒否される。
- SIGTERM中のin-flight batchがdrainされるか、再起動後にreplayされる。
- 256MB環境でqueueが無制限に増えず、OOMしない。
- バックフィルが中断したcursorから再開できる。
- ローカルread切替後、通常の投稿取得でPDS `getRecord`が発生しない。

## 配置

第一候補はFly.io `iad`の`shared-cpu-1x / 256MB`。Railwayを使う場合は
US East VirginiaのHobby planと`Always` restartを使用する。どちらでも同じ
stateless binaryを動かし、永続状態はすべてCloudflare DOに置く。
