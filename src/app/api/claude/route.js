import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ALLOWED_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS_CAP = 600;

// Server-side rate limit: per-user, resets hourly
const rateLimitMap = new Map(); // userId -> { count, resetAt }
const RATE_LIMIT_PER_HOUR = 40;

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_HOUR) return false;
  entry.count++;
  return true;
}

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(userId)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { messages, max_tokens = 400, system } = await request.json();

    const response = await client.messages.create({
      model: ALLOWED_MODEL,
      max_tokens: Math.min(Number(max_tokens) || 400, MAX_TOKENS_CAP),
      messages,
      ...(system ? { system } : {}),
    });

    return Response.json({ content: response.content });
  } catch (error) {
    console.error("Anthropic API error:", error?.status, error?.message || error);
    const status = error?.status || 500;
    const detail = error?.error?.type || error?.message || "unknown";
    return Response.json(
      { error: `Claude API error (${status}): ${detail}` },
      { status }
    );
  }
}
