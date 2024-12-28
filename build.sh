#!/bin/bash

if [[ -f .env ]]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found!"
  exit 1
fi
API_URL="https://secure.sakura.ad.jp/cloud/api/apprun/1.0/apprun/api/applications/$APP_ID/versions?page_size=1"
API_URL2="https://secure.sakura.ad.jp/cloud/api/apprun/1.0/apprun/api/applications/$APP_ID"

echo "---Docker Build---"
sudo docker buildx build --tag usounds.sakuracr.jp/skyblur:latest .
echo "---Docker Push---"
sudo docker push usounds.sakuracr.jp/skyblur:latest


# JSON ファイルの存在確認
if [[ ! -f create_app.json ]]; then
  echo "Error: create_app.json not found!"
  exit 1
fi

# PATCH リクエストの実行
echo "---Deploy to Sakura App Run---"
current_datetime=$(date +"%Y-%m-%d %H:%M:%S")
cat <<EOF > create_app.json
{
    "name": "Skyblur $current_datetime",
    "timeout_seconds": 60,
    "port": 3000,
    "min_scale": 0,
    "max_scale": 1,
    "components": [
        {
            "name": "Skyblur $current_datetime",
            "max_cpu": "1",
            "max_memory": "512Mi",
            "deploy_source": {
                "container_registry": {
                    "image": "usounds.sakuracr.jp/skyblur:latest"
                }
            }
        }
    ],
    "all_traffic_available": true
}
EOF

RESPONSE=$(curl -su "$API_USER:$API_PASS" \
  -X PATCH \
  -H "Content-Type: application/json" \
  -d '@create_app.json' \
  "$API_URL2")


echo "Response: $RESPONSE"

# ステータスコードの確認（例: 200 OK）
STATUS_CODE=$(echo "$RESPONSE" | jq -r '.status')
if [[ "$STATUS_CODE" != "Unknown" ]]; then
  echo "Failed to update application. Response: $RESPONSE"
  exit 1
fi

# 初期化
STATUS="Unknown"

while true; do
  # APIを呼び出して結果を取得
  RESPONSE=$(curl -su "$API_USER:$API_PASS" -X GET "$API_URL")

  # ステータスを抽出
  STATUS=$(echo "$RESPONSE" | jq -r '.data[0].status')

  # ステータスを表示
  echo "Status: $STATUS"

  # ステータスが unknown 以外の場合終了
  if [[ "$STATUS" != "Unknown" ]]; then
    echo "Status is no longer 'Unknown'. Exiting..."
    break
  fi

  # 1秒待機
  sleep 1
done