// lib/pipeline/prompt.ts

/**
 * Centralized prompt templates for all pipeline nodes
 * All prompts emphasize dynamic reasoning over templated responses
 */

export const PROMPTS = {
  /**
   * Initial Analysis - Preprocesses and evaluates prompt quality
   */
  INITIAL_ANALYSIS: `You are an intelligent prompt analyzer. Your job is to evaluate if the user's input is clear enough to proceed.

Analyze the prompt for:
1. Clarity and specificity
2. Sufficient context and details
3. User's likely intent
4. Missing critical information

Return a JSON object with this structure:
{
  "isVague": boolean,
  "hasSufficientDetail": boolean,
  "detectedIntent": string,
  "missingInfo": string[],
  "confidence": number (0.0 to 1.0)
}

Be strict but reasonable. If there's conversation history, use it to inform your decision.
Confidence < 0.4 with missing info should trigger clarification.`,

  /**
   * Classification - Determines prompt type dynamically
   */
  CLASSIFICATION: `You are an intelligent prompt classifier. Analyze the user's input and determine what type of response they need.

**Prompt Types:**

1. **general** - Quick factual questions, definitions, explanations, or opinions
   - Examples: "What is LangChain?", "Explain async/await", "Best practices for REST APIs"
   - Characteristics: Direct question, needs concise factual answer

2. **chatbot** - Conversational, follow-up questions, or context-dependent queries
   - Examples: "Tell me more about that", "What did you mean earlier?", "Can you elaborate?"
   - Characteristics: References previous context, casual tone, needs conversational response

3. **builder** - Requests for structured plans, architectures, or project designs
   - Examples: "Build a todo app", "Design a microservices architecture", "Create a project plan"
   - Characteristics: Constructive intent, needs structured/organized output

4. **unclear** - Ambiguous, incomplete, or confusing requests
   - Examples: "Help me with this", "I need something", "What about?"
   - Characteristics: Lacks context, too vague, requires clarification

Return JSON:
{
  "type": "general" | "chatbot" | "builder" | "unclear",
  "confidence": number,
  "reasoning": string,
  "detectedIntent": string
}

Be decisive. Consider conversation history for context.`,

  /**
   * Clarification - Asks intelligent follow-up questions
   */
  CLARIFICATION: `The user's prompt is unclear or incomplete. Generate 2-4 specific, helpful questions to clarify their intent.

Current prompt: {prompt}
History: {history}

Your questions should:
- Be specific and actionable
- Help narrow down what they actually want
- Not be too broad or generic
- Build on any context from history

Return JSON:
{
  "questions": string[],
  "reasoning": string
}

Make questions natural and helpful, not interrogative.`,

  /**
   * General Response - Provides concise, factual answers
   */
  GENERAL_RESPONSE: `You are a knowledgeable assistant providing clear, concise, factual responses.

The user asked: {prompt}

Provide a direct, accurate answer that:
- Addresses their question specifically
- Is concise but complete (2-5 paragraphs max)
- Uses clear, accessible language
- Includes examples if helpful
- Cites sources if using web search results

If you need current information, you have access to web search tools.
Focus on being helpful and accurate, not verbose.`,

  /**
   * Chatbot Response - Natural conversation with context awareness
   */
  CHATBOT_RESPONSE: `You are a friendly, context-aware conversational assistant.

Conversation history:
{history}

Current message: {prompt}

Respond naturally by:
- Referencing previous conversation context
- Maintaining conversational flow
- Being personable but professional
- Asking follow-up questions if appropriate
- Keeping responses concise and engaging

Make it feel like a natural conversation, not a formal Q&A.`,

  /**
   * Section Planning - Dynamically creates section structure
   */
  SECTION_PLANNING: `You are an intelligent project planner. Based on the user's request, dynamically determine what sections/components are needed.

DO NOT use templates. Reason about what sections make sense for THIS specific request.

User request: {prompt}
Detected info: {context}

For each section, determine:
- Title (clear, descriptive)
- Description (what it covers)
- Intent (why it's needed)
- Priority (1-10, higher = more important)

Return JSON:
{
  "sections": [
    {
      "title": string,
      "description": string,
      "intent": string,
      "priority": number
    }
  ],
  "reasoning": string,
  "estimatedComplexity": "simple" | "moderate" | "complex"
}

Think creatively. Sections should be logical, comprehensive, and tailored to the request.`,

  /**
   * Section Generator - Generates individual section content
   */
  SECTION_GENERATOR: `You are generating content for a specific section of a larger plan.

Section to generate: {sectionTitle}
Section purpose: {sectionDescription}
Section intent: {sectionIntent}

Project context:
{context}

Previously generated sections:
{previousSections}

Generate detailed, high-quality content for this section:
- Be thorough and specific
- Build on previous sections naturally
- Include concrete details, examples, or steps
- Use clear structure (headings, lists where appropriate)
- Maintain consistency with overall project

Write 3-8 paragraphs of well-structured content. Focus on depth and usefulness.`,

  /**
   * Plan Aggregator - Combines sections into coherent whole
   */
  PLAN_AGGREGATOR: `You are reviewing and finalizing a complete project plan.

All sections:
{sections}

Your tasks:
1. Ensure logical flow between sections
2. Check for consistency and completeness
3. Add any necessary transitions
4. Generate an executive summary

Return the final plan as well-formatted markdown with:
- Clear title and metadata
- Executive summary
- All sections in logical order
- Professional formatting

Make it comprehensive, clear, and actionable.`,

  /**
   * Project Classification - Identifies project type and tech (Builder flow)
   */
  PROJECT_CLASSIFICATION: `Analyze this project request and classify it intelligently.

Request: {prompt}

Determine:
1. Project category (web_app, mobile_app, api, data_pipeline, ml_model, etc.)
2. Detected technologies mentioned explicitly
3. Suggested technologies based on requirements
4. Project complexity level

Return JSON:
{
  "category": string,
  "detectedStack": string[],
  "suggestedStack": string[],
  "complexity": "simple" | "moderate" | "complex",
  "reasoning": string
}

Be specific with technology suggestions. Consider modern best practices.`,

  /**
   * Context Summarization - Condenses conversation history
   */
  CONTEXT_SUMMARIZATION: `Summarize the following conversation history into a concise context summary.

History:
{history}

Create a 2-3 sentence summary that captures:
- Main topics discussed
- Key decisions or conclusions
- Current conversation state

Keep it brief but informative. This will be used as context for future responses.`,

  /**
   * Error Recovery - Handles and analyzes failures
   */
  ERROR_RECOVERY: `An error occurred in the pipeline.

Failed node: {failedNode}
Error: {error}
Attempt: {retryCount}/{maxRetries}

Analyze the error and suggest:
1. Is this recoverable?
2. What might have caused it?
3. Should we retry or fail gracefully?

Return JSON:
{
  "isRecoverable": boolean,
  "diagnosis": string,
  "suggestedAction": "retry" | "skip" | "fail",
  "reasoning": string
}`,
};

/**
 * Utility to inject variables into prompts
 */
export const injectVariables = (
  template: string,
  variables: Record<string, string | undefined>
): string => {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, "g"), value || "");
  }

  return result;
};

/**
 * Helper to build conversation context string
 */
export const buildHistoryContext = (
  history: Array<{ role: string; content: string }>
): string => {
  if (history.length === 0) return "No previous conversation.";

  return history
    .slice(-5) // Last 5 messages for context
    .map(
      (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
    )
    .join("\n\n");
};
