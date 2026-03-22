import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ALLOWED_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS_CAP = 600;

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    console.error("Anthropic API error:", error);
    return Response.json(
      { error: "Failed to get response from Claude" },
      { status: 500 }
    );
  }
}
