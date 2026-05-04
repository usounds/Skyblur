import type { BrowserContext, Page } from "@playwright/test";

export const mockDid = "did:plc:e2emock";
export const mockHandle = "e2e.skyblur.test";
export const mockPds = "https://e2e-pds.skyblur.test";

const mockProfile = {
  did: mockDid,
  handle: mockHandle,
  displayName: "E2E Tester",
  description: "Logged-in E2E mock user",
  avatar: "",
  followersCount: 12,
  followsCount: 34,
  postsCount: 56,
};

const mockPreference = {
  $type: "uk.skyblur.preference",
  myPage: {
    isUseMyPage: true,
    description: "Existing E2E My Page description",
  },
};

const mockPost = {
  uri: `at://${mockDid}/app.bsky.feed.post/e2epost`,
  text: "Visible E2E [secret] console post",
  additional: "E2E additional note",
  createdAt: "2026-05-04T01:23:45.000Z",
  visibility: "public",
};

const mockPasswordPost = {
  uri: `at://${mockDid}/app.bsky.feed.post/e2epassword`,
  text: "Password E2E ****** post",
  additional: "",
  createdAt: "2026-05-04T01:33:45.000Z",
  visibility: "password",
  encryptBody: {
    ref: { $link: "bafy-e2e-password" },
    mimeType: "text/plain",
    size: 18,
  },
};

const mockRestrictedPost = {
  uri: `at://${mockDid}/app.bsky.feed.post/e2erestricted`,
  text: "*****",
  additional: "",
  createdAt: "2026-05-04T01:43:45.000Z",
  visibility: "followers",
};

const mockFollowingPost = {
  ...mockRestrictedPost,
  uri: `at://${mockDid}/app.bsky.feed.post/e2efollowing`,
  visibility: "following",
};

const mockMutualPost = {
  ...mockRestrictedPost,
  uri: `at://${mockDid}/app.bsky.feed.post/e2emutual`,
  visibility: "mutual",
};

const mockLoginOnlyPost = {
  ...mockPost,
  uri: `at://${mockDid}/app.bsky.feed.post/e2elogin`,
  text: "Login-only E2E [secret] post",
  visibility: "login",
};

const mockReplyPost = {
  uri: `at://${mockDid}/app.bsky.feed.post/e2ereply`,
  cid: "bafy-e2e-reply",
  author: mockProfile,
  record: {
    $type: "app.bsky.feed.post",
    text: "E2E reply target post",
    reply: {
      root: {
        uri: `at://${mockDid}/app.bsky.feed.post/e2eroot`,
        cid: "bafy-e2e-root",
      },
      parent: {
        uri: `at://${mockDid}/app.bsky.feed.post/e2eroot`,
        cid: "bafy-e2e-root",
      },
    },
    createdAt: "2026-05-04T02:34:56.000Z",
  },
};

const mockReplyNextPost = {
  ...mockReplyPost,
  uri: `at://${mockDid}/app.bsky.feed.post/e2ereplynext`,
  cid: "bafy-e2e-reply-next",
  record: {
    ...mockReplyPost.record,
    text: "E2E reply next page post",
    createdAt: "2026-05-04T02:44:56.000Z",
  },
};

const mockExternalRootReplyPost = {
  ...mockReplyPost,
  uri: `at://${mockDid}/app.bsky.feed.post/e2eexternalroot`,
  cid: "bafy-e2e-external-root",
  record: {
    ...mockReplyPost.record,
    text: "External root reply should be filtered",
    reply: {
      root: {
        uri: "at://did:plc:external/app.bsky.feed.post/root",
        cid: "bafy-e2e-external-root",
      },
      parent: {
        uri: "at://did:plc:external/app.bsky.feed.post/root",
        cid: "bafy-e2e-external-root",
      },
    },
  },
};

type OAuthMockOptions = {
  authenticated?: boolean;
  noPreference?: boolean;
  noCustomFeed?: boolean;
  customFeedAvatar?: boolean;
  listRecordsHasNextPage?: boolean;
  listRecordsStatus?: 200 | 500;
  listRecordsAbort?: boolean;
  replySearchHasNextPage?: boolean;
  replySearchEmpty?: boolean;
  postVariant?: "public" | "password" | "restricted" | "following" | "mutual" | "login" | "empty";
  postDetailVariant?: "public" | "password" | "authRequired" | "error";
  postDetailVisibility?: "login" | "followers" | "following" | "mutual";
  decryptStatus?: 200 | 403 | 500;
  encryptStatus?: 200 | 500;
  storeStatus?: 200 | 500;
  getPostStatus?: 200 | 500;
  uploadBlobStatus?: 200 | 500;
  applyWritesStatus?: 200 | 500;
  constellationIntentStatus?: 200 | 500;
  constellationAllStatus?: 200 | 500;
  restrictedErrorCode?: "NotFollower" | "NotFollowing" | "NotMutual" | "AuthRequired" | "ContentMissing" | "Other";
  profileAvatar?: string;
  profileDisplayName?: string;
  profileStatus?: 200 | 500;
};

