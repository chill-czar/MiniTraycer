// lib/utils/modelManager.ts
import { getRedisClient } from "../redis/client";
import { ModelConfig, APIKeyInfo } from "@/types/api";
import { RateLimitManager } from "./rateLimitManager";

const MODEL_CONFIG_KEY = "models:config";

export class ModelManager {
  private static instance: ModelManager;
  private rateLimitManager = RateLimitManager.getInstance();

  private constructor() {}

  static getInstance = () => {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  };

  initialize = async (): Promise<void> => {
    const apiKeys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
    ].filter(Boolean) as string[];

    if (apiKeys.length === 0) {
      throw new Error("No API keys configured");
    }

    const createKeyInfo = (key: string): APIKeyInfo => ({
      key,
      status: "active",
      usage: {
        rpm: 0,
        rpd: 0,
        tpm: 0,
        tpd: 0,
        lastReset: Date.now(),
      },
    });

    const models: ModelConfig[] = [
      {
        modelName: "llama-3.3-70b-versatile",
        apiKeys: apiKeys.map(createKeyInfo),
        priority: 4,
        limits: { rpm: 30, rpd: 1000, tpm: 12000, tpd: 100000 },
      },
      {
        modelName: "groq/compound",
        apiKeys: apiKeys.map(createKeyInfo),
        priority: 1,
        limits: { rpm: 30, rpd: 250, tpm: 70000, tpd: Infinity },
      },
      {
        modelName: "groq/compound-mini",
        apiKeys: apiKeys.map(createKeyInfo),
        priority: 2,
        limits: { rpm: 30, rpd: 250, tpm: 70000, tpd: Infinity },
      },
      {
        modelName: "meta-llama/llama-4-scout-17b-16e-instruct",
        apiKeys: apiKeys.map(createKeyInfo),
        priority: 3,
        limits: { rpm: 30, rpd: 1000, tpm: 30000, tpd: 500000 },
      },
      {
        modelName: "meta-llama/llama-guard-4-12b",
        apiKeys: apiKeys.map(createKeyInfo),
        priority: 8,
        limits: { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
      },
      {
        modelName: "meta-llama/llama-prompt-guard-2-22m",
        apiKeys: apiKeys.map(createKeyInfo),
        priority: 9,
        limits: { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
      },
      {
        modelName: "meta-llama/llama-prompt-guard-2-86m",
        apiKeys: apiKeys.map(createKeyInfo),
        priority: 10,
        limits: { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
      },
    ];

    const redis = await getRedisClient();
    await redis.set(MODEL_CONFIG_KEY, JSON.stringify(models));
  };

  private getConfigs = async (): Promise<ModelConfig[]> => {
    const redis = await getRedisClient();
    const data = await redis.get(MODEL_CONFIG_KEY);

    if (!data) {
      await this.initialize();
      return this.getConfigs();
    }

    return JSON.parse(data);
  };

  getBestAvailableKey = async (
    estimatedTokens: number = 1000
  ): Promise<{ model: string; key: string; config: ModelConfig } | null> => {
    const models = await this.getConfigs();
    const sorted = models.sort((a, b) => a.priority - b.priority);

    for (const model of sorted) {
      for (const keyInfo of model.apiKeys) {
        if (keyInfo.status === "cooldown") continue;

        if (
          await this.rateLimitManager.isInCooldown(model.modelName, keyInfo.key)
        ) {
          continue;
        }

        const { allowed } = await this.rateLimitManager.canMakeRequest(
          model.modelName,
          keyInfo.key,
          model.limits,
          estimatedTokens
        );

        if (allowed) {
          return {
            model: model.modelName,
            key: keyInfo.key,
            config: model,
          };
        }
      }
    }

    return null;
  };

  reportUsage = async (
    model: string,
    key: string,
    tokens: number
  ): Promise<void> => {
    await this.rateLimitManager.updateMetrics(model, key, tokens);
  };

  markFailed = async (
    model: string,
    key: string,
    cooldownMs: number = 60000
  ): Promise<void> => {
    await this.rateLimitManager.setCooldown(model, key, cooldownMs);
  };

  getNextKey = async (
    currentModel: string,
    currentKey: string,
    estimatedTokens: number = 1000
  ): Promise<{ model: string; key: string; config: ModelConfig } | null> => {
    const models = await this.getConfigs();

    const sameModel = models.find((m) => m.modelName === currentModel);
    if (sameModel) {
      for (const keyInfo of sameModel.apiKeys) {
        if (keyInfo.key === currentKey) continue;

        if (
          await this.rateLimitManager.isInCooldown(
            sameModel.modelName,
            keyInfo.key
          )
        ) {
          continue;
        }

        const { allowed } = await this.rateLimitManager.canMakeRequest(
          sameModel.modelName,
          keyInfo.key,
          sameModel.limits,
          estimatedTokens
        );

        if (allowed) {
          return {
            model: sameModel.modelName,
            key: keyInfo.key,
            config: sameModel,
          };
        }
      }
    }

    const fallbacks = models
      .filter((m) => m.modelName !== currentModel)
      .sort((a, b) => a.priority - b.priority);

    for (const model of fallbacks) {
      for (const keyInfo of model.apiKeys) {
        if (
          await this.rateLimitManager.isInCooldown(model.modelName, keyInfo.key)
        ) {
          continue;
        }

        const { allowed } = await this.rateLimitManager.canMakeRequest(
          model.modelName,
          keyInfo.key,
          model.limits,
          estimatedTokens
        );

        if (allowed) {
          return {
            model: model.modelName,
            key: keyInfo.key,
            config: model,
          };
        }
      }
    }

    return null;
  };
}
