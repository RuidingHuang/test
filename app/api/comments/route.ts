import { NextResponse } from "next/server";

import { DemoComment, SAMPLE_COMMENTS } from "@/lib/moderation";

export const runtime = "nodejs";

let fallbackComments: DemoComment[] = [...SAMPLE_COMMENTS];
let fallbackCounter = SAMPLE_COMMENTS.length;

function getModelApiBaseUrl() {
  return process.env.MODEL_API_URL?.replace(/\/$/, "");
}

async function proxyToModelApi(path: string, init?: RequestInit) {
  const baseUrl = getModelApiBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function GET() {
  try {
    const proxied = await proxyToModelApi("/comments");
    if (proxied) {
      return proxied;
    }
  } catch {
    // Fall through to local mock storage.
  }

  return NextResponse.json(fallbackComments);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { text?: unknown; user?: unknown };
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const user = typeof payload.user === "string" ? payload.user.trim() : "You";

  if (!text) {
    return NextResponse.json(
      { detail: "Comment text cannot be empty." },
      { status: 400 },
    );
  }

  try {
    const proxied = await proxyToModelApi("/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, user }),
    });
    if (proxied) {
      return proxied;
    }
  } catch {
    // Fall through to local mock storage.
  }

  fallbackCounter += 1;
  const comment: DemoComment = {
    id: fallbackCounter,
    user: user || "You",
    time: "just now",
    text,
  };
  fallbackComments = [comment, ...fallbackComments];

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE() {
  try {
    const proxied = await proxyToModelApi("/comments/custom", {
      method: "DELETE",
    });
    if (proxied) {
      return proxied;
    }
  } catch {
    // Fall through to local mock storage.
  }

  fallbackComments = [...SAMPLE_COMMENTS];
  fallbackCounter = SAMPLE_COMMENTS.length;

  return NextResponse.json(fallbackComments);
}
