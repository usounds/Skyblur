export type BracketValidationError =
  | 'full-width-bracket'
  | 'duplicate-or-unclosed-bracket'
  | 'unbalanced-bracket'
  | 'bracket-in-simple-mode';

export type PostTextTransformInput = {
  text: string;
  simpleMode: boolean;
  limitConsecutive?: boolean;
  omitChar: string;
};

export type PostTextTransformResult = {
  inputText: string;
  recordText: string;
  blurredText: string;
  hasFullWidthBrackets: boolean;
  validationError?: BracketValidationError;
};

export function containsFullWidthBrackets(input: string): boolean {
  return /［|］/.test(input);
}

export function normalizeFullWidthBrackets(input: string): string {
  return input.replace(/［/g, '[').replace(/］/g, ']');
}

export function hasDuplicateOrUnclosedBrackets(input: string): boolean {
  let insideBracket = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '[') {
      if (insideBracket) return true;
      insideBracket = true;
    } else if (char === ']' && insideBracket) {
      insideBracket = false;
    }
  }

  return insideBracket;
}

export function hasUnbalancedBrackets(input: string): boolean {
  let openBracketsCount = 0;
  let closeBracketsCount = 0;

  for (const char of input) {
    if (char === '[') {
      openBracketsCount++;
    } else if (char === ']') {
      closeBracketsCount++;
    }
  }

  return openBracketsCount !== closeBracketsCount;
}

export function buildRecordText(text: string, simpleMode: boolean): string {
  if (!simpleMode) return text;

  const lines = text.split('\n');
  if (lines.length <= 1) return text;

  return lines.map((line, index) => {
    let nextLine = line;

    if (index === 1) {
      nextLine = `[${nextLine}`;
    }
    if (index === lines.length - 1) {
      nextLine = `${nextLine}]`;
    }

    return nextLine;
  }).join('\n');
}

export function buildBlurredText(recordText: string, omitChar: string, limitConsecutive = false): string {
  return recordText.replace(/\[(.*?)\]/gs, (_, match: string) => {
    let replaced = match.replace(/./g, omitChar);
    if (limitConsecutive && replaced.length > 5) {
      replaced = omitChar.repeat(5);
    }
    return replaced;
  });
}

export function validatePostText(text: string, simpleMode: boolean): BracketValidationError | undefined {
  if (containsFullWidthBrackets(text)) {
    return 'full-width-bracket';
  }

  if (hasDuplicateOrUnclosedBrackets(text)) {
    return 'duplicate-or-unclosed-bracket';
  }

  if (hasUnbalancedBrackets(text)) {
    return 'unbalanced-bracket';
  }

  if (simpleMode && text && (text.includes('[') || text.includes(']'))) {
    return 'bracket-in-simple-mode';
  }

  return undefined;
}

export function transformPostText(input: PostTextTransformInput): PostTextTransformResult {
  const recordText = buildRecordText(input.text, input.simpleMode);

  return {
    inputText: input.text,
    recordText,
    blurredText: buildBlurredText(recordText, input.omitChar, input.limitConsecutive),
    hasFullWidthBrackets: containsFullWidthBrackets(input.text),
    validationError: validatePostText(input.text, input.simpleMode),
  };
}
