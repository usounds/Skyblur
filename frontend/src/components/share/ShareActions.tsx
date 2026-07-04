"use client";

import { useLocale } from "@/state/Locale";
import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import twitterText from "twitter-text";
import classes from "./ShareActions.module.css";

type ShareActionsProps = {
  url: string;
  text: string;
  fallbackText?: string;
  title?: string;
  compact?: boolean;
  className?: string;
};

const SHARE_SEPARATOR = "\n\n";
// X's composer can exceed twitter-text's result; keep a conservative margin.
const X_SHARE_WEIGHT_LIMIT = 256;
const SHARE_TRUNCATION_GRAPHEME_MARGIN = 10;

function fitsXShareLimit(value: string) {
  return twitterText.parseTweet(value).weightedLength <= X_SHARE_WEIGHT_LIMIT;
}

function truncateForX(value: string, url: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (fitsXShareLimit(`${normalized}${SHARE_SEPARATOR}${url}`)) return normalized;

  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;
  const graphemes = segmenter
    ? Array.from(segmenter.segment(normalized), (segment) => segment.segment)
    : Array.from(normalized);

  let low = 0;
  let high = graphemes.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${graphemes.slice(0, middle).join("").trimEnd()}…`;
    if (fitsXShareLimit(`${candidate}${SHARE_SEPARATOR}${url}`)) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  const truncatedLength = Math.max(0, low - SHARE_TRUNCATION_GRAPHEME_MARGIN);
  return truncatedLength > 0 ? `${graphemes.slice(0, truncatedLength).join("").trimEnd()}…` : "";
}

export function buildShareTextForX(text: string, fallbackText: string, url: string) {
  const source = text.trim() ? text : fallbackText;
  return truncateForX(source, url);
}

export function buildNativeShareData(title: string | undefined, text: string, url: string): ShareData {
  void title;
  return {
    // Keep title and URL fields out of native share data. Some desktop share
    // targets copy title/text/url together, which duplicates metadata and URLs.
    text: text ? `${text}${SHARE_SEPARATOR}${url}` : url,
  };
}

async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function ShareActions({ url, text, fallbackText, title, compact = false, className }: ShareActionsProps) {
  const { localeData: locale } = useLocale();
  const [canNativeShare, setCanNativeShare] = useState(false);
  const shareText = useMemo(() => buildShareTextForX(text, fallbackText ?? locale.Share_DefaultText, url), [fallbackText, locale.Share_DefaultText, text, url]);
  const xIntentUrl = useMemo(() => {
    const params = new URLSearchParams({ text: shareText, url });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }, [shareText, url]);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return;

    try {
      await navigator.share(buildNativeShareData(title, shareText, url));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("Failed to share post", error);
    }
  }, [shareText, title, url]);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(url);
    notifications.show({
      title: locale.Share_CopiedTitle,
      message: locale.Share_CopiedMessage,
      color: "blue",
    });
  }, [locale.Share_CopiedMessage, locale.Share_CopiedTitle, url]);

  return (
    <div className={`${classes.actions} ${compact ? classes.compact : ""} ${className ?? ""}`}>
      {canNativeShare ? (
        <Button className={classes.actionButton} variant="filled" leftSection={<Share2 size={18} />} onClick={handleNativeShare}>
          {locale.Share_NativeLabel}
        </Button>
      ) : (
        <Button className={classes.actionButton} component="a" href={xIntentUrl} target="_blank" rel="noopener noreferrer" variant="filled" leftSection={<ExternalLink size={18} />}>
          {locale.Share_OnX}
        </Button>
      )}
      <Button className={`${classes.actionButton} ${classes.copyButton}`} variant="default" leftSection={<Copy size={18} />} onClick={handleCopy}>
        {locale.Share_CopyUrl}
      </Button>
    </div>
  );
}
