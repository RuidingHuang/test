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

const CLIENT_NAME_KEY = "comment-moderation-client-name";
const COMMENT_BATCH_SIZE = 5;

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

async function fetchSharedComments(): Promise<DemoComment[]> {
  const response = await fetch("/api/comments", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load shared comments.");
  }

  return (await response.json()) as DemoComment[];
}

async function createSharedComment(
  text: string,
  user: string,
): Promise<DemoComment> {
  const response = await fetch("/api/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, user }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(data?.detail ?? "Unable to save comment.");
  }

  return (await response.json()) as DemoComment;
}

async function clearSharedCustomComments(): Promise<DemoComment[]> {
  const response = await fetch("/api/comments", {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Unable to clear comments.");
  }

  return (await response.json()) as DemoComment[];
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("You");
  const [nameDraft, setNameDraft] = useState("");
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [visibleCommentCount, setVisibleCommentCount] =
    useState(COMMENT_BATCH_SIZE);

  useEffect(() => {
    const storedName = window.localStorage.getItem(CLIENT_NAME_KEY)?.trim();
    if (storedName) {
      setClientName(storedName);
      return;
    }

    setIsNameDialogOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      try {
        const sharedComments = await fetchSharedComments();
        if (!cancelled) {
          setComments(sharedComments);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load shared comments.",
          );
        }
      }
    }

    void loadComments();
    const intervalId = window.setInterval(() => {
      void loadComments();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function classifyAll() {
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
  const visibleComments = runtimeComments.slice(0, visibleCommentCount);
  const hasMoreComments = visibleCommentCount < runtimeComments.length;

  function toggleLabel(label: ModerationLabel) {
    setBlockedLabels((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = newComment.trim();
    if (!text) {
      setError("Comment text cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createSharedComment(text, clientName);
      setNewComment("");
      setComments(await fetchSharedComments());
      setVisibleCommentCount((current) =>
        Math.max(current, COMMENT_BATCH_SIZE),
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save comment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetBlockedLabels() {
    setBlockedLabels([...LABELS]);
  }

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = nameDraft.trim() || "Anonymous";
    window.localStorage.setItem(CLIENT_NAME_KEY, nextName);
    setClientName(nextName);
    setIsNameDialogOpen(false);
  }

  async function clearCustomComments() {
    setError(null);
    try {
      setComments(await clearSharedCustomComments());
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Unable to clear comments.",
      );
    }
  }

  return (
    <main className="app-shell">
      {isNameDialogOpen ? (
        <div className="name-modal-backdrop" role="presentation">
          <form
            className="name-modal"
            onSubmit={handleNameSubmit}
            aria-label="Enter your name"
          >
            <h2>Enter your name</h2>
            <p>Your comments will use this name.</p>
            <input
              autoFocus
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Your name"
            />
            <button type="submit" className="primary-button full-width">
              Continue
            </button>
          </form>
        </div>
      ) : null}

      <section className="topbar">
        <div>
          <p className="eyebrow">Vercel Preview</p>
          <div className="title-row">
            <h1>Comment Moderation Demo</h1>
            <img
              className="title-qr"
              src="/QRcode.svg"
              alt="Comment moderation demo QR code"
            />
          </div>
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
                {isSubmitting ? "Adding..." : "Add comment"}
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

            {visibleComments.map((comment) => {
              const predictedLabels =
                comment.classification?.predictedLabels ?? [];
              const hidden = shouldHideComment(predictedLabels, blockedLabels);
              const visibleTags = predictedLabels;

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
                  </div>
                </article>
              );
            })}

            {hasMoreComments ? (
              <button
                type="button"
                className="show-more-button"
                onClick={() =>
                  setVisibleCommentCount((current) =>
                    Math.min(
                      current + COMMENT_BATCH_SIZE,
                      runtimeComments.length,
                    ),
                  )
                }
              >
                Show 5 more comments
              </button>
            ) : null}
          </section>
        </div>

        <aside className="settings-panel">
          <details className="control-panel settings-dropdown">
            <summary>Setting</summary>
            <div className="settings-content">
              <div>
                <h2>Settings</h2>
                <p>
                  A comment is hidden when at least one selected label is
                  predicted above the threshold.
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
            </div>
          </details>
        </aside>
      </section>
    </main>
  );
}
