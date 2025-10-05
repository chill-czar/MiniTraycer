// lib/chains/pipeline.ts
import { ChatGroq } from "@langchain/groq";
import { StateGraph, END, Annotation } from "@langchain/langgraph";

/**
 * Request / Response / Chat types (from your spec)
 */
export type generatePlanRequest = {
  prompt: string;
  history: ChatMessage[];
};

export interface generatePlanResponse {
  data: any | null;
  success: boolean;
  message?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * PipelineState using Annotation for LangGraph v0.2+
 */
const PipelineStateAnnotation = Annotation.Root({
  prompt: Annotation<string>,
  history: Annotation<ChatMessage[]>,
  needsInfo: Annotation<boolean | undefined>,
  clarifyingPrompt: Annotation<string | undefined>,
  type: Annotation<
    | "frontend"
    | "backend"
    | "fullstack"
    | "library"
    | "infra"
    | "other"
    | undefined
  >,
  optimizedPrompt: Annotation<string | undefined>,
  markdownPlan: Annotation<string | undefined>,
  retryCount: Annotation<number | undefined>,
  maxRetries: Annotation<number | undefined>,
  lastError: Annotation<string | null | undefined>,
});

export type PipelineState = typeof PipelineStateAnnotation.State;

/**
 * LLM client (Groq). Replace model & config per env.
 */
const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.15,
  maxTokens: 1600,
});

/**
 * Helpers
 */
function messageToString(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object") return c.text ?? "";
        return "";
      })
      .join("");
  }
  return String(content);
}

/**
 * Simple heuristic extractor (can be extended)
 */
function extractInfoFromText(text: string) {
  const lower = text.toLowerCase();
  const stacks: string[] = [];
  if (/\b(next(\.js)?|nextjs)\b/.test(lower)) stacks.push("Next.js");
  if (/\breact\b/.test(lower)) stacks.push("React");
  if (/\b(node(\.js)?|nodejs|node)\b/.test(lower)) stacks.push("Node.js");
  if (/\b(python|django|flask)\b/.test(lower)) stacks.push("Python");
  if (/\b(rust)\b/.test(lower)) stacks.push("Rust");
  if (/\b(go|golang)\b/.test(lower)) stacks.push("Go");
  if (/\b(react native)\b/.test(lower)) stacks.push("React Native");
  if (/\b(android|ios|mobile)\b/.test(lower)) stacks.push("Mobile");
  if (/\b(kubernetes|k8s|docker|ci\/cd)\b/.test(lower)) stacks.push("Infra");

  let projectType: PipelineState["type"] = "other";
  if (/\b(frontend|ui|ux|client)\b/.test(lower)) projectType = "frontend";
  if (/\b(api|backend|server|server-side)\b/.test(lower))
    projectType = "backend";
  if (/\b(full[ -]?stack|end-to-end)\b/.test(lower)) projectType = "fullstack";
  if (/\b(library|sdk|package)\b/.test(lower)) projectType = "library";
  if (/\b(infrastructure|infra|deploy|k8s|docker)\b/.test(lower))
    projectType = "infra";

  return { stacks: Array.from(new Set(stacks)), projectType };
}

/**
 * Node implementations (return Partial<PipelineState>)
 */

/* -------------------
   1) CheckMissingInfo Node
   - Heuristically detect missing project type or stack.
   - If missing, set needsInfo=true and clarifyingPrompt with questions.
   ------------------- */
const checkMissingInfoNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const combined = [
    state.prompt,
    ...state.history.map((h: ChatMessage) => h.content),
  ].join("\n");
  const heur = extractInfoFromText(combined);
  const needsStack = heur.stacks.length === 0;
  const needsProjectType = heur.projectType === "other";

  if (!needsStack && !needsProjectType) {
    return { needsInfo: false };
  }

  const questions: string[] = [];
  if (needsProjectType) {
    questions.push(
      "1) What type of project is this? (frontend, backend, fullstack, library, infra)"
    );
  }
  if (needsStack) {
    questions.push(
      "2) Which tech stack do you prefer (examples: Next.js + React + Node.js, Python + Django, etc.)?"
    );
  }

  const clarifyingPrompt = `I need a bit more information to generate a good plan. Please answer:\n\n${questions.join(
    "\n"
  )}\n\nIf unsure, say which languages/platforms you prefer.`;

  return { needsInfo: true, clarifyingPrompt };
};

