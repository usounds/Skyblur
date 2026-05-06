"use client";

import { useComposerLocaleSwitchGuardStore } from "@/state/ComposerLocaleSwitchGuard";
import { Locales, useLocale, useLocaleStore } from "@/state/Locale";
import { ActionIcon, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { Languages } from "lucide-react";
import React, { useState } from "react";

const LanguageToggle: React.FC = () => {
  const { locale: localeString, localeData: locale } = useLocale();
  const setLocale = useLocaleStore((state) => state.setLocale);
  const hasUnsavedComposerChanges = useComposerLocaleSwitchGuardStore((state) => state.hasUnsavedComposerChanges);
  const [pendingLocale, setPendingLocale] = useState<Locales | null>(null);

  const applyLocale = (newLocale: Locales) => {
    setLocale(newLocale);
  };

  const toggleLocale = () => {
    const newLocale: Locales = localeString === "ja" ? "en" : "ja";
    if (hasUnsavedComposerChanges) {
      setPendingLocale(newLocale);
      return;
    }
    applyLocale(newLocale);
  };

  const closeModal = () => {
    setPendingLocale(null);
  };

  const confirmSwitch = () => {
    if (!pendingLocale) return;
    applyLocale(pendingLocale);
    closeModal();
  };

  return (
    <>
      <ActionIcon
        onClick={toggleLocale}
        variant="default"
        size="lg"
        aria-label="Toggle language"
      >
        <Languages size={20} />
      </ActionIcon>

      <Modal
        opened={pendingLocale !== null}
        onClose={closeModal}
        centered
        title={locale.LocaleSwitchWarningTitle}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {locale.LocaleSwitchWarningDescription}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" color="gray" onClick={closeModal}>
              {locale.LocaleSwitchWarningCancel}
            </Button>
            <Button color="blue" onClick={confirmSwitch}>
              {locale.LocaleSwitchWarningProceed}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default LanguageToggle;
