import { NextResponse } from "next/server";

// request.json() throws on a malformed body. Un-caught that surfaced as a 500; callers
// use this to return a clean 400 instead.
export async function parseJson(request: Request): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
}

export function badJson() {
  return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
}

export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

// Wraps a route handler so an unexpected throw becomes a logged 500 with a generic body,
// instead of an unhandled rejection. Never returns the error message to the client.
export async function handleRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    console.error("[api] unhandled route error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// User-supplied text going into a RegExp must be escaped, or a crafted pattern can hang
// the request with catastrophic backtracking.
export function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
