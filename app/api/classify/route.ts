import { NextResponse } from "next/server";

import { emptyResults, LABELS, ModerationLabel } from "@/lib/moderation";

export const runtime = "nodejs";

type RequestPayload = {
  text?: unknown;
  threshold?: unknown;
};

type ExternalLabelResult = {
  prob?: unknown;
  pred?: unknown;
};

type ExternalClassification = {
  text?: unknown;
  threshold?: unknown;
  results?: Record<string, ExternalLabelResult>;
};

const TERM_WEIGHTS: Record<ModerationLabel, Array<[RegExp, number]>> = {
  toxic: [
    [/\bhate\b/i, 0.72],
    [/\bstupid\b/i, 0.78],
    [/\bidiot\b/i, 0.82],
    [/\bshut up\b/i, 0.67],
    [/\buseless\b/i, 0.58],
  ],
  severe_toxic: [
    [/\bkill\b/i, 0.9],
    [/\bdie\b/i, 0.86],
  ],
  obscene: [
    [/\bfuck\b/i, 0.88],
    [/\bshit\b/i, 0.76],
  ],
  threat: [
    [/\bkill\b/i, 0.91],
    [/\bhurt\b/i, 0.74],
    [/\battack\b/i, 0.8],
  ],
  insult: [
    [/\bidiot\b/i, 0.86],
    [/\bstupid\b/i, 0.8],
    [/\bdumb\b/i, 0.68],
    [/\buseless\b/i, 0.62],
  ],
  identity_hate: [
    [/\brace\b/i, 0.58],
    [/\breligion\b/i, 0.58],
  ],
};

function clampProbability(value: number): number {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(4))));
}

function normalizeThreshold(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function validateText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Text must be a string.");
  }

  const text = value.trim();
  if (!text) {
    throw new Error("Text cannot be empty.");
  }
  if (text.length > 1000) {
    throw new Error("Text must be 1000 characters or fewer.");
  }

  return text;
}

function buildMockClassification(text: string, threshold: number) {
  const results = emptyResults();

  for (const label of LABELS) {
    let score = 0.04;

    for (const [pattern, weight] of TERM_WEIGHTS[label]) {
      if (pattern.test(text)) {
        score = Math.max(score, weight);
      }
    }

    if (label === "toxic") {
      score = Math.max(
        score,
        results.insult.prob * 0.85,
        results.threat.prob * 0.8,
        results.obscene.prob * 0.8,
      );
    }

    const prob = clampProbability(score);
    results[label] = {
      prob,
      pred: prob >= threshold ? 1 : 0,
    };
  }

  const predictedLabels = LABELS.filter((label) => results[label].pred === 1);

  return {
    text,
    threshold,
    results,
    predictedLabels,
    source: "mock" as const,
  };
}

function normalizeExternalResponse(
  data: ExternalClassification,
  fallbackText: string,
  fallbackThreshold: number,
) {
  const results = emptyResults();
  const externalResults = data.results ?? {};

  for (const label of LABELS) {
    const raw = externalResults[label];
    const prob = typeof raw?.prob === "number" ? raw.prob : 0;
    const pred =
      typeof raw?.pred === "number" ? raw.pred : prob >= fallbackThreshold ? 1 : 0;

    results[label] = {
      prob: clampProbability(prob),
      pred: pred ? 1 : 0,
    };
  }

  return {
    text: typeof data.text === "string" ? data.text : fallbackText,
    threshold:
      typeof data.threshold === "number" ? data.threshold : fallbackThreshold,
    results,
    predictedLabels: LABELS.filter((label) => results[label].pred === 1),
    source: "model-api" as const,
  };
}

async function classifyWithModelApi(text: string, threshold: number) {
  const baseUrl = process.env.MODEL_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(`${baseUrl}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, threshold }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Model API request failed.");
  }

  const data = (await response.json()) as ExternalClassification;
  return normalizeExternalResponse(data, text, threshold);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RequestPayload;
    const text = validateText(payload.text);
    const threshold = normalizeThreshold(payload.threshold);

    const modelResult = await classifyWithModelApi(text, threshold);
    return NextResponse.json(
      modelResult ?? buildMockClassification(text, threshold),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to classify text.";
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
