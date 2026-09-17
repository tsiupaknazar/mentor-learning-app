import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/current-user";
import { sendFeedbackEmail } from "@/lib/email";
import { handleRouteError } from "@/lib/route-utils";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  category: z.enum(["bug", "idea", "other"]).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  route: z.string().min(1).max(200),
});

/**
 * Feedback goes straight to email (see lib/email.ts) — deliberately no
 * Convex table for this. Route/user context is auto-captured server-side
 * from the authenticated session rather than trusted from the client.
 */
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = requestSchema.parse(await req.json());

    await sendFeedbackEmail({
      message: body.message,
      category: body.category ?? null,
      rating: body.rating ?? null,
      route: body.route,
      userEmail: user.email,
      userDisplayName: user.displayName,
      userId: user._id,
      locale: user.locale ?? "en",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
