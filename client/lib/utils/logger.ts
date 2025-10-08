// lib/utils/logger.ts - COMPREHENSIVE LOGGING SYSTEM

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
type LogCategory =
  | "FLOW"
  | "NODE"
  | "LLM"
  | "CONTEXT"
  | "VALIDATION"
  | "ANALYSIS"
  | "CLASSIFICATION"
  | "PLANNING"
  | "GENERATION"
  | "AGGREGATION"
  | "CLARIFICATION"
  | "RETRY"
  | "TOKEN"
  | "ERROR"
  | "EXECUTION";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, unknown>; // changed from any
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private enableConsole = true;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) Logger.instance = new Logger();
    return Logger.instance;
  }

  /** Core logging method */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) this.logs.shift();

    if (this.enableConsole) {
      const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
      const logData = data ? JSON.stringify(data, null, 2) : "";
      switch (level) {
        case "DEBUG":
          console.log(`${prefix} ${message}`, logData);
          break;
        case "INFO":
          console.info(`${prefix} ${message}`, logData);
          break;
        case "WARN":
          console.warn(`${prefix} ${message}`, logData);
          break;
        case "ERROR":
          console.error(`${prefix} ${message}`, logData);
          break;
      }
    }
  }

  // Flow logging
  logFlowStart(data: Record<string, unknown>): void {
    this.log("INFO", "FLOW", "🚀 Pipeline flow started", data);
  }
  logFlowEnd(data: Record<string, unknown>): void {
    this.log("INFO", "FLOW", "✅ Pipeline flow completed", data);
  }

  // Node logging
  logNodeStart(nodeName: string, data?: Record<string, unknown>): void {
    this.log("INFO", "NODE", `▶️ Node started: ${nodeName}`, data);
  }
  logNodeEnd(nodeName: string, data?: Record<string, unknown>): void {
    this.log("INFO", "NODE", `✔️ Node completed: ${nodeName}`, data);
  }
  logNodeError(
    nodeName: string,
    error: string,
    data?: Record<string, unknown>
  ): void {
    this.log("ERROR", "NODE", `❌ Node failed: ${nodeName} - ${error}`, data);
  }

  // LLM logging
  logLLMCall(context: string, data: Record<string, unknown>): void {
    this.log("INFO", "LLM", `🤖 LLM call: ${context}`, data);
  }
  logLLMResponse(context: string, data: Record<string, unknown>): void {
    this.log("INFO", "LLM", `📥 LLM response: ${context}`, data);
  }

  // Generic category logging
  logContext(message: string, data?: Record<string, unknown>): void {
    this.log("INFO", "CONTEXT", `📝 ${message}`, data);
  }
  logValidation(message: string, data?: Record<string, unknown>): void {
    this.log("INFO", "VALIDATION", `🔍 ${message}`, data);
  }
  logAnalysis(message: string, data: Record<string, unknown>): void {
    this.log("INFO", "ANALYSIS", `🔬 ${message}`, data);
  }
  logClassification(message: string, data: Record<string, unknown>): void {
    this.log("INFO", "CLASSIFICATION", `🏷️ ${message}`, data);
  }
  logPlanning(message: string, data: Record<string, unknown>): void {
    this.log("INFO", "PLANNING", `📋 ${message}`, data);
  }
  logSectionGeneration(message: string, data: Record<string, unknown>): void {
    this.log("INFO", "GENERATION", `✏️ ${message}`, data);
  }
  logAggregation(message: string, data: Record<string, unknown>): void {
    this.log("INFO", "AGGREGATION", `📦 ${message}`, data);
  }
  logClarification(message: string, data: Record<string, unknown>): void {
    this.log("INFO", "CLARIFICATION", `❓ ${message}`, data);
  }
  logRetry(message: string, data: Record<string, unknown>): void {
    this.log("WARN", "RETRY", `🔄 ${message}`, data);
  }
  logTokenCalculation(message: string, data: Record<string, unknown>): void {
    this.log("DEBUG", "TOKEN", `🔢 ${message}`, data);
  }
  logError(message: string, data: Record<string, unknown>): void {
    this.log("ERROR", "ERROR", `💥 ${message}`, data);
  }
  logExecution(message: string, data: Record<string, unknown>): void {
    this.log("INFO", "EXECUTION", `⚙️ ${message}`, data);
  }

  // Utility methods
  getLogs(): LogEntry[] {
    return [...this.logs];
  }
  getLogsByCategory(category: LogCategory): LogEntry[] {
    return this.logs.filter((l) => l.category === category);
  }
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((l) => l.level === level);
  }
  clearLogs(): void {
    this.logs = [];
    this.log("INFO", "EXECUTION", "Logs cleared");
  }

  generateSummary(): string {
    const summary = {
      totalLogs: this.logs.length,
      byLevel: {
        DEBUG: this.logs.filter((l) => l.level === "DEBUG").length,
        INFO: this.logs.filter((l) => l.level === "INFO").length,
        WARN: this.logs.filter((l) => l.level === "WARN").length,
        ERROR: this.logs.filter((l) => l.level === "ERROR").length,
      },
      byCategory: {} as Record<LogCategory, number>,
      errors: this.logs
        .filter((l) => l.level === "ERROR")
        .map((l) => ({ message: l.message, data: l.data })),
    };
    this.logs.forEach(
      (l) =>
        (summary.byCategory[l.category] =
          (summary.byCategory[l.category] || 0) + 1)
    );
    return JSON.stringify(summary, null, 2);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Configuration
  setConsoleOutput(enabled: boolean): void {
    this.enableConsole = enabled;
  }
  setMaxLogs(max: number): void {
    this.maxLogs = max;
  }
}
