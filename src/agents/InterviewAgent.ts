import { AIChatAgent } from "@cloudflare/agents/ai-chat-agent";
import type { Message } from "ai";
import { SYSTEM_PROMPT, buildUserPrompt, OPENING_QUESTION } from "./prompts";
import type { DashboardState, Score } from "./types";

export interface Env {
  AI: Ai;
}

type EvaluationPayload = {
  evaluation: string;
  scores: Score;
  strengths: string[];
  focusAreas: string[];
  sessionSummary: string;
  followUpQuestion: string;
};

type PersistedState = DashboardState & {
  lastAnswer: string;
};

const DEFAULT_STATE: PersistedState = {
  selectedRole: "Software Engineer",
  strengths: [],
  focusAreas: [],
  lastScore: null,
  sessionSummary: "",
  lastAnswer: "",
};

export class InterviewAgent extends AIChatAgent<Env> {
  initialState: PersistedState = DEFAULT_STATE;

  async onConnect() {
    if (!this.state) {
      this.setState(DEFAULT_STATE);
    }
  }

  async setRole(role: string) {
    const current = await this.getFullState();
    const next: PersistedState = { ...current, selectedRole: role };
    this.setState(next);
    return { ok: true, selectedRole: next.selectedRole };
  }

  async getDashboardState(): Promise<DashboardState> {
    const state = await this.getFullState();
    return toDashboardState(state);
  }

  async getOpeningQuestion() {
    const state = await this.getFullState();
    return { question: OPENING_QUESTION(state.selectedRole) };
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, "");

    if (path === "state" && request.method === "GET") {
      return Response.json(await this.getDashboardState());
    }

    if (path === "dashboard" && request.method === "GET") {
      return Response.json(await this.getDashboardState());
    }

    if (path === "role" && request.method === "POST") {
      const body = (await request.json()) as { role?: string };
      if (!body.role) {
        return new Response("Missing role", { status: 400 });
      }
      return Response.json(await this.setRole(body.role));
    }

    if (path === "opening-question" && request.method === "GET") {
      return Response.json(await this.getOpeningQuestion());
    }

    if (path === "chat" && request.method === "POST") {
      try {
        const body = (await request.json()) as { message?: string };
        if (!body.message?.trim()) {
          return Response.json({ error: "Missing message" }, { status: 400 });
        }
        const result = await this.generateInterviewFeedback(body.message, true);
        return new Response(result, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "content-encoding": "identity",
            "transfer-encoding": "chunked",
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message === "AI unavailable") {
          return Response.json({ error: "Workers AI is unavailable in this environment." }, { status: 502 });
        }
        return Response.json({ error: "Invalid request body" }, { status: 400 });
      }
    }

