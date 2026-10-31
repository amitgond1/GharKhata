let csrf = '';
export const setCsrf = (value: string) => {
  csrf = value;
};
export async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD'].includes(options.method)) {
    headers.set('x-csrf-token', csrf);
    if (!headers.has('Idempotency-Key')) headers.set('Idempotency-Key', crypto.randomUUID());
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new Error('Connection lost. This action is unconfirmed. Reconnect and retry.');
  }
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: 'The server is unavailable. Please try again.' }));
    throw new Error(body.error || 'Request failed');
  }
  return response.json();
}
export const post = (path: string, body: any, method = 'POST', idempotency?: string) =>
  api(path, {
    method,
    body: JSON.stringify(body),
    headers: idempotency ? { 'Idempotency-Key': idempotency } : undefined,
  });
export interface Snapshot {
  project: any;
  records: any[];
  vendors: any[];
  attachments: any[];
  summary: {
    budget: number;
    cost: number;
    cash: number;
    outstanding: number;
    advances: number;
    remaining: number;
    overrun: number;
    bills: any[];
    payments: any[];
    category: Record<string, number>;
    stage: Record<string, number>;
    floor: Record<string, number>;
    monthly: { month: string; cost: number; cash: number }[];
  };
}
