/**
 * API proxy route — forwards all /api/* requests to the backend.
 *
 * Per CLAUDE.md: use proxy.ts, NOT middleware.ts.
 * Next.js 16 App Router: this is a catch-all route handler.
 *
 * Why proxy instead of calling the API directly from client components?
 * - Keeps API_URL internal (not exposed to the browser)
 * - Handles session cookies transparently (cookie forwarding)
 * - Single CORS policy managed at the API level
 */
import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const targetUrl = `${API_URL}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    // @ts-expect-error — Next.js 16 requires duplex for streaming bodies
    duplex: "half",
  });

  const responseHeaders = new Headers(response.headers);
  // Remove hop-by-hop headers
  responseHeaders.delete("connection");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