export async function useLoggedInOAuthMock(
  page: Page,
  context: BrowserContext,
  baseURL: string | undefined,
  options: OAuthMockOptions = {},
) {
  for (const routePattern of [
    "**/api/oauth/session",
    "https://plc.directory/**",
    "https://public.api.bsky.app/**",
    "https://constellation.microcosm.blue/**",
    "**/xrpc/**",
  ]) {
    await page.unroute(routePattern).catch(() => {});
  }

  await context.clearCookies();
  const userProfile = {
    ...mockProfile,
    avatar: options.profileAvatar ?? mockProfile.avatar,
    displayName: options.profileDisplayName ?? mockProfile.displayName,
  };
  await context.addCookies([
    {
      name: "lang",
      value: "en",
      url: baseURL || "http://localhost:4500",
    },
  ]);

  await page.route("**/api/oauth/session", async (route) => {
    if (options.authenticated === false) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Cache-Control": "no-store",
          Vary: "Cookie",
        },
        body: JSON.stringify({
          authenticated: false,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Cache-Control": "no-store",
        Vary: "Cookie",
      },
      body: JSON.stringify({
        authenticated: true,
        did: mockDid,
        pds: mockPds,
        userProf: userProfile,
        scope: "atproto repo:app.bsky.feed.post?action=create&action=delete",
      }),
    });
  });

  await page.route("https://plc.directory/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: mockDid,
        service: [
          {
            id: "#atproto_pds",
            type: "AtprotoPersonalDataServer",
            serviceEndpoint: mockPds,
          },
        ],
      }),
    });
  });

  await page.route("https://public.api.bsky.app/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(userProfile),
    });
  });

  await page.route("https://constellation.microcosm.blue/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/links/all") {
      if (options.constellationAllStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "LinksAllFailed" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          links: {
            "app.bsky.feed.repost": { ".subject.uri": { records: 2 } },
            "app.bsky.feed.like": { ".subject.uri": { records: 3 } },
            "app.bsky.feed.post": { ".embed.record.uri": { records: 1 } },
          },
        }),
      });
      return;
    }

    if (options.constellationIntentStatus === 500) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "LinksFailed" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total: 4 }),
    });
  });

  await page.route("**/xrpc/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = decodeURIComponent(url.pathname.split("/xrpc/")[1] || "");

    if (method === "com.atproto.repo.listRecords") {
      if (options.listRecordsAbort) {
        await route.abort("failed");
        return;
      }

      if (options.listRecordsStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "ListRecordsFailed" }),
        });
        return;
      }

      if (options.listRecordsHasNextPage && url.searchParams.get("cursor") === "next-page") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
        body: JSON.stringify({
            cursor: "",
            records: [
              {
                uri: `at://${mockDid}/uk.skyblur.post/e2eblur-next`,
                cid: "bafy-e2e-blur-next",
                value: {
                  ...mockPost,
                  uri: `at://${mockDid}/app.bsky.feed.post/e2enext`,
                  text: "Next page E2E [secret] console post",
                  createdAt: "2026-05-04T01:53:45.000Z",
                },
              },
            ],
          }),
        });
        return;
      }

      if (options.postVariant === "empty") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            cursor: "",
            records: [],
          }),
        });
        return;
      }

      const postByVariant = {
        public: mockPost,
        password: mockPasswordPost,
        restricted: mockRestrictedPost,
        following: mockFollowingPost,
        mutual: mockMutualPost,
        login: mockLoginOnlyPost,
      }[options.postVariant || "public"];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
          body: JSON.stringify({
          cursor: options.listRecordsHasNextPage ? "next-page" : "",
          records: [
            {
              uri: `at://${mockDid}/uk.skyblur.post/e2eblur-${options.postVariant || "public"}`,
              cid: "bafy-e2e-blur",
              value: postByVariant,
            },
          ],
        }),
      });
      return;
    }

    if (method === "com.atproto.sync.getBlob") {
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from([
          0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9,
        ]),
      });
      return;
    }

    if (method === "app.bsky.actor.getProfile") {
      if (options.profileStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "ProfileFailed" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(userProfile),
      });
      return;
    }

    if (method === "com.atproto.repo.getRecord") {
      const collection = url.searchParams.get("collection");
      if (collection === "app.bsky.feed.generator") {
        if (options.noCustomFeed) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "RecordNotFound" }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            uri: `at://${mockDid}/app.bsky.feed.generator/skyblurCustomFeed`,
            cid: "bafy-e2e-feed",
            value: {
              $type: "app.bsky.feed.generator",
              did: "did:web:feed.skyblur.uk",
              displayName: "E2E Custom Feed",
              description: "Existing E2E custom feed description",
              createdAt: "2026-05-04T01:23:45.000Z",
              ...(options.customFeedAvatar
                ? {
                    avatar: {
                      $type: "blob",
                      ref: { $link: "bafy-e2e-existing-avatar" },
                      mimeType: "image/jpeg",
                      size: 18,
                    },
                  }
                : {}),
            },
          }),
        });
        return;
      }

      if (options.noPreference) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "RecordNotFound" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uri: `at://${mockDid}/uk.skyblur.preference/self`,
          cid: "bafy-e2e-pref",
          value: mockPreference,
        }),
      });
      return;
    }

    if (method === "uk.skyblur.post.decryptByCid") {
      if (options.decryptStatus === 403) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "InvalidPassword" }),
        });
        return;
      }

      if (options.decryptStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "ServerError" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: "Decrypted E2E password text",
          additional: "Decrypted E2E password additional",
        }),
      });
      return;
    }

    if (method === "app.bsky.feed.getFeedGenerator") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          view: {
            uri: `at://${mockDid}/app.bsky.feed.generator/skyblurCustomFeed`,
            cid: "bafy-e2e-feed",
            did: "did:web:feed.skyblur.uk",
            displayName: "E2E Custom Feed",
            description: "Existing E2E custom feed description",
            avatar: "",
            likeCount: 0,
            viewer: {},
            indexedAt: "2026-05-04T01:23:45.000Z",
          },
          isOnline: true,
          isValid: true,
        }),
      });
      return;
    }

    if (method === "app.bsky.feed.searchPosts") {
      if (options.replySearchEmpty) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            cursor: "",
            posts: [],
          }),
        });
        return;
      }

      if (options.replySearchHasNextPage && url.searchParams.get("cursor") === "next-reply") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            cursor: "",
            posts: [mockReplyNextPost],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cursor: options.replySearchHasNextPage ? "next-reply" : "",
          posts: options.replySearchHasNextPage
            ? [mockReplyPost, mockExternalRootReplyPost]
            : [mockReplyPost],
        }),
      });
      return;
    }

    if (method === "app.bsky.feed.getPosts") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts: [mockReplyPost],
        }),
      });
      return;
    }

    if (method === "uk.skyblur.post.store") {
      if (options.storeStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "StoreFailed" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stored: true }),
      });
      return;
    }

    if (method === "uk.skyblur.post.getPost") {
      if (options.getPostStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "GetPostFailed" }),
        });
        return;
      }

      if (options.postDetailVariant === "error") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "GetPostFailed" }),
        });
        return;
      }

      if (options.postDetailVariant === "authRequired") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: "○○○○○",
            additional: "",
            errorCode: "AuthRequired",
            createdAt: "2026-05-04T03:32:34.000Z",
            visibility: options.postDetailVisibility || "followers",
          }),
        });
        return;
      }

      if (options.postDetailVariant === "public") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: "Public post detail [secret] text",
            additional: "Public post detail additional",
            createdAt: "2026-05-04T03:12:34.000Z",
            visibility: "public",
          }),
        });
        return;
      }

      if (options.postDetailVariant === "password") {
        const body = JSON.parse(route.request().postData() || "{}");
        if (body?.password || body?.input?.password) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              text: "Unlocked post detail text",
              additional: "Unlocked post detail additional",
              createdAt: "2026-05-04T03:22:34.000Z",
              visibility: "password",
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: "○○○○○",
            additional: "",
            errorCode: "PasswordRequired",
            encryptCid: "bafy-e2e-post-detail-password",
            createdAt: "2026-05-04T03:22:34.000Z",
            visibility: "password",
          }),
        });
        return;
      }

      if (options.restrictedErrorCode) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: "*****",
            additional: "",
            errorCode: options.restrictedErrorCode,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: "Fetched restricted E2E text",
          additional: "Fetched restricted E2E additional",
        }),
      });
      return;
    }

    if (method === "uk.skyblur.post.deleteStored") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true }),
      });
      return;
    }

    if (method === "uk.skyblur.post.encrypt") {
      if (options.encryptStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "E2E encryption failed" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ body: "encrypted-e2e-body" }),
      });
      return;
    }

    if (method === "com.atproto.repo.uploadBlob") {
      if (options.uploadBlobStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "UploadFailed" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          blob: {
            $type: "blob",
            ref: { $link: "bafy-e2e-blob" },
            mimeType: "text/plain",
            size: 18,
          },
        }),
      });
      return;
    }

    if (method === "com.atproto.repo.applyWrites") {
      if (options.applyWritesStatus === 500) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "ApplyWritesFailed" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "MockNotFound", message: method }),
    });
  });
}
