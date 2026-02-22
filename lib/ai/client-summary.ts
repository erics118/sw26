import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ClientQuoteSummary {
  status: string;
  route: string;
  date: string;
  total?: number;
  currency?: string;
}

export interface ClientActionInput {
  client_name: string;
  quotes: ClientQuoteSummary[];
}

export async function generateClientAction(
  input: ClientActionInput,
): Promise<{ summary: string; next_action: string }> {
  const fallback = {
    summary: `${input.client_name} has ${input.quotes.length} quote(s) on file.`,
    next_action: "Follow up on the most recent quote.",
  };

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: `You are a charter account manager. Given a client's quote history, write a 1-sentence account summary and a 1-sentence recommended next action. Return ONLY valid JSON: {"summary": "...", "next_action": "..."}. No markdown.`,
      messages: [
        {
          role: "user",
          content: `Client: ${input.client_name}\nQuote history (most recent first):\n${JSON.stringify(input.quotes, null, 2)}`,
        },
      ],
    });

    const raw =
      message.content[0]?.type === "text" ? message.content[0].text : "{}";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      summary?: string;
      next_action?: string;
    };
    return {
      summary: parsed.summary ?? fallback.summary,
      next_action: parsed.next_action ?? fallback.next_action,
    };
  } catch {
    return fallback;
  }
}
