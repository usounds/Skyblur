/** @type {import('@opennextjs/aws').OpenNextConfig} */
const config = {
  default: {
    // 標準 Lambda runtime を使用
    runtime: "lambda",
    // 必要に応じてリージョンを指定
    regions: ["ap-northeast-1"],

    // ISR (revalidate) 設定
    revalidate: {
      override: {
        wrapper: "aws-lambda",     // Lambda 直実行
        converter: "aws-apigw-v2", // API Gateway v2 経由、SQS を通さない
      },
    },
  },
};

export default config;
