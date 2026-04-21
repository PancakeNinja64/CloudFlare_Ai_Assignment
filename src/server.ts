import { getAgentByName, routeAgentRequest } from "@cloudflare/agents";
import { InterviewAgent } from "./agents/InterviewAgent";

export { InterviewAgent };

type Env = {
  AI: Ai;
  ASSETS: Fetcher;
  InterviewAgent: DurableObjectNamespace<InterviewAgent>;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/agent/chat" && request.method === "POST") {
      return forwardToInterviewAgent(request, env, "/chat");
    }

    if (url.pathname === "/agent/state" && request.method === "GET") {
      return forwardToInterviewAgent(request, env, "/state");
    }

    if (url.pathname === "/agent/role" && request.method === "POST") {
      return forwardToInterviewAgent(request, env, "/role");
    }

    if (url.pathname === "/agent/opening-question" && request.method === "GET") {
      return forwardToInterviewAgent(request, env, "/opening-question");
    }

    if (url.pathname === "/agent/regenerate-follow-up" && request.method === "POST") {
      return forwardToInterviewAgent(request, env, "/regenerate-follow-up");
    }

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }
    return env.ASSETS.fetch(request);
  },
};

async function forwardToInterviewAgent(request: Request, env: Env, path: string): Promise<Response> {
  const stub = await getAgentByName(env.InterviewAgent, "default");
  const url = new URL(request.url);
  url.pathname = path;
  return stub.fetch(
    new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    }),
  );
}
