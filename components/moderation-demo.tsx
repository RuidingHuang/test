"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  ClassificationResponse,
  DemoComment,
  LABELS,
  ModerationLabel,
  RuntimeComment,
  SAMPLE_COMMENTS,
} from "@/lib/moderation";

async function classifyText(
  text: string,
  threshold: number,
): Promise<ClassificationResponse> {
  const response = await fetch("/api/classify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, threshold }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(data?.detail ?? "Unable to classify comment.");
  }

  return (await response.json()) as ClassificationResponse;
}

function shouldHideComment(
  predictedLabels: ModerationLabel[],
  blockedLabels: ModerationLabel[],
): boolean {
  if (blockedLabels.length === 0) {
    return false;
  }
  return predictedLabels.some((label) => blockedLabels.includes(label));
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function initials(user: string): string {
  return user.slice(0, 1).toUpperCase() || "U";
}

export function ModerationDemo() {
  const [comments, setComments] = useState<DemoComment[]>(SAMPLE_COMMENTS);
  const [runtimeComments, setRuntimeComments] = useState<RuntimeComment[]>(
    SAMPLE_COMMENTS.map((comment) => ({ ...comment, classification: null })),
  );
  const [blockedLabels, setBlockedLabels] = useState<ModerationLabel[]>([
    ...LABELS,
  ]);
  const [threshold, setThreshold] = useState(0.5);
  const [newComment, setNewComment] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function classifyAll() {
      setIsClassifying(true);
      setError(null);

      try {
        const classified = await Promise.all(
          comments.map(async (comment) => ({
            ...comment,
            classification: await classifyText(comment.text, threshold),
          })),
        );

        if (!cancelled) {
          setRuntimeComments(classified);
        }
      } catch (classificationError) {
        if (!cancelled) {
          setError(
            classificationError instanceof Error
              ? classificationError.message
              : "Unable to refresh classifications.",
          );
          setRuntimeComments(
            comments.map((comment) => ({
              ...comment,
              classification: null,
            })),
          );
        }
      } finally {
        if (!cancelled) {
          setIsClassifying(false);
        }
      }
    }

    void classifyAll();

    return () => {
      cancelled = true;
    };
  }, [comments, threshold]);

  const hiddenCount = useMemo(
    () =>
      runtimeComments.filter((comment) =>
        shouldHideComment(
          comment.classification?.predictedLabels ?? [],
          blockedLabels,
        ),
      ).length,
    [blockedLabels, runtimeComments],
  );

  const source = runtimeComments.find((comment) => comment.classification)
    ?.classification?.source;

  function toggleLabel(label: ModerationLabel) {
    setBlockedLabels((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = newComment.trim();
    if (!text) {
      setError("Comment text cannot be empty.");
      return;
    }

    const nextComment: DemoComment = {
      id: Date.now(),
      user: "You",
      time: "just now",
      text,
    };

    setComments((current) => [nextComment, ...current]);
    setNewComment("");
  }

  function resetBlockedLabels() {
    setBlockedLabels([...LABELS]);
  }

  function clearCustomComments() {
    setComments(SAMPLE_COMMENTS);
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Vercel Preview</p>
          <h1>Comment Moderation Demo</h1>
          <p className="lede">
            A Next.js version of the Gradio prototype, ready for Vercel and
            prepared for an external BERT inference API.
          </p>
        </div>
        <aside className="summary-panel" aria-label="Current settings">
          <div className="summary-title">Current settings</div>
          <div className="summary-row">
            <span>Blocked labels</span>
            <strong>{blockedLabels.length || "None"}</strong>
          </div>
          <div className="summary-row">
            <span>Threshold</span>
            <strong>{threshold.toFixed(2)}</strong>
          </div>
          <div className="summary-row">
            <span>Total comments</span>
            <strong>{runtimeComments.length}</strong>
          </div>
          <div className="summary-row">
            <span>Hidden comments</span>
            <strong>{hiddenCount}</strong>
          </div>
          <div className="source-pill">
            {source === "model-api" ? "Model API connected" : "Mock classifier"}
          </div>
        </aside>
      </section>

      <section className="content-grid">
        <div className="left-column">
          <form className="control-panel add-panel" onSubmit={handleSubmit}>
            <div>
              <h2>Add comment</h2>
              <p>Add a new comment to the top of the list.</p>
            </div>
            <textarea
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              placeholder="Type a new comment here..."
              rows={5}
            />
            <div className="button-row">
              <button type="submit" className="primary-button">
                Add comment
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={clearCustomComments}
              >
                Clear custom comments
              </button>
            </div>
          </form>

          <section className="comments-wrap" aria-live="polite">
            {error ? <div className="error-box">{error}</div> : null}
            {isClassifying ? (
              <div className="loading-line">Refreshing classifications...</div>
            ) : null}

            {runtimeComments.map((comment) => {
              const predictedLabels =
                comment.classification?.predictedLabels ?? [];
              const hidden = shouldHideComment(predictedLabels, blockedLabels);
              const visibleTags = predictedLabels.filter((label) =>
                blockedLabels.includes(label),
              );

              return (
                <article className="comment-card" key={comment.id}>
                  <div className="avatar">{initials(comment.user)}</div>
                  <div className="comment-body">
                    <div className="comment-meta">
                      <span className="username">{comment.user}</span>
                      <span className="dot" aria-hidden="true">
                        .
                      </span>
                      <span>{comment.time}</span>
                    </div>

                    <div className="tag-row">
                      {visibleTags.length === 0 ? (
                        <span className="tag safe-tag">safe</span>
                      ) : (
                        visibleTags.map((label) => (
                          <span className="tag harmful-tag" key={label}>
                            {label}
                          </span>
                        ))
                      )}
                    </div>

                    {hidden ? (
                      <div className="hidden-comment">
                        <div className="hidden-title">Comment hidden</div>
                        <p>This comment may be harmful.</p>
                        <details>
                          <summary>Show original</summary>
                          <div className="revealed-text">{comment.text}</div>
                        </details>
                      </div>
                    ) : (
                      <p className="comment-text">{comment.text}</p>
                    )}

                    {comment.classification ? (
                      <div className="prob-grid">
                        {LABELS.map((label) => (
                          <div className="prob-item" key={label}>
                            <span>{label}</span>
                            <strong>
                              {formatPercent(
                                comment.classification?.results[label].prob ??
                                  0,
                              )}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        </div>

        <aside className="control-panel settings-panel">
          <div>
            <h2>Settings</h2>
            <p>
              A comment is hidden when at least one selected label is predicted
              above the threshold.
            </p>
          </div>

          <fieldset className="checkbox-list">
            <legend>Blocked labels</legend>
            {LABELS.map((label) => (
              <label className="checkbox-item" key={label}>
                <input
                  type="checkbox"
                  checked={blockedLabels.includes(label)}
                  onChange={() => toggleLabel(label)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <label className="slider-control">
            <span>Threshold</span>
            <strong>{threshold.toFixed(2)}</strong>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
            />
          </label>

          <button
            type="button"
            className="primary-button full-width"
            onClick={resetBlockedLabels}
          >
            Reset blocked labels
          </button>
        </aside>
      </section>
    </main>
  );
}
