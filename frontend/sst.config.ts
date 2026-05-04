// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />


export default $config({
  app(input) {
    return {
      name: "frontend",
      removal: input.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const stage = $app.stage;

    const oauthStore = new sst.aws.Dynamo("OAuthStore", {
      fields: {
        pk: "string",
      },
      primaryIndex: { hashKey: "pk" },
      ttl: "expiresAt",
    });

    new sst.aws.Nextjs("Skyblur", {
      link: [oauthStore],
      environment: {
        OAUTH_STORE_TABLE_NAME: oauthStore.name,
      },
      domain: stage === "production"
        ? {
          name: "skyblur.uk",
          dns: false,
          cert: "arn:aws:acm:us-east-1:036820509199:certificate/76313a88-46d8-48b7-8def-f37776378dc1"
        }
        : stage === "preview"
          ? {
            name: "preview.skyblur.uk",
            dns: false,
            cert: "arn:aws:acm:us-east-1:036820509199:certificate/36d7dea2-2bdf-4fd8-b756-069d23b00a94"
          }
          : undefined,
      regions: ["ap-northeast-1"],
      transform: {
        server: {
          runtime: "nodejs22.x",
        },
      },
    });
  },
});
