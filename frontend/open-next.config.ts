/** @type {import('@opennextjs/aws').OpenNextConfig} */
const config = {
  default: {
    // 標準 Lambda runtime を使用
    runtime: "lambda",
    // 必要に応じてリージョンを指定
    regions: ["ap-northeast-1"],

  },
};

export default config;
