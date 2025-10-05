// lib/chains/pipeline.ts
import {
  ChatMessage,
  generatePlanRequest,
  generatePlanResponse,
  PlanData,
} from "@/types/generatePlan";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { PROMPTS } from "./prompts";

/**
 * Type definition for project classification
 */
type ProjectType =
  | "frontend"
  | "backend"
  | "fullstack"
  | "library"
  | "infra"
  | "other";

/**
 * Enhanced PipelineState with all required fields and defaults
 */
const PipelineStateAnnotation = Annotation.Root({
  prompt: Annotation<string>,
  history: Annotation<ChatMessage[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  needsInfo: Annotation<boolean>({
    reducer: (_prev, newVal) => newVal,
    default: () => false,
  }),
  clarifyingPrompt: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  type: Annotation<ProjectType>({
    reducer: (_prev, newVal) => newVal,
    default: () => "other" as ProjectType,
  }),
  techStack: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  optimizedPrompt: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  observations: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  approach: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  steps: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  fileStructure: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  markdownPlan: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  retryCount: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 2,
  }),
  lastError: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  failedSection: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
});

export type PipelineState = typeof PipelineStateAnnotation.State;

/**
 * LLM client configuration
 */
const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.15,
  maxTokens: 2048,
});

/**
 * Retry configuration with exponential backoff
 */
const RETRY_CONFIG = {
  baseDelay: 1000,
  maxDelay: 5000,
  multiplier: 2,
} as const;

/**
 * Helper: Extract text content from LLM response
 */
function messageToString(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) {
          return String(c.text);
        }
        return "";
      })
      .join("");
  }
  if (typeof content === "object" && "text" in content) {
    return String((content as { text: unknown }).text);
  }
  return String(content);
}

/**
 * Helper: Add exponential backoff delay
 */
async function retryDelay(retryCount: number): Promise<void> {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.multiplier, retryCount),
    RETRY_CONFIG.maxDelay
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Enhanced heuristic extraction for tech stacks and project types
 */
interface HeuristicResult {
  stacks: string[];
  projectType: ProjectType;
  confidence: number;
}

