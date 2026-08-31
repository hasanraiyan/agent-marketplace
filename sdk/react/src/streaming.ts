/**
 * SSE transport for chat streams, with a React Native fallback.
 *
 * On the web, `fetch` gives a streaming `response.body` and we read it with a
 * ReadableStream reader. React Native's `fetch` is the whatwg-fetch polyfill
 * over XMLHttpRequest: `response.body` is `undefined`, and the promise only
 * settles once the entire response has arrived. That means the check cannot be
 * "call fetch, then see whether body exists" - by that point the whole stream
 * has already been buffered and the chance to stream is gone. The transport has
 * to be chosen *before* the request is made.
 *
 * XMLHttpRequest itself does stream everywhere React Native runs: it appends to
 * `responseText` and fires `readyState === 3` (LOADING) on every chunk, which is
 * all an SSE consumer needs. So the RN path issues the request over raw XHR and
 * hands back the same reader interface the fetch path does, leaving callers
 * unaware of which one they got.
 */

/** Minimal reader interface, mirroring the shape of a ReadableStream reader. */
export interface SSEReader {
  /** Resolves with the next decoded chunk, or `{ done: true }` at end of stream. */
  read(): Promise<{ done: boolean; value?: string }>;
  /** Aborts the underlying request. */
  cancel(): void;
}

export interface SSEStream {
  status: number;
  ok: boolean;
  getHeader(name: string): string | null;
  /** Present only when `ok` is false, so callers can surface the server's message. */
  errorText?: string;
  reader: SSEReader;
}

export interface OpenSSEOptions {
  url: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

/**
 * Whether `fetch` on this platform yields a streaming body.
 *
 * `navigator.product === 'ReactNative'` is the long-standing marker React
 * Native sets, and is checked rather than feature-detecting `ReadableStream`:
 * newer RN versions do expose a global `ReadableStream` while still leaving
 * `response.body` undefined, so the presence of the type says nothing about
 * whether fetch will populate it.
 */
export function supportsStreamingFetch(): boolean {
  if (typeof navigator !== 'undefined' && (navigator as { product?: string }).product === 'ReactNative') {
    return false;
  }
  return typeof fetch !== 'undefined' && typeof ReadableStream !== 'undefined';
}

/** Wraps a whatwg ReadableStream reader so it decodes to strings. */
function fetchReader(response: Response, controller: AbortController): SSEReader {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');

  return {
    async read() {
      const { done, value } = await reader.read();
      if (done) return { done: true };
      return { done: false, value: decoder.decode(value, { stream: true }) };
    },
    cancel() {
      controller.abort();
      void reader.cancel().catch(() => {});
    },
  };
}

/**
 * Issues the request over XMLHttpRequest and exposes new text as it arrives.
 *
 * XHR keeps the whole response in `responseText` and only ever appends, so each
 * chunk is the slice past what has already been handed out.
 */
function xhrStream(opts: OpenSSEOptions): Promise<SSEStream> {
  return new Promise<SSEStream>((resolveStream, rejectStream) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', opts.url);
    for (const [key, val] of Object.entries(opts.headers)) xhr.setRequestHeader(key, val);

    let consumed = 0;
    let finished = false;
    let failure: Error | null = null;
    // Chunks that arrived before the consumer asked for them, and the pending
    // read waiting for one - only one of the two is ever non-empty.
    const queue: string[] = [];
    let waiting: ((r: { done: boolean; value?: string }) => void) | null = null;
    let waitingReject: ((e: Error) => void) | null = null;
    let headersResolved = false;

    const pump = () => {
      const text = xhr.responseText;
      if (text.length <= consumed) return;
      const chunk = text.slice(consumed);
      consumed = text.length;

      if (waiting) {
        const resolve = waiting;
        waiting = null;
        waitingReject = null;
        resolve({ done: false, value: chunk });
      } else {
        queue.push(chunk);
      }
    };

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      failure = err ?? null;
      if (waiting) {
        const resolve = waiting;
        const reject = waitingReject;
        waiting = null;
        waitingReject = null;
        if (err && reject) reject(err);
        else resolve({ done: true });
      }
    };

    const reader: SSEReader = {
      read() {
        if (queue.length > 0) {
          return Promise.resolve({ done: false, value: queue.shift() });
        }
        if (finished) {
          return failure ? Promise.reject(failure) : Promise.resolve({ done: true });
        }
        return new Promise((resolve, reject) => {
          waiting = resolve;
          waitingReject = reject;
        });
      },
      cancel() {
        finish();
        xhr.abort();
      },
    };

    // Headers are available from readyState 2, which is what lets a non-2xx
    // response be reported without waiting for the body to finish.
    const resolveHeaders = () => {
      if (headersResolved) return;
      headersResolved = true;
      const ok = xhr.status >= 200 && xhr.status < 300;
      resolveStream({
        status: xhr.status,
        ok,
        getHeader: (name: string) => xhr.getResponseHeader(name),
        reader,
      });
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 2) {
        resolveHeaders();
      } else if (xhr.readyState === 3) {
        resolveHeaders();
        pump();
      } else if (xhr.readyState === 4) {
        resolveHeaders();
        pump();
        finish();
      }
    };

    xhr.onerror = () => {
      const err = new Error('Network request failed');
      if (!headersResolved) rejectStream(err);
      finish(err);
    };
    xhr.ontimeout = () => {
      const err = new Error('Network request timed out');
      if (!headersResolved) rejectStream(err);
      finish(err);
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        finish();
      } else {
        opts.signal.addEventListener('abort', () => {
          finish();
          xhr.abort();
        });
      }
    }

    xhr.send(opts.body);
  });
}

/**
 * Opens an SSE stream, using whichever transport this platform can stream over.
 */
export async function openSSEStream(opts: OpenSSEOptions): Promise<SSEStream> {
  if (!supportsStreamingFetch()) {
    return xhrStream(opts);
  }

  const controller = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort());
  }

  const response = await fetch(opts.url, {
    method: 'POST',
    headers: opts.headers,
    body: opts.body,
    signal: controller.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Stream failed');
    return {
      status: response.status,
      ok: false,
      errorText,
      getHeader: (name: string) => response.headers.get(name),
      reader: { read: async () => ({ done: true }), cancel: () => controller.abort() },
    };
  }

  if (!response.body) {
    // A streaming-capable platform that still gave no body - fall back to the
    // buffered text rather than failing outright.
    const text = await response.text();
    let handed = false;
    return {
      status: response.status,
      ok: true,
      getHeader: (name: string) => response.headers.get(name),
      reader: {
        read: async () => (handed ? { done: true } : ((handed = true), { done: false, value: text })),
        cancel: () => controller.abort(),
      },
    };
  }

  return {
    status: response.status,
    ok: true,
    getHeader: (name: string) => response.headers.get(name),
    reader: fetchReader(response, controller),
  };
}
