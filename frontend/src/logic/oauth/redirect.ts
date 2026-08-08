import { getLocalizedPublicPage } from "@/logic/localePath";

type OAuthRedirectLocation = Pick<Location, "href" | "origin" | "pathname">;

export function getOAuthLoginRedirectUrl(location: OAuthRedirectLocation) {
  return getLocalizedPublicPage(location.pathname) === ""
    ? `${location.origin}/console`
    : location.href;
}