function extractInfoFromText(text: string): HeuristicResult {
  const lower = text.toLowerCase();
  const stacks: string[] = [];
  let confidence = 0;

  // Frontend frameworks
  if (/\b(next(\.js)?|nextjs)\b/.test(lower)) {
    stacks.push("Next.js");
    confidence += 0.15;
  }
  if (/\breact\b/.test(lower)) {
    stacks.push("React");
    confidence += 0.1;
  }
  if (/\bvue(\.js)?\b/.test(lower)) {
    stacks.push("Vue.js");
    confidence += 0.1;
  }
  if (/\bangular\b/.test(lower)) {
    stacks.push("Angular");
    confidence += 0.1;
  }
  if (/\bsvelte\b/.test(lower)) {
    stacks.push("Svelte");
    confidence += 0.1;
  }

  // Backend frameworks
  if (/\b(node(\.js)?|nodejs|express)\b/.test(lower)) {
    stacks.push("Node.js");
    confidence += 0.15;
  }
  if (/\b(python|django|flask|fastapi)\b/.test(lower)) {
    stacks.push("Python");
    confidence += 0.15;
  }
  if (/\b(rust|actix|rocket)\b/.test(lower)) {
    stacks.push("Rust");
    confidence += 0.1;
  }
  if (/\b(go|golang|gin)\b/.test(lower)) {
    stacks.push("Go");
    confidence += 0.1;
  }
  if (/\b(java|spring|springboot)\b/.test(lower)) {
    stacks.push("Java");
    confidence += 0.1;
  }

  // Databases
  if (/\b(postgres(ql)?|pg)\b/.test(lower)) {
    stacks.push("PostgreSQL");
    confidence += 0.05;
  }
  if (/\b(mongo(db)?)\b/.test(lower)) {
    stacks.push("MongoDB");
    confidence += 0.05;
  }
  if (/\b(mysql|mariadb)\b/.test(lower)) {
    stacks.push("MySQL");
    confidence += 0.05;
  }
  if (/\b(redis)\b/.test(lower)) {
    stacks.push("Redis");
    confidence += 0.05;
  }

  // Mobile
  if (/\b(react native)\b/.test(lower)) {
    stacks.push("React Native");
    confidence += 0.15;
  }
  if (/\b(flutter)\b/.test(lower)) {
    stacks.push("Flutter");
    confidence += 0.15;
  }
  if (/\b(swift|ios)\b/.test(lower)) {
    stacks.push("iOS");
    confidence += 0.1;
  }
  if (/\b(kotlin|android)\b/.test(lower)) {
    stacks.push("Android");
    confidence += 0.1;
  }

  // Infrastructure
  if (/\b(kubernetes|k8s)\b/.test(lower)) {
    stacks.push("Kubernetes");
    confidence += 0.1;
  }
  if (/\b(docker)\b/.test(lower)) {
    stacks.push("Docker");
    confidence += 0.05;
  }
  if (/\b(aws|amazon web services)\b/.test(lower)) {
    stacks.push("AWS");
    confidence += 0.1;
  }
  if (/\b(gcp|google cloud)\b/.test(lower)) {
    stacks.push("GCP");
    confidence += 0.1;
  }
  if (/\b(azure)\b/.test(lower)) {
    stacks.push("Azure");
    confidence += 0.1;
  }

  // Testing & CI/CD
  if (/\b(jest|vitest|mocha|cypress)\b/.test(lower)) {
    stacks.push("Testing");
    confidence += 0.05;
  }
  if (/\b(github actions|gitlab ci|jenkins|ci\/cd)\b/.test(lower)) {
    stacks.push("CI/CD");
    confidence += 0.05;
  }

  // Project type classification
  let projectType: ProjectType = "other";
  const frontendScore =
    (/\b(frontend|ui|ux|client|web app)\b/.test(lower) ? 1 : 0) +
    (stacks.some((s) =>
      ["Next.js", "React", "Vue.js", "Angular", "Svelte"].includes(s)
    )
      ? 0.5
      : 0);

  const backendScore =
    (/\b(api|backend|server|server-side|microservice)\b/.test(lower) ? 1 : 0) +
    (stacks.some((s) => ["Node.js", "Python", "Rust", "Go", "Java"].includes(s))
      ? 0.5
      : 0);

  const infraScore =
    (/\b(infrastructure|infra|deploy|devops|cloud)\b/.test(lower) ? 1 : 0) +
    (stacks.some((s) =>
      ["Kubernetes", "Docker", "AWS", "GCP", "Azure"].includes(s)
    )
      ? 0.5
      : 0);

  const mobileScore = stacks.some((s) =>
    ["React Native", "Flutter", "iOS", "Android"].includes(s)
  )
    ? 1
    : 0;

  if (frontendScore > 0.5 && backendScore > 0.5) {
    projectType = "fullstack";
  } else if (infraScore > 1) {
    projectType = "infra";
  } else if (mobileScore > 0) {
    projectType = "fullstack"; // Mobile often needs backend
  } else if (frontendScore > backendScore) {
    projectType = "frontend";
  } else if (backendScore > frontendScore) {
    projectType = "backend";
  } else if (/\b(library|sdk|package|npm|pip)\b/.test(lower)) {
    projectType = "library";
  }

  return {
    stacks: Array.from(new Set(stacks)),
    projectType,
    confidence,
  };
}

/**
 * NODE 1: Check for missing information - RELAXED VERSION
 */
const checkMissingInfoNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const combined = [
    state.prompt,
    ...(state.history || []).map((h: ChatMessage) => h.content),
  ].join("\n");

  const heur = extractInfoFromText(combined);

  // Only ask for clarification if the prompt is EXTREMELY vague
  const isExtremelyVague = 
    combined.trim().split(/\s+/).length < 5 && // Very short prompt
    heur.stacks.length === 0 && 
    heur.projectType === "other" &&
    !/\b(app|website|api|service|tool|system|platform|dashboard|build|create|make)\b/i.test(combined);

  if (isExtremelyVague) {
    return {
      needsInfo: true,
      clarifyingPrompt: `I'd be happy to help you create a development plan! Could you tell me a bit more about what you want to build?\n\nFor example:\n- What type of application or system? (web app, API, mobile app, etc.)\n- What should it do or what problem does it solve?\n- Any specific technologies you prefer?`,
      techStack: [],
      type: "other",
    };
  }

  // Otherwise, proceed with whatever info we have
  return { 
    needsInfo: false, 
    techStack: heur.stacks, 
    type: heur.projectType 
  };
};

