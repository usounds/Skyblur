"use client";

import { useLocale } from "@/state/Locale";
import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import classes from "./ShareActions.module.css";

type ShareActionsProps = {
  url: string;
  text: string;
  fallbackText?: string;
  title?: string;
  compact?: boolean;
  className?: string;
};

const X_SHARE_TEXT_LIMIT = 124;

function truncateGraphemes(value: string, maxLength: number) {
  if (maxLength <= 0) return "";

  const normalized = value.replace(/\s+/g, " ").trim();
  if ([...normalized].length <= maxLength) return normalized;

  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;
  const graphemes = segmenter
    ? Array.from(segmenter.segment(normalized), (segment) => segment.segment)
    : Array.from(normalized);

  return `${graphemes.slice(0, Math.max(0, maxLength - 1)).join("").trimEnd()}…`;
}

export function buildShareTextForX(text: string, fallbackText: string) {
  const source = text.trim() ? text : fallbackText;
  return truncateGraphemes(source, X_SHARE_TEXT_LIMIT);
}

export function buildNativeShareData(title: string | undefined, text: string, url: string): ShareData {
  return {
    title,
    // Bluesky may ignore ShareData.url, while X can use it separately. Supplying
    // both keeps the URL available across share-target implementations.
    text: `${text}\n\n${url}`,
    url,
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
  const shareText = useMemo(() => buildShareTextForX(text, fallbackText ?? locale.Share_DefaultText), [fallbackText, locale.Share_DefaultText, text]);
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
