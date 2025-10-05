// lib/utils/rateLimitManager.ts
import { getRedisClient } from "../redis/client";
import { RateLimitMetrics, ModelLimits } from "@/types/generatePlan";

const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export class RateLimitManager {
  private static instance: RateLimitManager;
  private prefix = "rl:";

  private constructor() {}

  static getInstance = () => {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager();
    }
    return RateLimitManager.instance;
  };

  private getKey = (model: string, key: string) =>
    `${this.prefix}${model}:${Buffer.from(key)
      .toString("base64")
      .slice(0, 10)}`;

  private getCooldownKey = (model: string, key: string) =>
    `${this.prefix}cooldown:${this.getKey(model, key)}`;

  getMetrics = async (
    model: string,
    apiKey: string
  ): Promise<RateLimitMetrics> => {
    const redis = await getRedisClient();
    const data = await redis.get(this.getKey(model, apiKey));

    if (!data) {
      return {
        rpm: 0,
        rpd: 0,
        tpm: 0,
        tpd: 0,
        lastReset: Date.now(),
      };
    }

    return JSON.parse(data);
  };

  updateMetrics = async (
    model: string,
    apiKey: string,
    tokens: number
  ): Promise<void> => {
    const redis = await getRedisClient();
    const key = this.getKey(model, apiKey);
    const metrics = await this.getMetrics(model, apiKey);

    const now = Date.now();
    const minuteElapsed = now - metrics.lastReset > ONE_MINUTE;
    const dayElapsed = now - metrics.lastReset > ONE_DAY;

    if (minuteElapsed) {
      metrics.rpm = 0;
      metrics.tpm = 0;
    }

    if (dayElapsed) {
      metrics.rpd = 0;
      metrics.tpd = 0;
      metrics.lastReset = now;
    }

    metrics.rpm += 1;
    metrics.rpd += 1;
    metrics.tpm += tokens;
    metrics.tpd += tokens;

    await redis.setEx(key, Math.ceil(ONE_DAY / 1000), JSON.stringify(metrics));
  };

  canMakeRequest = async (
    model: string,
    apiKey: string,
    limits: ModelLimits,
    estimatedTokens: number
  ): Promise<{ allowed: boolean; reason?: string }> => {
    const metrics = await this.getMetrics(model, apiKey);

    if (metrics.rpm >= limits.rpm) {
      return {
        allowed: false,
        reason: `RPM limit: ${metrics.rpm}/${limits.rpm}`,
      };
    }
    if (metrics.rpd >= limits.rpd) {
      return {
        allowed: false,
        reason: `RPD limit: ${metrics.rpd}/${limits.rpd}`,
      };
    }
    if (metrics.tpm + estimatedTokens > limits.tpm) {
      return { allowed: false, reason: `TPM limit would exceed` };
    }
    if (metrics.tpd + estimatedTokens > limits.tpd) {
      return { allowed: false, reason: `TPD limit would exceed` };
    }

    return { allowed: true };
  };

  setCooldown = async (
    model: string,
    apiKey: string,
    durationMs: number
  ): Promise<void> => {
    const redis = await getRedisClient();
    await redis.setEx(
      this.getCooldownKey(model, apiKey),
      Math.ceil(durationMs / 1000),
      Date.now().toString()
    );
  };

  isInCooldown = async (model: string, apiKey: string): Promise<boolean> => {
    const redis = await getRedisClient();
    const cooldown = await redis.get(this.getCooldownKey(model, apiKey));
    return cooldown !== null;
  };
}
