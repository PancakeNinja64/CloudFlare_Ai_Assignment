# cf_ai_interview_coach

`cf_ai_interview_coach` is a Cloudflare-native mock interview coach that runs an interactive Q&A session and keeps persistent coaching memory across turns. It uses Workers AI for evaluation, an Agent running on a Durable Object for orchestration/state, and a lightweight React client for chat and dashboard controls.

## Demo Screenshot

_Placeholder: add screenshot at `docs/demo.png` after recording a local run._

## Architecture

- **Workers AI (LLM)**: Uses `env.AI.run` with `@cf/meta/llama-3.3-70b-instruct-fp8-fast` to evaluate answers and generate follow-up interview questions.
- **Agents + Durable Objects (state/coordination)**: `InterviewAgent` persists role context, strengths, focus areas, score, and summary while serving HTTP routes for chat/state updates.
- **React frontend (user input)**: Provides role selection, chat transcript, answer composer, and dashboard view of coaching memory.

## Assignment Mapping

- **LLM requirement**: Workers AI model invocation in `InterviewAgent`.
- **Workflow/coordination requirement**: Cloudflare Agent (`AIChatAgent`-based) hosted as Durable Object.
- **User input requirement**: React chat UI (`src/client/App.tsx`).
- **Memory/state requirement**: Persistent Durable Object state (`selectedRole`, strengths/focus areas, scores, summary).

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Validate build:
   ```bash
   npm run build
   ```
3. Start local development:
   ```bash
   npm run cf:dev
   ```
4. Open the URL printed by Wrangler (typically `http://127.0.0.1:8787`).

> Note: for full Workers AI behavior in dev, authenticate Wrangler and run remote dev if needed.

## Deployment

1. Ensure Wrangler is authenticated:
   ```bash
   npx wrangler login
   ```
2. Deploy:
   ```bash
   npm run deploy
   ```

## Example Usage Flow

1. Open the app and choose a target role.
2. Read the opening question generated for that role.
3. Submit an interview answer in chat.
4. Review feedback, scores, strengths, focus areas, and follow-up question.
5. Optionally regenerate a follow-up question and continue iterating.

## Future Improvements

- Voice input using browser speech recognition.
- Saved multi-session interview history.
- Dedicated scoring visualization component.
- Harder follow-up mode for advanced practice.
- Next-day practice-plan workflow generation.
