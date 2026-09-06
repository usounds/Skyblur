import { NextResponse } from 'next/server';
import { generateMarkdownForPath } from '@/logic/markdownForAgents';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetPath =
    request.headers.get('x-markdown-path') ||
    url.searchParams.get('path') ||
    (url.pathname !== '/api/agent-markdown' ? url.pathname : '/');

  const result = generateMarkdownForPath(targetPath);

  if (!result) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Rough estimation of token count (~4 characters per token)
  const estimatedTokens = Math.ceil(result.markdown.length / 4);

  return new NextResponse(result.markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
      'x-markdown-tokens': String(estimatedTokens),
    },
  });
}
