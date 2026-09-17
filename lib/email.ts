import "server-only";

/**
 * Server-only feedback delivery. Deliberately NOT persisted to Convex —
 * feedback goes straight to email instead of sitting in a table someone
 * has to remember to check. Uses Resend's REST API directly via fetch
 * (no SDK) to avoid adding a dependency for what's a single POST request.
 *
 * If email delivery ever needs to be more robust than "best effort" (e.g.
 * retries, delivery tracking), that's the point to reach for the `resend`
 * npm package or a queue — not before.
 */

export class EmailConfigError extends Error {}
export class EmailRequestError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
  }
}

export interface FeedbackEmailInput {
  message: string;
  /** "bug" | "idea" | "other" — free-form category the learner picked, if any. */
  category?: string | null;
  /** 1-5 star rating, if the learner attached one (e.g. post-review thumbs). */
  rating?: number | null;
  route: string;
  userEmail: string;
  userDisplayName: string;
  userId: string;
  locale: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendFeedbackEmail(input: FeedbackEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL_TO;
  const from = process.env.FEEDBACK_EMAIL_FROM;
  if (!apiKey || !to || !from) {
    throw new EmailConfigError(
      "Feedback email is not configured — set RESEND_API_KEY, FEEDBACK_EMAIL_TO, and FEEDBACK_EMAIL_FROM (see .env.example)."
    );
  }

  const subjectBits = ["Feedback"];
  if (input.category) subjectBits.push(`[${input.category}]`);
  subjectBits.push(`— ${input.route}`);
  const subject = subjectBits.join(" ");

  const html = `
    <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #111;">
      <p><strong>From:</strong> ${escapeHtml(input.userDisplayName)} (${escapeHtml(input.userEmail)})</p>
      <p><strong>Route:</strong> ${escapeHtml(input.route)}</p>
      ${input.rating != null ? `<p><strong>Rating:</strong> ${input.rating}/5</p>` : ""}
      ${input.category ? `<p><strong>Category:</strong> ${escapeHtml(input.category)}</p>` : ""}
      <p><strong>Locale:</strong> ${escapeHtml(input.locale)}</p>
      <p><strong>User id:</strong> ${escapeHtml(input.userId)}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 12px 0;" />
      <p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>
    </div>
  `.trim();

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: input.userEmail,
        subject,
        html,
      }),
    });
  } catch (err) {
    throw new EmailRequestError("Could not reach the email provider.", err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmailRequestError(`Email provider returned ${res.status}.`, body);
  }
}
