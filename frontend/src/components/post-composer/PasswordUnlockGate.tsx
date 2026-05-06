"use client";

import { UkSkyblurPostDecryptByCid } from "@/lexicon/UkSkyblur";
import { useLocale } from "@/state/Locale";
import { useSensitiveDraftStore } from "@/state/SensitiveDraft";
import { Alert, Button, PasswordInput, Stack, Text } from "@mantine/core";
import { FormEvent, useState } from "react";

type PasswordUnlockGateProps = {
  did: string;
  encryptCid: string;
  onUnlocked: (result: { text: string; additional: string; password: string; encryptKey: string }) => void;
};

export function PasswordUnlockGate({ did, encryptCid, onUnlocked }: PasswordUnlockGateProps) {
  const { localeData: locale } = useLocale();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const setSensitiveDraft = useSensitiveDraftStore((state) => state.setSensitiveDraft);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    /* istanbul ignore next -- The submit button is disabled while an unlock request is active. */
    if (isUnlocking) return;

    /* istanbul ignore next -- The submit button is disabled until a password is present. */
    if (!password) {
      setErrorMessage(locale.DeleteList_DecryptRequired);
      return;
    }
    /* istanbul ignore next -- EditPostLoader rejects password records without an encrypt CID before rendering this gate. */
    if (!encryptCid) {
      setErrorMessage(locale.PostComposer_PasswordUnlockDataMissing);
      return;
    }

    setIsUnlocking(true);
    setErrorMessage("");

    try {
      const response = await fetch("/xrpc/uk.skyblur.post.decryptByCid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          repo: did,
          cid: encryptCid,
          password,
        }),
      });

      if (!response.ok) {
        setErrorMessage(response.status === 403 ? locale.DeleteList_DecryptErrorMessage : locale.Post_Restricted_ContentMissing);
        return;
      }

      const data: UkSkyblurPostDecryptByCid.Output = await response.json();
      const additional = data.additional ?? "";
      setSensitiveDraft({
        text: data.text,
        additional,
        password,
        encryptKey: password,
      });
      onUnlocked({
        text: data.text,
        additional,
        password,
        encryptKey: password,
      });
    } catch {
      /* istanbul ignore next -- Network exceptions are covered by API-level failure handling; E2E exercises HTTP failures. */
      setErrorMessage(locale.Post_Restricted_ListCheckFailed);
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <Text fw={700}>{locale.PostComposer_PasswordUnlockTitle}</Text>
        <Text size="sm" c="dimmed">
          {locale.PostComposer_PasswordUnlockDescription}
        </Text>
        <PasswordInput
          value={password}
          placeholder="p@ssw0rd"
          onChange={(event) => setPassword(event.currentTarget.value)}
          disabled={isUnlocking}
          autoComplete="current-password"
        />
        {errorMessage && <Alert color="red" variant="light">{errorMessage}</Alert>}
        <Button type="submit" loading={isUnlocking} disabled={!password || isUnlocking}>
          {locale.DeleteList_DecryptButton}
        </Button>
      </Stack>
    </form>
  );
}
