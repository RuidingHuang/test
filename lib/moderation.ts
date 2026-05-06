export const LABELS = [
  "toxic",
  "severe_toxic",
  "obscene",
  "threat",
  "insult",
  "identity_hate",
] as const;

export type ModerationLabel = (typeof LABELS)[number];

export type LabelResult = {
  prob: number;
  pred: number;
};

export type ClassificationResponse = {
  text: string;
  threshold: number;
  results: Record<ModerationLabel, LabelResult>;
  predictedLabels: ModerationLabel[];
  source: "mock" | "model-api";
};

export type DemoComment = {
  id: number;
  user: string;
  time: string;
  text: string;
};

export type RuntimeComment = DemoComment & {
  classification: ClassificationResponse | null;
};

export const SAMPLE_COMMENTS: DemoComment[] = [
  {
    id: 1,
    user: "User1",
    time: "sample #1",
    text: "This update is clear and helpful. The new dashboard makes the workflow easier.",
  },
  {
    id: 2,
    user: "User2",
    time: "sample #2",
    text: "You are an idiot if you think this is acceptable.",
  },
  {
    id: 3,
    user: "User3",
    time: "sample #3",
    text: "The interface looks clean, but the filtering settings need better defaults.",
  },
  {
    id: 4,
    user: "User4",
    time: "sample #4",
    text: "I hate this broken feature and I want it removed immediately.",
  },
  {
    id: 5,
    user: "User5",
    time: "sample #5",
    text: "Great work on the moderation demo. It feels fast and practical.",
  },
  {
    id: 6,
    user: "User6",
    time: "sample #6",
    text: "Shut up, this is stupid and useless.",
  },
];

export function emptyResults(): Record<ModerationLabel, LabelResult> {
  return LABELS.reduce(
    (acc, label) => {
      acc[label] = { prob: 0, pred: 0 };
      return acc;
    },
    {} as Record<ModerationLabel, LabelResult>,
  );
}
