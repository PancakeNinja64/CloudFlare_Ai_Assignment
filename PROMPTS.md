# PROMPTS.md

## 1) Initial Scaffolding Prompt

**Exact text**

```text
Create a Cloudflare project named `cf_ai_interview_coach` using the current Cloudflare Agents starter conventions.

Requirements:
- TypeScript everywhere
- Use Cloudflare Agents SDK with AIChatAgent
- Use Workers AI binding named `AI`
- Use model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- Persist agent state for interview memory
- Build a minimal React frontend with role selector, chat transcript, text input, send button, and memory sidebar.
```

**Why this was used**

Used to establish the baseline file structure and Cloudflare-first architecture quickly.

## 2) Debugging / Compatibility Prompt

**Exact text**

```text
Please adapt this starter to the exact current Cloudflare Agents SDK route and client APIs used by the installed package version.
Keep behavior the same, but fix mismatches around routeAgentRequest usage, AIChatAgent request handling, frontend chat transport, static asset serving, and Vite/Wrangler integration.
Do not redesign; only make it compile and run.
```

**Why this was used**

Used to align generated code with current package APIs and avoid runtime path/protocol mismatches.

## 3) Agent Behavior Design Prompt

**Exact text**

```text
Design the InterviewAgent behavior so each turn does:
1) evaluate latest user answer,
2) output brief coaching feedback,
3) score clarity/depth/communication (1-10),
4) update strengths/focus areas/summary memory,
5) ask exactly one tailored follow-up question.
Keep responses concise and practical.
```

**Why this was used**

Used to keep interaction flow consistent with mock-interview expectations and assignment scope.

## 4) Structured JSON Output Prompt

**Exact text**

```text
Return valid JSON only with:
{
  "evaluation": "string",
  "scores": { "clarity": number, "depth": number, "communication": number },
  "strengths": ["string"],
  "focusAreas": ["string"],
  "sessionSummary": "string",
  "followUpQuestion": "string"
}
No markdown fences. Keep strengths and focusAreas short.
```

**Why this was used**

Used to make parsing deterministic so state updates can be reliable and type-safe.

## 5) UI Build Prompt

**Exact text**

```text
Build a minimal React interview UI with:
- role selector
- chat transcript
- multiline answer input
- send button
- sidebar showing session summary, strengths, focus areas, and last score
Use clean styling and keep implementation straightforward.
```

**Why this was used**

Used to produce a clean, demo-ready interface that directly maps to assignment requirements.
