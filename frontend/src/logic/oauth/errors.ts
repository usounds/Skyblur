type OAuthErrorLike = {
  error?: unknown;
  errorDescription?: unknown;
  message?: unknown;
};

export function isInvalidGrantInvalidCodeError(error: unknown) {
  const err = error as OAuthErrorLike | null | undefined;
  if (!err || typeof err !== "object") return false;

  return (
    err.error === "invalid_grant" &&
    (
      err.errorDescription === "Invalid code" ||
      err.message === "Invalid code"
    )
  );
}
