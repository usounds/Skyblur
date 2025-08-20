
import { isDid } from '@atcute/lexicons/syntax';
import type { Did } from '@atcute/lexicons';

export class ResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolverError';
  }
}

export const resolveHandleViaHttp = async (handle: string): Promise<Did> => {
	const url = new URL('/.well-known/atproto-did', `https://${handle}`);

	const response = await fetch(url, { redirect: 'error' });
	if (!response.ok) {
		throw new ResolverError(`domain is unreachable`);
	}

	const text = await response.text();

	const did = text.split('\n')[0]!.trim();
	if (isDid(did)) {
		return did;
	}

	throw new ResolverError(`failed to resolve ${handle}`);
};


const SUBDOMAIN = '_atproto';
const PREFIX = 'did=';

export const resolveHandleViaDoH = async (handle: string): Promise<Did> => {
	const url = new URL('https://mozilla.cloudflare-dns.com/dns-query');
	url.searchParams.set('type', 'TXT');
	url.searchParams.set('name', `${SUBDOMAIN}.${handle}`);

	const response = await fetch(url, {
		method: 'GET',
		headers: { accept: 'application/dns-json' },
		redirect: 'follow',
	});

	const type = response.headers.get('content-type')?.trim();
	if (!response.ok) {
		const message = type?.startsWith('text/plain') ? await response.text() : `failed to resolve ${handle}`;

		throw new ResolverError(message);
	}

	if (type !== 'application/dns-json') {
		throw new ResolverError(`unexpected response from DoH server`);
	}

	const result = asResult(await response.json());
	const answers = result.Answer?.filter(isAnswerTxt).map(extractTxtData) ?? [];

	for (let i = 0; i < answers.length; i++) {
		// skip if the line does not start with "did="
		if (!answers[i].startsWith(PREFIX)) {
			continue;
		}

		// ensure there is no other entry starting with "did="
		for (let j = i + 1; j < answers.length; j++) {
			if (answers[j].startsWith(PREFIX)) {
				throw new ResolverError(`handle returned multiple did values`);
			}
		}

		const did = answers[i].slice(PREFIX.length);
		if (isDid(did)) {
			return did;
		}

		break;
	}

	throw new ResolverError(`failed to resolve ${handle}`);
};

type Result = { Status: number; Answer?: Answer[] };
const isResult = (result: unknown): result is Result => {
	if (result === null || typeof result !== 'object') {
		return false;
	}

	return (
		'Status' in result &&
		typeof result.Status === 'number' &&
		(!('Answer' in result) || (Array.isArray(result.Answer) && result.Answer.every(isAnswer)))
	);
};
const asResult = (result: unknown): Result => {
	if (!isResult(result)) {
		throw new TypeError(`unexpected DoH response`);
	}

	return result;
};

type Answer = { name: string; type: number; data: string; TTL: number };
const isAnswer = (answer: unknown): answer is Answer => {
	if (answer === null || typeof answer !== 'object') {
		return false;
	}

	return (
		'name' in answer &&
		typeof answer.name === 'string' &&
		'type' in answer &&
		typeof answer.type === 'number' &&
		'data' in answer &&
		typeof answer.data === 'string' &&
		'TTL' in answer &&
		typeof answer.TTL === 'number'
	);
};

type AnswerTxt = Answer & { type: 16 };
const isAnswerTxt = (answer: Answer): answer is AnswerTxt => {
	return answer.type === 16;
};

const extractTxtData = (answer: AnswerTxt): string => {
	return answer.data.replace(/^"|"$/g, '').replace(/\\"/g, '"');
};