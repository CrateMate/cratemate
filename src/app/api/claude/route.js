import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { messages, max_tokens = 400, model = "claude-haiku-4-5-20251001" } =
      await request.json();

    const response = await client.messages.create({
      model,
      max_tokens,
      messages,
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
