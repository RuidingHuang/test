import { mkdir, stat, appendFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { LABELS, ModerationLabel } from "@/lib/moderation";

export const runtime = "nodejs";

type FeedbackRow = {
  clean_text?: unknown;
} & Partial<Record<ModerationLabel, unknown>>;

type FeedbackPayload = {
  rows?: unknown;
};

const HEADER = ["clean_text", ...LABELS];

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function normalizeRow(row: FeedbackRow): Record<string, string | number> {
  const text =
    typeof row.clean_text === "string" ? row.clean_text.trim() : "";

  if (!text) {
    throw new Error("Feedback row clean_text cannot be empty.");
  }

  return LABELS.reduce(
    (normalized, label) => {
      normalized[label] = row[label] === 1 ? 1 : 0;
      return normalized;
    },
    { clean_text: text } as Record<string, string | number>,
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile() && fileStat.size > 0;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as FeedbackPayload;

    if (!Array.isArray(payload.rows)) {
      return NextResponse.json(
        { detail: "Feedback rows must be an array." },
        { status: 400 },
      );
    }

    const rows = payload.rows.map((row) => normalizeRow(row as FeedbackRow));
    if (rows.length === 0) {
      return NextResponse.json(
        { detail: "No feedback rows were provided." },
        { status: 400 },
      );
    }

    const dataDirectory = path.resolve(process.cwd(), "..", "data");
    const feedbackPath = path.join(dataDirectory, "feedback.csv");
    await mkdir(dataDirectory, { recursive: true });

    const includeHeader = !(await fileExists(feedbackPath));
    const csvLines = rows.map((row) =>
      HEADER.map((column) => csvCell(row[column])).join(","),
    );

    const csvContent = `${includeHeader ? `${HEADER.join(",")}\n` : ""}${csvLines.join(
      "\n",
    )}\n`;

    await appendFile(feedbackPath, csvContent, "utf8");

    return NextResponse.json({
      count: rows.length,
      path: feedbackPath,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to import feedback.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
