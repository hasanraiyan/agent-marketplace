/** A complete response with a known-length body — every route except streaming chat. */
export interface RuntimeBufferedResponse {
  kind: 'buffered';
  status: number;
  headers: Record<string, string>;
  /** Pre-serialized (e.g. already `JSON.stringify`-ed) — adapters never need to know content-type semantics. */
  body: string;
}

/** An open-ended SSE response — the chat route only. */
export interface RuntimeStreamResponse {
  kind: 'stream';
  status: number;
  headers: Record<string, string>;
  /** Already-formatted SSE frame text chunks (`"data: ...\n\n"`); adapters just write them through as they arrive. */
  body: AsyncIterable<string>;
}

export type RuntimeResponse = RuntimeBufferedResponse | RuntimeStreamResponse;
