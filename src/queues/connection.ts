import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config.js";

export const EMAIL_QUEUE_NAME = "email-send";

/** BullMQ requires maxRetriesPerRequest: null on its ioredis connection. */
export function createBullConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export const bullConnection = createBullConnection();

export const connectionOptions: ConnectionOptions = bullConnection;

export type EmailJobData = {
  emailId: string;
  userId: string;
  senderId: string;
};

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
