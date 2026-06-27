export type CtfDifficulty = "easy" | "medium" | "hard" | "sovereign";

export interface CtfChallenge {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: CtfDifficulty;
  points: number;
  description_md: string;
  prompt: string;
  hint: string | null;
  is_published: boolean;
  solves: number;
  created_at: string;
}

export interface CtfUserSolve {
  challenge_id: string;
  is_correct: boolean;
  awarded_points: number;
  created_at: string;
}

export type CtfVerifyStatus = "solved" | "already_solved" | "wrong";

export interface CtfVerifyResponse {
  ok: boolean;
  status?: CtfVerifyStatus;
  points?: number;
  total_solves?: number;
  error?: string;
}

export const DIFFICULTY_LABEL: Record<CtfDifficulty, string> = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
  sovereign: "SOVEREIGN",
};

export const DIFFICULTY_TONE: Record<CtfDifficulty, string> = {
  easy: "text-acid border-acid/30 bg-acid/[0.06]",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/[0.06]",
  hard: "text-threat border-threat/30 bg-threat/[0.06]",
  sovereign: "text-violet-300 border-violet-400/30 bg-violet-400/[0.06]",
};
