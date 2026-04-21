import { useEffect, useMemo, useState } from "react";

type DashboardState = {
  selectedRole: string;
  strengths: string[];
  focusAreas: string[];
  lastScore: { clarity: number; depth: number; communication: number } | null;
  sessionSummary: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ROLES = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Product Manager",
  "Solutions Engineer",
];

const AGENT_BASE = "/agent";
const DEMO_ANSWER =
  "I am a software engineer with four years of experience building TypeScript services and React applications. In my current role, I led a reliability project that reduced API error rates by 35% through better observability and retry design. I am interested in this role because I enjoy solving user-facing problems with measurable business impact.";

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardState>({
    selectedRole: "Software Engineer",
    strengths: [],
    focusAreas: [],
    lastScore: null,
    sessionSummary: "",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    void hydrate();
  }, []);

  async function hydrate() {
    setError(null);
    try {
      const dashboardRes = await fetch(`${AGENT_BASE}/state`);
      if (!dashboardRes.ok) {
        throw new Error("Could not load dashboard state.");
      }
      setDashboard((await dashboardRes.json()) as DashboardState);

      const openingRes = await fetch(`${AGENT_BASE}/opening-question`);
      if (!openingRes.ok) {
        throw new Error("Could not load opening question.");
      }
      const data = (await openingRes.json()) as { question: string };
      setMessages([{ role: "assistant", content: data.question }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize the app.");
    }
  }

  async function onRoleChange(role: string) {
    setError(null);
    try {
      const res = await fetch(`${AGENT_BASE}/role`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        throw new Error("Unable to update selected role.");
      }
      setDashboard((prev) => ({ ...prev, selectedRole: role }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role update failed.");
    }
  }

  async function sendMessage() {
    if (!canSend) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch(`${AGENT_BASE}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error(await extractError(res, "The coach could not process your answer."));
      }

      if (!res.body) {
        const fallback = await res.text();
        setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamed = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          streamed += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, content: streamed };
            }
            return next;
          });
        }
      }

      await refreshDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send answer.");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateFollowUp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_BASE}/regenerate-follow-up`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await extractError(res, "Could not regenerate follow-up question."));
      }
      const text = await res.text();
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate follow-up question.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard() {
    const dashboardRes = await fetch(`${AGENT_BASE}/state`);
    if (!dashboardRes.ok) {
      throw new Error("Could not refresh dashboard.");
    }
    const data = (await dashboardRes.json()) as DashboardState;
    setDashboard(data);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Interview Coach</h1>
        <label>
          Target role
          <select value={dashboard.selectedRole} onChange={(e) => void onRoleChange(e.target.value)}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <div className="panel">
          <h2>Session summary</h2>
          <p>{dashboard.sessionSummary || "No summary yet."}</p>
        </div>

        <div className="panel">
          <h2>Strengths</h2>
          <ul>
            {dashboard.strengths.length ? dashboard.strengths.map((s) => <li key={s}>{s}</li>) : <li>None yet</li>}
          </ul>
        </div>

        <div className="panel">
          <h2>Focus areas</h2>
          <ul>
            {dashboard.focusAreas.length ? dashboard.focusAreas.map((s) => <li key={s}>{s}</li>) : <li>None yet</li>}
          </ul>
        </div>

        <div className="panel">
          <h2>Last score</h2>
          {dashboard.lastScore ? (
            <ul>
              <li>Clarity: {dashboard.lastScore.clarity}/10</li>
              <li>Depth: {dashboard.lastScore.depth}/10</li>
              <li>Communication: {dashboard.lastScore.communication}/10</li>
            </ul>
          ) : (
            <p>No score yet.</p>
          )}
        </div>
      </aside>

      <main className="chat-area">
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="chat-list">
          {messages.map((message, idx) => (
            <div key={idx} className={`bubble ${message.role}`}>
              <strong>{message.role === "assistant" ? "Coach" : "You"}</strong>
              <p>{message.content}</p>
            </div>
          ))}
          {loading && <div className="bubble assistant"><p>Thinking...</p></div>}
        </div>

        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your answer here..."
            rows={5}
          />
          <div className="composer-actions">
            <button type="button" onClick={() => setInput(DEMO_ANSWER)} disabled={loading}>
              Try demo answer
            </button>
            <button type="button" onClick={() => void regenerateFollowUp()} disabled={loading}>
              Regenerate follow-up question
            </button>
            <button disabled={!canSend} onClick={() => void sendMessage()}>
              Send answer
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

async function extractError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}
