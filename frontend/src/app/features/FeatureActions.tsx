"use client";

import Link from "next/link";
import { Button } from "@mantine/core";
import { Pencil } from "lucide-react";
import classes from "./FeaturesPage.module.css";

type FeatureActionsProps = {
  primaryAction: string;
  secondaryAction: string;
};

type FeaturePrimaryActionProps = {
  label: string;
};

export function FeatureActions({ primaryAction, secondaryAction }: FeatureActionsProps) {
  return (
    <div className={classes.actions}>
      <FeaturePrimaryAction label={primaryAction} />
      <Button component={Link} href="/" variant="default">
        {secondaryAction}
      </Button>
    </div>
  );
}

export function FeaturePrimaryAction({ label }: FeaturePrimaryActionProps) {
  return (
    <Button component={Link} href="/console/posts/new" leftSection={<Pencil size={16} />}>
      {label}
    </Button>
  );
}
