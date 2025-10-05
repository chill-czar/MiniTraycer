// lib/chains/pipeline.ts
import {
  ChatMessage,
  generatePlanRequest,
  generatePlanResponse,
  PlanData,
  PlanSection,
  ProjectCategory,
  ThinkingResult,
} from "@/types/generatePlan";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { PROMPTS } from "./prompts";


/**
 * Enhanced pipeline state with dynamic planning
 */
const PipelineStateAnnotation = Annotation.Root({
  // Input
  prompt: Annotation<string>,
  history: Annotation<ChatMessage[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),

  // Clarification state
  needsClarification: Annotation<boolean>({
    reducer: (_prev, newVal) => newVal,
    default: () => false,
  }),
  clarificationQuestions: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),

  // Analysis state
  projectCategory: Annotation<ProjectCategory>({
    reducer: (_prev, newVal) => newVal,
    default: () => "unknown" as ProjectCategory,
  }),
  detectedTechStack: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  suggestedTechStack: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  projectComplexity: Annotation<"simple" | "moderate" | "complex">({
    reducer: (_prev, newVal) => newVal,
    default: () => "moderate",
  }),

  // Thinking state
  currentThinking: Annotation<ThinkingResult | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  thinkingHistory: Annotation<ThinkingResult[]>({
    reducer: (prev, newVal) => [...prev, ...newVal],
    default: () => [],
  }),

  // Plan generation state
  planSections: Annotation<PlanSection[]>({
    reducer: (prev, newVal) => [...prev, ...newVal],
    default: () => [],
  }),
  requiredSections: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  generatedSections: Annotation<Set<string>>({
    reducer: (_prev, newVal) => newVal,
    default: () => new Set<string>(),
  }),

  // Output
  finalPlan: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),

  // Error handling
  retryCount: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 3,
  }),
  lastError: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  failedNode: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
});

export type PipelineState = typeof PipelineStateAnnotation.State;

/**
 * LLM Configuration
 */
const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
  maxTokens: 3000,
});

/**
 * Utility: Extract text from LLM response
 */
function extractText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) return String(c.text);
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
 * Utility: Exponential backoff delay
 */
