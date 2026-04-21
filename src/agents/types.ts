export type Score = {
  clarity: number;
  depth: number;
  communication: number;
};

export type DashboardState = {
  selectedRole: string;
  strengths: string[];
  focusAreas: string[];
  lastScore: Score | null;
  sessionSummary: string;
};
