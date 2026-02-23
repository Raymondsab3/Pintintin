export interface Player {
  id: string;
  name: string;
  losses: number;
}

export interface GameHistoryEntry {
  id: string;
  playerId: string;
  opponents: string[];
  finalScores: Record<string, number>;
  lossType: 'points' | 'foul';
  foulType?: string;
  date: number;
}

export interface ActiveGame {
  id: string;
  players: {
    id: string;
    name: string;
    score: number;
  }[];
  isFinished: boolean;
  winnerId?: string;
  loserId?: string;
  tieForLoser?: boolean;
}

export interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

export type UserRole = 'user' | 'guest' | 'admin' | null;