/**
 * NODE 2: Classify project type - ENHANCED VERSION
 */
const classifyNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const combined = [
    state.prompt,
    ...(state.history || []).map((h: ChatMessage) => h.content),
  ].join("\n");

  const heur = extractInfoFromText(combined);

  // Use heuristic if we have any confidence
  if (heur.projectType !== "other") {
    return {
      type: heur.projectType,
      techStack: heur.stacks.length > 0 ? heur.stacks : ["To be determined based on requirements"],
    };
  }

  // LLM classification with instruction to make assumptions
  try {
    const res = await llm.invoke([
      {
        role: "system",
        content: `You are a project classifier. Based on the user's description, classify the project type and suggest appropriate tech stacks.

If not explicitly stated, make intelligent assumptions based on:
- Industry best practices
- Common patterns for similar projects
- Scalability and maintainability

Always provide a classification even if details are vague. Respond with JSON:
{
  "type": "frontend|backend|fullstack|library|infra",
  "suggestedStacks": ["tech1", "tech2"],
  "reasoning": "brief explanation"
}`,
      },
      {
        role: "user",
        content: `Project description:\n${combined}\n\nDetected hints: ${heur.stacks.join(", ") || "none"}`,
      },
    ]);

    const txt = messageToString(res.content).trim();
    
    // Try to parse JSON response
    let parsed;
    try {
      const cleaned = txt.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback to text parsing
      let type: ProjectType = "fullstack";
      if (txt.includes("frontend")) type = "frontend";
      else if (txt.includes("backend")) type = "backend";
      else if (txt.includes("library")) type = "library";
      else if (txt.includes("infra")) type = "infra";
      
      return {
        type,
        techStack: heur.stacks.length > 0 ? heur.stacks : ["Modern web technologies"],
      };
    }

    return {
      type: parsed.type || "fullstack",
      techStack: parsed.suggestedStacks || heur.stacks || ["Modern web technologies"],
    };
  } catch (error) {
    console.error("Classification error:", error);
    return {
      type: "fullstack",
      techStack: heur.stacks.length > 0 ? heur.stacks : ["React", "Node.js"],
    };
  }
};

/**
 * NODE 3: Optimize prompt with context injection
 */
const optimizePromptNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.optimizedPrompt) {
    return {};
  }

  const combined = [
    state.prompt,
    ...(state.history || []).map((h: ChatMessage) => h.content),
  ].join("\n");

  const contextHints = [
    `Project Type: ${state.type}`,
    `Tech Stack: ${(state.techStack || []).join(", ") || "not specified"}`,
    (state.retryCount || 0) > 0
      ? `Previous attempt failed at: ${state.failedSection || "unknown"}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await llm.invoke([
      {
        role: "system",
        content: PROMPTS.OPTIMIZATION_SYSTEM,
      },
      {
        role: "user",
        content: `${contextHints}\n\nOriginal Prompt:\n${combined}`,
      },
    ]);

    const optimized = messageToString(res.content).trim();

    return {
      optimizedPrompt: optimized || state.prompt,
    };
  } catch (error) {
    console.error("Optimization error:", error);
    return {
      optimizedPrompt: state.prompt,
    };
  }
};

/**
 * NODE 4: Generate Observations section - RELAXED VALIDATION
 */
const observationsNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const promptToUse = state.optimizedPrompt || state.prompt;

  try {
    const res = await llm.invoke([
      {
        role: "system",
        content: PROMPTS.OBSERVATIONS_SYSTEM,
      },
      {
        role: "user",
        content: `Type: ${state.type}\nStack: ${(state.techStack || []).join(", ")}\n\nBrief:\n${promptToUse}`,
      },
    ]);

    const observations = messageToString(res.content).trim();

    if (!observations || observations.length < 20) {
      return {
        lastError: "Observations section too short",
        failedSection: "observations",
      };
    }

    return {
      observations,
      lastError: null,
      failedSection: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      lastError: `Observations generation failed: ${errorMessage}`,
      failedSection: "observations",
    };
  }
};

/**
 * NODE 5: Generate Approach section - RELAXED VALIDATION
 */
const approachNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const promptToUse = state.optimizedPrompt || state.prompt;

  try {
    const res = await llm.invoke([
      {
        role: "system",
        content: PROMPTS.APPROACH_SYSTEM,
      },
      {
        role: "user",
        content: `Type: ${state.type}\nStack: ${(state.techStack || []).join(", ")}\nObservations:\n${state.observations}\n\nBrief:\n${promptToUse}`,
      },
    ]);

    const approach = messageToString(res.content).trim();

    if (!approach || approach.length < 20) {
      return {
        lastError: "Approach section too short",
        failedSection: "approach",
      };
    }

    return {
      approach,
      lastError: null,
      failedSection: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      lastError: `Approach generation failed: ${errorMessage}`,
      failedSection: "approach",
    };
  }
};

/**
 * NODE 6: Generate Steps section - RELAXED VALIDATION
 */
const stepsNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const promptToUse = state.optimizedPrompt || state.prompt;

  try {
    const res = await llm.invoke([
      {
        role: "system",
        content: PROMPTS.STEPS_SYSTEM,
      },
      {
        role: "user",
        content: `Type: ${state.type}\nStack: ${(state.techStack || []).join(", ")}\nApproach:\n${state.approach}\n\nBrief:\n${promptToUse}`,
      },
    ]);

    const steps = messageToString(res.content).trim();

    if (!steps || steps.length < 30) {
      return {
        lastError: "Steps section too short",
        failedSection: "steps",
      };
    }

    return {
      steps,
      lastError: null,
      failedSection: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      lastError: `Steps generation failed: ${errorMessage}`,
      failedSection: "steps",
    };
  }
};

/**
 * NODE 7: Generate File Structure section - RELAXED VALIDATION
 */
const fileStructureNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  try {
    const res = await llm.invoke([
      {
        role: "system",
        content: PROMPTS.FILE_STRUCTURE_SYSTEM,
      },
      {
        role: "user",
        content: `Type: ${state.type}\nStack: ${(state.techStack || []).join(", ")}\nSteps:\n${state.steps}`,
      },
    ]);

    const fileStructure = messageToString(res.content).trim();

    if (!fileStructure || fileStructure.length < 20) {
      return {
        lastError: "File structure section too short",
        failedSection: "fileStructure",
      };
    }

    return {
      fileStructure,
      lastError: null,
      failedSection: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      lastError: `File structure generation failed: ${errorMessage}`,
      failedSection: "fileStructure",
    };
  }
};

/**
 * NODE 8: Retry guard with exponential backoff
 */
const retryGuardNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const currentRetryCount = state.retryCount || 0;
  const maxRetries = state.maxRetries || 2;
  const newCount = currentRetryCount + 1;

  if (newCount > maxRetries) {
    return {
      retryCount: newCount,
      lastError: `Exceeded maximum retries (${maxRetries}). Last failure: ${
        state.failedSection || "unknown"
      }`,
    };
  }

  await retryDelay(currentRetryCount);

  return {
    retryCount: newCount,
    lastError: null,
  };
};

/**
 * NODE 9: Assemble final markdown plan
 */
const assemblerNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (
    !state.observations ||
    !state.approach ||
    !state.steps ||
    !state.fileStructure
  ) {
    return {
      lastError:
        state.lastError || "Cannot assemble plan: missing required sections",
    };
  }

  const markdown = `# 🔍 Observations

${state.observations}

# 🧠 Approach

${state.approach}

# ✅ Steps

${state.steps}

# 📂 File Structure

${state.fileStructure}`;

  return {
    markdownPlan: markdown,
    lastError: null,
  };
};

/**
 * FIXED Conditional edge functions - ALL use "Node" suffix
 */
const shouldEndAfterCheck = (state: PipelineState): string => {
  return state.needsInfo ? END : "classifyNode";
};

const shouldOptimize = (state: PipelineState): string => {
  const planningTypes: ProjectType[] = [
    "frontend",
    "backend",
    "fullstack",
    "library",
    "infra",
  ];
  return planningTypes.includes(state.type) ? "optimizeNode" : "observationsNode";
};

const afterObservationsRoute = (state: PipelineState): string => {
  if (state.observations && !state.lastError) {
    return "approachNode";
  }
  return "retryGuardNode";
};

const afterApproachRoute = (state: PipelineState): string => {
  if (state.approach && !state.lastError) {
    return "stepsNode";
  }
  return "retryGuardNode";
};

const afterStepsRoute = (state: PipelineState): string => {
  if (state.steps && !state.lastError) {
    return "fileStructureNode";
  }
  return "retryGuardNode";
};

const afterFileStructureRoute = (state: PipelineState): string => {
  if (state.fileStructure && !state.lastError) {
    return "assemblerNode";
  }
  return "retryGuardNode";
};

const afterRetryRoute = (state: PipelineState): string => {
  const currentRetryCount = state.retryCount || 0;
  const maxRetries = state.maxRetries || 2;

  if (currentRetryCount > maxRetries) {
    return "assemblerNode";
  }

  // Route to the failed section
  switch (state.failedSection) {
    case "observations":
      return "observationsNode";
    case "approach":
      return "approachNode";
    case "steps":
      return "stepsNode";
    case "fileStructure":
      return "fileStructureNode";
    default:
      return "optimizeNode";
  }
};

/**
 * Build and compile the StateGraph workflow
 */
const workflow = new StateGraph(PipelineStateAnnotation)
  .addNode("checkMissingInfoNode", checkMissingInfoNode)
  .addNode("classifyNode", classifyNode)
  .addNode("optimizeNode", optimizePromptNode)
  .addNode("observationsNode", observationsNode)
  .addNode("approachNode", approachNode)
  .addNode("stepsNode", stepsNode)
  .addNode("fileStructureNode", fileStructureNode)
  .addNode("retryGuardNode", retryGuardNode)
  .addNode("assemblerNode", assemblerNode)
  .addEdge("__start__", "checkMissingInfoNode")
  .addConditionalEdges("checkMissingInfoNode", shouldEndAfterCheck)
  .addConditionalEdges("classifyNode", shouldOptimize)
  .addEdge("optimizeNode", "observationsNode")
  .addConditionalEdges("observationsNode", afterObservationsRoute)
  .addConditionalEdges("approachNode", afterApproachRoute)
  .addConditionalEdges("stepsNode", afterStepsRoute)
  .addConditionalEdges("fileStructureNode", afterFileStructureRoute)
  .addConditionalEdges("retryGuardNode", afterRetryRoute)
  .addEdge("assemblerNode", END);

const app = workflow.compile();

/**
 * Public function to run the complete pipeline
 */
export async function runPipeline(
  req: generatePlanRequest
): Promise<generatePlanResponse> {
  const { prompt, history } = req;

  const initialState: PipelineState = {
    prompt,
    history: history || [],
    retryCount: 0,
    maxRetries: 2,
    lastError: null,
    needsInfo: false,
    clarifyingPrompt: null,
    type: "other",
    techStack: [],
    optimizedPrompt: null,
    observations: null,
    approach: null,
    steps: null,
    fileStructure: null,
    markdownPlan: null,
    failedSection: null,
  };

  try {
    const result = await app.invoke(initialState);

    // Handle clarification needed
    if (result.needsInfo && result.clarifyingPrompt) {
      return {
        success: false,
        data: null,
        message: result.clarifyingPrompt,
        needsClarification: true,
      };
    }

    // Handle failure cases
    if (!result.markdownPlan || result.lastError) {
      return {
        success: false,
        data: null,
        message:
          result.lastError ||
          "Failed to generate plan. Please try again with more details.",
      };
    }

    // Success case
    const planData: PlanData = {
      markdown: result.markdownPlan,
      metadata: {
        generated_at: new Date().toISOString(),
        retryCount: result.retryCount || 0,
        maxRetries: result.maxRetries || 2,
        classification: result.type || "unknown",
      },
    };

    return {
      success: true,
      data: planData,
      message: "Plan generated successfully",
    };
  } catch (error) {
    console.error("Pipeline execution error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      success: false,
      data: null,
      message: `Pipeline failed: ${errorMessage}`,
    };
  }
}