/* -------------------
   2) Classify Node (LLM-assisted)
   - Uses heuristics first, then LLM fallback for nuance.
   ------------------- */
const classifyNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const combined = [
    state.prompt,
    ...state.history.map((h: ChatMessage) => h.content),
  ].join("\n");
  const heur = extractInfoFromText(combined);
  if (heur.projectType !== "other") {
    return { type: heur.projectType };
  }

  // LLM classification (strict single-word output)
  try {
    const res = await llm.invoke([
      {
        role: "system",
        content:
          "You are a concise classifier. From the user's prompt, return exactly one of: frontend, backend, fullstack, library, infra, other. Reply with that single word only.",
      },
      { role: "user", content: state.prompt },
    ]);
    const txt = messageToString(res.content).trim().toLowerCase();
    if (txt.includes("frontend")) return { type: "frontend" };
    if (txt.includes("backend")) return { type: "backend" };
    if (txt.includes("fullstack")) return { type: "fullstack" };
    if (txt.includes("library")) return { type: "library" };
    if (txt.includes("infra")) return { type: "infra" };
  } catch (e: any) {
    // fallback to other
  }
  return { type: "other" };
};

/* -------------------
   3) OptimizePrompt Node (LLM)
   - Improve prompt clarity; we store optimizedPrompt.
   - This is the place you can inject manual editing UI instead (frontend).
   ------------------- */
const optimizePromptNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  // If there's already an optimized prompt (e.g., user provided), keep it
  if (state.optimizedPrompt) return {};

  // Provide optional heuristics hints
  const combined = [
    state.prompt,
    ...state.history.map((h: ChatMessage) => h.content),
  ].join("\n");
  const heur = extractInfoFromText(combined);
  const stackHint = heur.stacks.length
    ? `Preferred tech stacks: ${heur.stacks.join(", ")}`
    : "";

  try {
    const res = await llm.invoke([
      {
        role: "system",
        content:
          "You are a prompt optimizer. Improve clarity, fill missing constraints where reasonable, and rewrite the prompt as a concise, clear brief for a planning assistant. Return the improved prompt only.",
      },
      { role: "user", content: `${stackHint}\n\nPrompt:\n${state.prompt}` },
    ]);
    const opt = messageToString(res.content).trim();
    return { optimizedPrompt: opt || state.prompt };
  } catch (err: any) {
    // If optimizer fails, fallback to original prompt
    return { optimizedPrompt: state.prompt };
  }
};

/* -------------------
   4) Planner Node (LLM)
   - Generate Traycer-style markdown plan.
   - On failure, set lastError to trigger retry logic.
   ------------------- */
const plannerNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const promptToUse = state.optimizedPrompt || state.prompt;
  const heur = extractInfoFromText(
    [state.prompt, ...state.history.map((h: ChatMessage) => h.content)].join(
      "\n"
    )
  );

  const system = `
You are Traycer-style planning assistant. Produce a detailed MARKDOWN plan only (no JSON wrapper). Use these headings exactly:

# 🔍 Observations
# 🧠 Approach
# ✅ Steps
# 📂 File Structure

- Steps should be actionable (numbered) with sub-steps where needed.
- Mention tech stack choices and short rationale.
- If the request is not planning-related, respond with a short message starting with "NOT_PLANNING:".
- Do not output any non-markdown wrappers.
`;

  const user = `Classification: ${state.type}\nTechHints: ${
    heur.stacks.join(", ") || "none"
  }\n\nBrief:\n${promptToUse}`;

  try {
    const res = await llm.invoke([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    const markdown = messageToString(res.content).trim();

    // quick guard: if assistant replies with the "NOT_PLANNING" sentinel, treat as other
    if (markdown.startsWith("NOT_PLANNING:")) {
      return {
        markdownPlan: `# ❌ Not a Planning Prompt\n${markdown
          .replace("NOT_PLANNING:", "")
          .trim()}`,
      };
    }

    // Basic sanity check: ensure we have at least a heading "🔍 Observations" or "Steps"
    if (
      !/#\s*🔍\s*Observations/i.test(markdown) &&
      !/#\s*✅\s*Steps/i.test(markdown)
    ) {
      // mark as error to trigger retry path
      return {
        lastError: "Planner output missing required sections",
        markdownPlan: markdown,
      };
    }

    return { markdownPlan: markdown, lastError: null };
  } catch (err: any) {
    return { lastError: err?.message ?? "Planner LLM call failed" };
  }
};

/* -------------------
   5) Retry Guard Node (compute)
   - Checks retryCount vs maxRetries; increments retryCount when called.
   - If exceeded, set lastError to a terminal message.
   ------------------- */
const retryGuardNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const max = typeof state.maxRetries === "number" ? state.maxRetries : 2;
  const count = typeof state.retryCount === "number" ? state.retryCount : 0;
  const newCount = count + 1;

  if (newCount > max) {
    return { retryCount: newCount, lastError: `Exceeded max retries (${max})` };
  }

  return { retryCount: newCount, lastError: null };
};