async function retryDelay(retryCount: number): Promise<void> {
  const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
  console.log(`⏳ Waiting ${delay}ms before retry...`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Utility: Parse JSON from LLM response with fallback
 */
function parseJSON<T>(text: string, fallback: T): T {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

/**
 * NODE 1: Initial Analysis - Understand the prompt deeply
 */
const initialAnalysisNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  console.log("\n🧠 === INITIAL ANALYSIS NODE ===");
  console.log(
    "📝 Analyzing user prompt to understand intent and requirements..."
  );

  const combined = [state.prompt, ...state.history.map((h) => h.content)].join(
    "\n"
  );

  console.log(`📊 Input length: ${combined.length} characters`);
  console.log(`📊 History messages: ${state.history.length}`);

  // Build conversation context for LLM
  const messages: Array<{ role: string; content: string }> = [
    {
      role: "system",
      content: PROMPTS.INITIAL_ANALYSIS_SYSTEM,
    },
  ];

  // Add history as conversation
  if (state.history.length > 0) {
    console.log("📜 Including conversation history for context");
    state.history.forEach((msg) => {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });
  }

  // Add current prompt
  messages.push({
    role: "user",
    content: state.prompt,
  });

  try {
    const response = await llm.invoke(messages);

    const analysisText = extractText(response.content);
    console.log(
      `🔍 Raw analysis response: ${analysisText.substring(0, 200)}...`
    );

    const analysis = parseJSON<{
      isVague: boolean;
      hasSufficientDetail: boolean;
      detectedIntent: string;
      missingInfo: string[];
      confidence: number;
    }>(analysisText, {
      // Better fallback logic
      isVague:
        combined.trim().split(/\s+/).length < 10 && state.history.length === 0,
      hasSufficientDetail:
        combined.trim().split(/\s+/).length >= 15 || state.history.length > 0,
      detectedIntent: "project description",
      missingInfo: [],
      confidence: state.history.length > 0 ? 0.7 : 0.3,
    });

    console.log("🔍 Analysis Results:");
    console.log(`   - Vague: ${analysis.isVague}`);
    console.log(`   - Sufficient Detail: ${analysis.hasSufficientDetail}`);
    console.log(`   - Detected Intent: ${analysis.detectedIntent}`);
    console.log(`   - Confidence: ${analysis.confidence}`);
    console.log(`   - Missing Info: ${analysis.missingInfo.join(", ")}`);

    // More lenient clarification logic
    // Only ask for clarification if:
    // 1. First message AND very short/vague
    // 2. Confidence is very low (< 0.4)
    // 3. Has explicit missing critical info
    const shouldClarify =
      analysis.isVague &&
      !analysis.hasSufficientDetail &&
      analysis.confidence < 0.4 &&
      analysis.missingInfo.length > 0;

    if (shouldClarify) {
      console.log("⚠️  Prompt needs clarification");
      console.log(`   Missing info: ${analysis.missingInfo.join(", ")}`);

      return {
        needsClarification: true,
        clarificationQuestions: analysis.missingInfo,
        currentThinking: {
          reasoning: `Prompt is too vague (confidence: ${analysis.confidence}). Need more information.`,
          decisions: ["Request clarification before proceeding"],
          assumptions: [],
          nextAction: "ask_clarification",
        },
      };
    }

    console.log(
      "✅ Prompt has sufficient detail, proceeding to classification"
    );

    return {
      needsClarification: false,
      currentThinking: {
        reasoning: `Prompt has sufficient detail (confidence: ${
          analysis.confidence
        }). ${
          state.history.length > 0 ? "Built on previous conversation." : ""
        }`,
        decisions: ["Proceed with classification"],
        assumptions:
          analysis.confidence < 0.6
            ? ["Making reasonable assumptions where details are unclear"]
            : [],
        nextAction: "classify_project",
      },
    };
  } catch (error) {
    console.error("❌ Initial analysis failed:", error);
    return {
      lastError: `Analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      failedNode: "initialAnalysis",
    };
  }
};

/**
 * NODE 2: Project Classification - Categorize and extract tech stack
 */
const classificationNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  console.log("\n🏷️  === CLASSIFICATION NODE ===");
  console.log("🔎 Classifying project type and extracting tech stack...");

  const combined = [state.prompt, ...state.history.map((h) => h.content)].join(
    "\n"
  );

  console.log(`📊 Full context length: ${combined.length} characters`);

  // Build conversation messages
  const messages: Array<{ role: string; content: string }> = [
    {
      role: "system",
      content: PROMPTS.CLASSIFICATION_SYSTEM,
    },
  ];

  // Add history
  if (state.history.length > 0) {
    state.history.forEach((msg) => {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });
  }

  // Add current prompt
  messages.push({
    role: "user",
    content: state.prompt,
  });

  try {
    const response = await llm.invoke(messages);

    const classificationText = extractText(response.content);
    console.log(
      `🔍 Raw classification: ${classificationText.substring(0, 200)}...`
    );

    const classification = parseJSON<{
      category: ProjectCategory;
      detectedStack: string[];
      suggestedStack: string[];
      complexity: "simple" | "moderate" | "complex";
      reasoning: string;
    }>(classificationText, {
      category: "web_app",
      detectedStack: [],
      suggestedStack: ["React", "Node.js", "PostgreSQL"],
      complexity: "moderate",
      reasoning: "Default classification",
    });

    console.log("📦 Classification Results:");
    console.log(`   - Category: ${classification.category}`);
    console.log(
      `   - Detected Stack: ${
        classification.detectedStack.join(", ") || "none"
      }`
    );
    console.log(
      `   - Suggested Stack: ${classification.suggestedStack.join(", ")}`
    );
    console.log(`   - Complexity: ${classification.complexity}`);
    console.log(`   - Reasoning: ${classification.reasoning}`);

    const thinking: ThinkingResult = {
      reasoning: classification.reasoning,
      decisions: [
        `Classified as: ${classification.category}`,
        `Complexity level: ${classification.complexity}`,
        `Tech stack: ${[
          ...classification.detectedStack,
          ...classification.suggestedStack,
        ].join(", ")}`,
      ],
      assumptions:
        classification.detectedStack.length === 0
          ? [
              `No explicit tech mentioned, suggesting: ${classification.suggestedStack.join(
                ", "
              )}`,
            ]
          : [],
      nextAction: "determine_sections",
    };

    return {
      projectCategory: classification.category,
      detectedTechStack: classification.detectedStack,
      suggestedTechStack: classification.suggestedStack,
      projectComplexity: classification.complexity,
      currentThinking: thinking,
      thinkingHistory: [thinking],
    };
  } catch (error) {
    console.error("❌ Classification failed:", error);
    return {
      lastError: `Classification failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      failedNode: "classification",
    };
  }
};

/**
 * NODE 3: Section Planning - Determine what sections the plan needs
 */
const sectionPlanningNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  console.log("\n📋 === SECTION PLANNING NODE ===");
  console.log("🎯 Determining required plan sections based on project type...");

  try {
    const response = await llm.invoke([
      {
        role: "system",
        content: PROMPTS.SECTION_PLANNING_SYSTEM,
      },
      {
        role: "user",
        content: `Project Category: ${state.projectCategory}
Tech Stack: ${[...state.detectedTechStack, ...state.suggestedTechStack].join(
          ", "
        )}
Complexity: ${state.projectComplexity}

Original Prompt: ${state.prompt}`,
      },
    ]);

    const planText = extractText(response.content);
    const plan = parseJSON<{
      sections: string[];
      reasoning: string;
      priorityOrder: number[];
    }>(planText, {
      sections: [
        "Overview",
        "Architecture",
        "Implementation Steps",
        "Tech Stack",
      ],
      reasoning: "Default sections",
      priorityOrder: [1, 2, 3, 4],
    });

    console.log("📑 Required Sections:");
    plan.sections.forEach((section, idx) => {
      console.log(`   ${idx + 1}. ${section}`);
    });
    console.log(`   Reasoning: ${plan.reasoning}`);

    const thinking: ThinkingResult = {
      reasoning: plan.reasoning,
      decisions: [`Will generate ${plan.sections.length} sections`],
      assumptions: ["Sections determined by project category and complexity"],
      nextAction: "generate_sections",
    };

    return {
      requiredSections: plan.sections,
      currentThinking: thinking,
      thinkingHistory: [thinking],
    };
  } catch (error) {
    console.error("❌ Section planning failed:", error);
    return {
      lastError: `Section planning failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      failedNode: "sectionPlanning",
    };
  }
};

/**
 * NODE 4: Section Generator - Generate each section dynamically
 */
const sectionGeneratorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  console.log("\n✍️  === SECTION GENERATOR NODE ===");

  const sectionsToGenerate = state.requiredSections.filter(
    (section) => !state.generatedSections.has(section)
  );

  if (sectionsToGenerate.length === 0) {
    console.log("✅ All sections generated");
    return {};
  }

  const currentSection = sectionsToGenerate[0];
  console.log(`📝 Generating section: "${currentSection}"`);
  console.log(
    `   Progress: ${state.generatedSections.size}/${state.requiredSections.length}`
  );

  try {
    // Build context from previously generated sections
    const previousSections = state.planSections
      .map((s) => `## ${s.title}\n${s.content}`)
      .join("\n\n");

    const response = await llm.invoke([
      {
        role: "system",
        content: PROMPTS.SECTION_GENERATOR_SYSTEM,
      },
      {
        role: "user",
        content: `Section to Generate: ${currentSection}

Project Category: ${state.projectCategory}
Tech Stack: ${[...state.detectedTechStack, ...state.suggestedTechStack].join(
          ", "
        )}
Complexity: ${state.projectComplexity}

Original Prompt: ${state.prompt}

Previously Generated Sections:
${previousSections || "None yet"}

Generate this section with relevant, detailed content that fits the project type.`,
      },
    ]);

    const sectionContent = extractText(response.content).trim();

    console.log(
      `✅ Generated "${currentSection}" (${sectionContent.length} chars)`
    );

    const newSection: PlanSection = {
      title: currentSection,
      content: sectionContent,
      order: state.planSections.length + 1,
    };

    const updatedGenerated = new Set(state.generatedSections);
    updatedGenerated.add(currentSection);

    const thinking: ThinkingResult = {
      reasoning: `Generated "${currentSection}" section based on project requirements`,
      decisions: [
        `Section contains ${sectionContent.split("\n").length} lines`,
      ],
      assumptions: [],
      nextAction:
        updatedGenerated.size < state.requiredSections.length
          ? "generate_next_section"
          : "aggregate_plan",
    };

    return {
      planSections: [newSection],
      generatedSections: updatedGenerated,
      currentThinking: thinking,
      thinkingHistory: [thinking],
    };
  } catch (error) {
    console.error(`❌ Failed to generate section "${currentSection}":`, error);
    return {
      lastError: `Section generation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      failedNode: "sectionGenerator",
    };
  }
};

/**
 * NODE 5: Plan Aggregator - Combine all sections into final plan
 */
const planAggregatorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  console.log("\n🔗 === PLAN AGGREGATOR NODE ===");
  console.log("📦 Combining all sections into final plan...");

  if (state.planSections.length === 0) {
    console.error("❌ No sections to aggregate");
    return {
      lastError: "No sections generated to aggregate",
      failedNode: "planAggregator",
    };
  }

  // Sort sections by order
  const sortedSections = [...state.planSections].sort(
    (a, b) => a.order - b.order
  );

  // Build the final markdown plan
  const planParts: string[] = [
    `# 🚀 Development Plan`,
    ``,
    `**Project Type:** ${state.projectCategory}`,
    `**Tech Stack:** ${[
      ...state.detectedTechStack,
      ...state.suggestedTechStack,
    ].join(", ")}`,
    `**Complexity:** ${state.projectComplexity}`,
    ``,
    `---`,
    ``,
  ];

  sortedSections.forEach((section) => {
    planParts.push(`# ${section.title}`);
    planParts.push(``);
    planParts.push(section.content);
    planParts.push(``);
  });

  const finalPlan = planParts.join("\n");

  console.log("✅ Final plan aggregated successfully");
  console.log(`   Total length: ${finalPlan.length} characters`);
  console.log(`   Sections included: ${sortedSections.length}`);

  const thinking: ThinkingResult = {
    reasoning: "All sections combined into comprehensive development plan",
    decisions: [`Plan contains ${sortedSections.length} sections`],
    assumptions: [],
    nextAction: "complete",
  };

  return {
    finalPlan,
    currentThinking: thinking,
    thinkingHistory: [thinking],
  };
};

/**
 * NODE 6: Retry Handler - Handle failures with exponential backoff
 */
const retryHandlerNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  console.log("\n🔄 === RETRY HANDLER NODE ===");

  const newRetryCount = state.retryCount + 1;

  console.log(`⚠️  Retry attempt ${newRetryCount}/${state.maxRetries}`);
  console.log(`   Failed node: ${state.failedNode}`);
  console.log(`   Error: ${state.lastError}`);

  if (newRetryCount > state.maxRetries) {
    console.error(`❌ Max retries (${state.maxRetries}) exceeded`);
    return {
      retryCount: newRetryCount,
      lastError: `Maximum retries exceeded. Last error: ${state.lastError}`,
    };
  }

  await retryDelay(state.retryCount);

  console.log("♻️  Resetting error state and retrying...");

  return {
    retryCount: newRetryCount,
    lastError: null,
  };
};

/**
 * ROUTING FUNCTIONS
 */

const afterInitialAnalysis = (state: PipelineState): string => {
  if (state.needsClarification) {
    console.log("🔀 Routing: -> END (needs clarification)");
    return END;
  }
  console.log("🔀 Routing: -> classificationNode");
  return "classificationNode";
};

const afterClassification = (state: PipelineState): string => {
  if (state.lastError) {
    console.log("🔀 Routing: -> retryHandlerNode (error occurred)");
    return "retryHandlerNode";
  }
  console.log("🔀 Routing: -> sectionPlanningNode");
  return "sectionPlanningNode";
};

const afterSectionPlanning = (state: PipelineState): string => {
  if (state.lastError) {
    console.log("🔀 Routing: -> retryHandlerNode (error occurred)");
    return "retryHandlerNode";
  }
  console.log("🔀 Routing: -> sectionGeneratorNode");
  return "sectionGeneratorNode";
};

const afterSectionGenerator = (state: PipelineState): string => {
  if (state.lastError) {
    console.log("🔀 Routing: -> retryHandlerNode (error occurred)");
    return "retryHandlerNode";
  }

  const allGenerated =
    state.generatedSections.size >= state.requiredSections.length;

  if (allGenerated) {
    console.log("🔀 Routing: -> planAggregatorNode (all sections complete)");
    return "planAggregatorNode";
  }

  console.log("🔀 Routing: -> sectionGeneratorNode (more sections needed)");
  return "sectionGeneratorNode";
};

const afterRetry = (state: PipelineState): string => {
  if (state.retryCount > state.maxRetries) {
    console.log("🔀 Routing: -> planAggregatorNode (max retries exceeded)");
    return "planAggregatorNode";
  }

  // Route back to failed node
  switch (state.failedNode) {
    case "classification":
      console.log("🔀 Routing: -> classificationNode (retry)");
      return "classificationNode";
    case "sectionPlanning":
      console.log("🔀 Routing: -> sectionPlanningNode (retry)");
      return "sectionPlanningNode";
    case "sectionGenerator":
      console.log("🔀 Routing: -> sectionGeneratorNode (retry)");
      return "sectionGeneratorNode";
    default:
      console.log("🔀 Routing: -> classificationNode (default retry)");
      return "classificationNode";
  }
};

/**
 * BUILD THE WORKFLOW GRAPH
 */
const workflow = new StateGraph(PipelineStateAnnotation)
  .addNode("initialAnalysisNode", initialAnalysisNode)
  .addNode("classificationNode", classificationNode)
  .addNode("sectionPlanningNode", sectionPlanningNode)
  .addNode("sectionGeneratorNode", sectionGeneratorNode)
  .addNode("planAggregatorNode", planAggregatorNode)
  .addNode("retryHandlerNode", retryHandlerNode)
  .addEdge("__start__", "initialAnalysisNode")
  .addConditionalEdges("initialAnalysisNode", afterInitialAnalysis)
  .addConditionalEdges("classificationNode", afterClassification)
  .addConditionalEdges("sectionPlanningNode", afterSectionPlanning)
  .addConditionalEdges("sectionGeneratorNode", afterSectionGenerator)
  .addConditionalEdges("retryHandlerNode", afterRetry)
  .addEdge("planAggregatorNode", END);

const app = workflow.compile();

/**
 * PUBLIC API: Run the complete adaptive pipeline
 */
export async function runPipeline(
  req: generatePlanRequest
): Promise<generatePlanResponse> {
  console.log("\n🚀 ========================================");
  console.log("🚀 STARTING ADAPTIVE PLANNING PIPELINE");
  console.log("🚀 ========================================\n");

  const { prompt, history } = req;

  const initialState: PipelineState = {
    prompt,
    history: history || [],
    needsClarification: false,
    clarificationQuestions: [],
    projectCategory: "unknown",
    detectedTechStack: [],
    suggestedTechStack: [],
    projectComplexity: "moderate",
    currentThinking: null,
    thinkingHistory: [],
    planSections: [],
    requiredSections: [],
    generatedSections: new Set<string>(),
    finalPlan: null,
    retryCount: 0,
    maxRetries: 3,
    lastError: null,
    failedNode: null,
  };

  try {
    console.log("⚙️  Invoking state graph...");
    console.log(
      `📝 Initial prompt: "${prompt.substring(0, 100)}${
        prompt.length > 100 ? "..." : ""
      }"`
    );
    console.log(`📚 History length: ${history?.length || 0} messages\n`);

    const result = await app.invoke(initialState);

    console.log("\n📊 Pipeline Result Summary:");
    console.log(`   - Needs Clarification: ${result.needsClarification}`);
    console.log(`   - Final Plan Generated: ${!!result.finalPlan}`);
    console.log(`   - Last Error: ${result.lastError || "none"}`);
    console.log(`   - Failed Node: ${result.failedNode || "none"}`);
    console.log(`   - Retry Count: ${result.retryCount}/${result.maxRetries}`);
    console.log(
      `   - Sections Generated: ${result.generatedSections?.size || 0}/${
        result.requiredSections?.length || 0
      }`
    );

    // Handle clarification needed
    if (result.needsClarification && result.clarificationQuestions.length > 0) {
      const questions = result.clarificationQuestions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");

      console.log("\n❓ Clarification needed:");
      console.log(questions);

      return {
        success: false,
        data: null,
        message: `I need more information to create a detailed plan:\n\n${questions}\n\nPlease provide more details about your project.`,
        needsClarification: true,
      };
    }

    // Handle failure
    if (!result.finalPlan || result.lastError) {
      console.error("\n❌ Pipeline failed");
      console.error(`   Error: ${result.lastError}`);
      console.error(`   Failed node: ${result.failedNode}`);
      console.error(
        `   Retry count: ${result.retryCount}/${result.maxRetries}`
      );

      // Provide helpful error message
      let errorMessage = "Failed to generate plan. ";

      if (result.retryCount > result.maxRetries) {
        errorMessage += `Maximum retries (${result.maxRetries}) exceeded. `;
      }

      if (result.failedNode) {
        errorMessage += `Issue occurred at: ${result.failedNode}. `;
      }

      if (result.lastError) {
        errorMessage += `Details: ${result.lastError}`;
      } else {
        errorMessage +=
          "Please try again with more details or rephrase your request.";
      }

      return {
        success: false,
        data: null,
        message: errorMessage,
      };
    }

    // Success
    console.log("\n✅ ========================================");
    console.log("✅ PIPELINE COMPLETED SUCCESSFULLY");
    console.log("✅ ========================================\n");

    const planData: PlanData = {
      markdown: result.finalPlan,
      metadata: {
        generated_at: new Date().toISOString(),
        retryCount: result.retryCount,
        maxRetries: result.maxRetries,
        classification: result.projectCategory,
      },
    };

    return {
      success: true,
      data: planData,
      message: "Plan generated successfully",
    };
  } catch (error) {
    console.error("\n❌ ========================================");
    console.error("❌ PIPELINE EXECUTION ERROR");
    console.error("❌ ========================================");
    console.error(error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      success: false,
      data: null,
      message: `Pipeline failed: ${errorMessage}`,
    };
  }
}