    if (path === "regenerate-follow-up" && request.method === "POST") {
      const result = await this.regenerateFollowUpQuestion();
      if ("error" in result) {
        return Response.json(result, { status: 400 });
      }
      return new Response(`Next question: ${result.question}`, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return super.onRequest(request);
  }

  async onChatMessage(onFinish: (args: { response: { messages: Message[] } }) => Promise<void>) {
    const latestUser = [...this.messages].reverse().find((m) => m.role === "user");
    if (!latestUser || typeof latestUser.content !== "string") {
      return new Response("No user message found.", { status: 400 });
    }

    const current = await this.getFullState();
    const userPrompt = buildUserPrompt({
      selectedRole: current.selectedRole,
      priorSummary: current.sessionSummary,
      strengths: current.strengths,
      focusAreas: current.focusAreas,
      latestAnswer: latestUser.content,
    });

    const aiResponse = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = extractText(aiResponse);
    const parsed = safeParse(rawText);

    const nextState = buildNextState(current, parsed, latestUser.content, true);
    this.setState(nextState);

    const assistantText = parsed
      ? [
          `Feedback: ${parsed.evaluation}`,
          `Scores: clarity ${parsed.scores.clarity}/10, depth ${parsed.scores.depth}/10, communication ${parsed.scores.communication}/10.`,
          parsed.strengths?.length ? `Strengths: ${parsed.strengths.join(", ")}.` : "",
          parsed.focusAreas?.length ? `Focus areas: ${parsed.focusAreas.join(", ")}.` : "",
          `Next question: ${parsed.followUpQuestion}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "I couldn't structure the evaluation cleanly. Give one concrete example with measurable impact, and we will continue.";

    await onFinish({
      response: {
        messages: [
          ...this.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: assistantText,
          } as Message,
        ],
      },
    });

    return streamText(assistantText);
  }

  private async getFullState(): Promise<PersistedState> {
    return (this.state as PersistedState | undefined) ?? DEFAULT_STATE;
  }

  private async generateInterviewFeedback(answer: string, updateMemory: boolean): Promise<string> {
    const current = await this.getFullState();
    const userPrompt = buildUserPrompt({
      selectedRole: current.selectedRole,
      priorSummary: current.sessionSummary,
      strengths: current.strengths,
      focusAreas: current.focusAreas,
      latestAnswer: answer,
    });

    let aiResponse: unknown;
    try {
      aiResponse = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
    } catch {
      throw new Error("AI unavailable");
    }

    const parsed = safeParse(extractText(aiResponse));
    const nextState = buildNextState(current, parsed, answer, updateMemory);
    if (updateMemory) {
      this.setState(nextState);
    }

    return parsed
      ? [
          `Feedback: ${parsed.evaluation}`,
          `Scores: clarity ${parsed.scores.clarity}/10, depth ${parsed.scores.depth}/10, communication ${parsed.scores.communication}/10.`,
          parsed.strengths?.length ? `Strengths: ${parsed.strengths.join(", ")}.` : "",
          parsed.focusAreas?.length ? `Focus areas: ${parsed.focusAreas.join(", ")}.` : "",
          `Next question: ${parsed.followUpQuestion}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "I could not parse the evaluation response. Please retry with a concrete example and measurable impact.";
  }

  private async regenerateFollowUpQuestion(): Promise<{ question: string } | { error: string }> {
    const current = await this.getFullState();
    if (!current.lastAnswer) {
      return { error: "No prior answer available to regenerate from." };
    }
    try {
      const text = await this.generateInterviewFeedback(current.lastAnswer, false);
      const marker = "Next question:";
      const idx = text.lastIndexOf(marker);
      const question = idx >= 0 ? text.slice(idx + marker.length).trim() : text.trim();
      return { question };
    } catch {
      return { error: "Unable to generate follow-up question right now." };
    }
  }
}

function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.response === "string") return r.response;
    if (typeof r.result === "string") return r.result;
  }
  return JSON.stringify(result ?? "");
}

function safeParse(text: string): EvaluationPayload | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const candidate = start >= 0 && end > start ? text.slice(start, end + 1) : text;
    return JSON.parse(candidate) as EvaluationPayload;
  } catch {
    return null;
  }
}

function dedupe(items: string[]) {
  return [...new Set(items.map((x) => x.trim()).filter(Boolean))];
}

function toDashboardState(state: PersistedState): DashboardState {
  return {
    selectedRole: state.selectedRole,
    strengths: state.strengths,
    focusAreas: state.focusAreas,
    lastScore: state.lastScore,
    sessionSummary: state.sessionSummary,
  };
}

function buildNextState(
  current: PersistedState,
  parsed: EvaluationPayload | null,
  latestAnswer: string,
  updateMemory: boolean,
): PersistedState {
  return {
    selectedRole: current.selectedRole,
    strengths: updateMemory
      ? dedupe([...(current.strengths ?? []), ...(parsed?.strengths ?? [])]).slice(0, 6)
      : current.strengths,
    focusAreas: updateMemory
      ? dedupe([...(current.focusAreas ?? []), ...(parsed?.focusAreas ?? [])]).slice(0, 6)
      : current.focusAreas,
    lastScore: updateMemory ? parsed?.scores ?? current.lastScore : current.lastScore,
    sessionSummary: updateMemory ? parsed?.sessionSummary ?? current.sessionSummary : current.sessionSummary,
    lastAnswer: latestAnswer,
  };
}

function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const parts = text.split(/(\s+)/).filter(Boolean);
  let idx = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (idx >= parts.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(parts[idx]));
      idx += 1;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-encoding": "identity",
      "transfer-encoding": "chunked",
    },
  });
}
