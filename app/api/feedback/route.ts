import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { detail: "Feedback CSV downloads are handled in the browser." },
    { status: 410 },
  );
}
