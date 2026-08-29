export type EmailStatus = "scheduled" | "sent" | "failed";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
};

export type Sender = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  maxEmailsPerHour: number | null;
};

export type EmailRow = {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  sentAt: string | null;
  previewUrl: string | null;
  error: string | null;
  createdAt: string;
};

export type EmailListResponse = {
  items: EmailRow[];
  total: number;
  page: number;
  limit: number;
};

export type ScheduleRequest = {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmailsMs: number;
  maxEmailsPerHour?: number;
};

export type ScheduleResponse = {
  ids: string[];
  count: number;
};

export type DevAuthResponse = {
  token: string;
  user: User;
};

export type ApiResponse<T> = T | { error: string };

export type AuthPayload = {
  sub: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
};
