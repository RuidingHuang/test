import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getModelApiBaseUrl() {
  return process.env.MODEL_API_URL?.replace(/\/$/, "");
}

export async function POST(request: Request) {
  const baseUrl = getModelApiBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { detail: "MODEL_API_URL is required to send feedback to the model host." },
      { status: 503 },
    );
  }

  try {
    const payload = await request.json();
    const response = await fetch(`${baseUrl}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: response.status });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach model host feedback service." },
      { status: 502 },
    );
  }
}
