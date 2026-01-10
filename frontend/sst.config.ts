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

    new sst.aws.Nextjs("Skyblur", {
      domain: {
        name: stage === "production"
          ? "skyblur.uk"
          : "preview.skyblur.uk",
        dns: false,
        cert: stage === "production"
          ? "arn:aws:acm:us-east-1:036820509199:certificate/76313a88-46d8-48b7-8def-f37776378dc1"
          : "arn:aws:acm:us-east-1:036820509199:certificate/ee0b076b-692f-4e28-9c05-733cc33d9792",
      },
      regions: ["ap-northeast-1"],
      transform: {
        server: {
          runtime: "nodejs22.x",
        },
      },
    });
  },
});