/* -------------------
   6) Final Assembler Node
   - No-op or minor formatting before end.
   ------------------- */
const assemblerNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  // ensure markdownPlan exists
  if (!state.markdownPlan) {
    return { lastError: state.lastError ?? "No plan generated" };
  }
  // Could add post-processing: sanitize, ensure code fences, etc.
  return {};
};

/* -------------------
   Conditional edge functions
   ------------------- */
const shouldEndAfterCheck = (state: PipelineState): string => {
  return state.needsInfo === true ? END : "classify";
};

const shouldOptimize = (state: PipelineState): string => {
  const planningTypes = [
    "frontend",
    "backend",
    "fullstack",
    "library",
    "infra",
  ];
  return planningTypes.includes(state.type || "") ? "optimize" : "planner";
};

const afterPlannerRoute = (state: PipelineState): string => {
  if (state.markdownPlan && !state.lastError) {
    return "assembler";
  }
  return "retryGuard";
};

const afterRetryRoute = (state: PipelineState): string => {
  const count = state.retryCount ?? 0;
  const max = state.maxRetries ?? 2;

  if (state.lastError && count > max) {
    return "assembler";
  }
  return "optimize";
};

/* -------------------
   Build StateGraph
   ------------------- */
const workflow = new StateGraph(PipelineStateAnnotation)
  .addNode("checkMissingInfo", checkMissingInfoNode)
  .addNode("classify", classifyNode)
  .addNode("optimize", optimizePromptNode)
  .addNode("planner", plannerNode)
  .addNode("retryGuard", retryGuardNode)
  .addNode("assembler", assemblerNode)
  .addEdge("__start__", "checkMissingInfo")
  .addConditionalEdges("checkMissingInfo", shouldEndAfterCheck)
  .addConditionalEdges("classify", shouldOptimize)
  .addEdge("optimize", "planner")
  .addConditionalEdges("planner", afterPlannerRoute)
  .addConditionalEdges("retryGuard", afterRetryRoute)
  .addEdge("assembler", END);

/* Compile */
const app = workflow.compile();

/**
 * runPipeline - public function
 *
 * Behavior:
 * - If checkMissingInfo finds missing info => returns clarifyingPrompt (success: false, data: null)
 * - Else runs classification -> optimization -> plan -> assembler
 * - If planner fails, will retry up to maxRetries (default 2)
 * - Returns generatePlanResponse where data.markdown contains final Markdown on success
 */
export async function runPipeline(
  req: generatePlanRequest
): Promise<generatePlanResponse> {
  const { prompt, history } = req;
  const initialState: PipelineState = {
    prompt,
    history,
    retryCount: 0,
    maxRetries: 2,
    lastError: null,
    needsInfo: undefined,
    clarifyingPrompt: undefined,
    type: undefined,
    optimizedPrompt: undefined,
    markdownPlan: undefined,
  };

  try {
    const result = await app.invoke(initialState);

    // If needsInfo true, return clarifyingPrompt
    if (result.needsInfo) {
      return {
        success: false,
        data: null,
        message: result.clarifyingPrompt || "Please provide more information.",
      };
    }

    // If exceeded retries or lastError present without markdown, surface error
    if (!result.markdownPlan) {
      return {
        success: false,
        data: null,
        message: result.lastError || "Could not generate plan.",
      };
    }

    // Successful plan
    return {
      success: true,
      data: {
        markdown: result.markdownPlan,
        metadata: {
          generated_at: new Date().toISOString(),
          retryCount: result.retryCount ?? 0,
          maxRetries: result.maxRetries ?? 2,
          classification: result.type ?? "unknown",
        },
      },
    };
  } catch (err: any) {
    console.error("runPipeline error:", err);
    return {
      success: false,
      data: null,
      message: err?.message ?? "Pipeline execution failed",
    };
  }
}
