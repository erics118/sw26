import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface QuoteExplanationInput {
  route: string;
  aircraft_category: string;
  total: number;
  subtotal: number;
  margin_pct: number;
  fuel_cost: number;
  top_cost_driver: string;
}

export async function generateQuoteExplanation(
  input: QuoteExplanationInput,
): Promise<{ explanation: string }> {
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: `You are a charter quote analyst. Explain this quote in 2-3 sentences for a non-expert client. Be conversational and concise. Return ONLY valid JSON: {"explanation": "..."}. No markdown.`,
      messages: [
        {
          role: "user",
          content: `Quote details:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const raw =
      message.content[0]?.type === "text" ? message.content[0].text : "{}";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return { explanation: "" };
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      explanation?: string;
    };
    return { explanation: parsed.explanation ?? "" };
  } catch {
    return { explanation: "" };
  }
}
