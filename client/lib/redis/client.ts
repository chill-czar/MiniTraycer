// lib/redis/client.ts
import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

export const getRedisClient = async (): Promise<RedisClient> => {
  if (client?.isOpen) return client;

  client = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    socket: {
      reconnectStrategy: (retries) =>
        retries > 10
          ? new Error("Max reconnection attempts")
          : Math.min(retries * 100, 3000),
    },
  });

  client.on("error", (err) => console.error("Redis error:", err));
  await client.connect();

  return client;
};

export const closeRedis = async (): Promise<void> => {
  if (client?.isOpen) {
    await client.quit();
    client = null;
  }
};


["SIGINT", "SIGTERM"].forEach((signal) =>
  process.on(signal, async () => {
    await closeRedis();
    process.exit(0);
  })
);
