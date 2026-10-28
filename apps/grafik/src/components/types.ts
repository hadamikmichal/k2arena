export type UserOpt = { id: string; name: string; color: string; employment: string; active?: boolean };

export type ShiftDTO = { id: string; userId: string; date: string; startMin: number; endMin: number; type: string; note: string | null };

export type SessionDTO = {
  id: string;
  seriesId: string | null;
  userId: string;
  name: string;
  kind: string;
  date: string;
  startMin: number;
  endMin: number;
  status: string;
  note: string | null;
};
