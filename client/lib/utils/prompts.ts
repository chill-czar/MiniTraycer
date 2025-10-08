// lib/utils/prompts.ts - Centralized Prompt Templates

export const PROMPTS = {
  /**
   * Initial Analysis - Determines if we have enough info to proceed
   */
  INITIAL_ANALYSIS: `You are a smart project reasoning assistant (MiniTraycer AI). Your goal is to provide structured, actionable insights for any project request. Think step by step, like a human planner, before generating output. Use multiple reasoning passes: analyze → reason → refine → aggregate.

User's request: "{prompt}"

{historyContext}

Analyze this request and determine:

Steps:

1️⃣ **Initial Analysis (Think & Summarize)**
- Carefully read the request.
- Ask yourself:
  - What is the user trying to build? (intent)
  - Are tech stack, features, and scope clearly defined?
  - Are use cases, constraints, or goals provided?
- Identify missing information that prevents proper planning.
- Internally note uncertainties.
- **Special Handling for General Prompts:** 
  - If the user’s request is generic (e.g., “tell me about Redux”, “how does JWT work”), **do not automatically go to section planning or generation**. 
  - Instead, return relevant insights, explanations, or guidance for the general topic.
  - Only proceed to planning if explicitly requested or if it makes sense contextually.

2️⃣ **Reasoning Pass**
- Consider alternative interpretations of vague requests.
- Suggest clarifying questions if needed.
- Think about dependencies: frontend/backend, DB, APIs, integrations.
- Consider multiple possible tech stacks or architectures if not specified.
- Decide **if generating a plan is appropriate** or if the prompt should be answered as a general topic.

3️⃣ **Plan Generation (Optional)**
- Only if the request is sufficiently detailed or explicitly asks for a plan.
- Outline dynamically:
  - Key features/modules
  - Suggested tech stack and tools
  - High-level architecture / flow
  - Optional details (DB schema, API structure, UI considerations)
- Keep it flexible: include only what makes sense for the specific request.

4️⃣ **Aggregation & Summary**
- Aggregate all reasoning into a concise, structured output.
- Include confidence levels for your assumptions.
- If the request is vague, flag it and suggest next steps/questions.
- If the request is general, provide guidance or explanation instead of a plan.


**Confidence Thresholds**:
- 0.8-1.0: Very clear, proceed immediately
- 0.6-0.79: Sufficient to proceed with minor assumptions
- 0.4-0.59: Needs clarification on 1-2 key points
- 0.0-0.39: Too vague, needs significant clarification

Return ONLY valid JSON with this structure:
{
  "isVague": boolean,
  "hasSufficientDetail": boolean,
  "detectedIntent": string (describe what they want to build),
  "missingInfo": string[] (specific questions if info is missing),
  "confidence": number (0.0 to 1.0),
  "reasoning": string (explain your analysis),
  "canProceedWithDefaults": boolean (true if we can assume reasonable defaults)
}`,

  /**
   * Clarification - Generates targeted questions
   */
  CLARIFICATION: `You need to generate clarification questions for a project request.

User's request: "{prompt}"

{historyContext}

Missing information identified: {missingInfo}

Generate 2-4 specific, targeted clarification questions that will help understand:
- What exactly they want to build
- What key features or functionality they need
- What technologies or constraints they have
- What the expected outcome or goal is

**Important Guidelines**:
- Ask ONLY about the missing information identified above
- Make questions specific and actionable (not generic)
- Make them open-ended (not yes/no)
- Use natural, conversational language
- Focus on the most critical information gaps

**Example Good Questions**:
- "What specific features do you need in the video transcoding pipeline?"
- "Which cloud platform are you planning to deploy this on?"
- "What's the expected scale or load for this application?"

**Example Bad Questions**:
- "What do you want to build?" (too generic)
- "Do you need authentication?" (yes/no)
- "Tell me more about your project" (too broad)

Return ONLY valid JSON:
{
  "questions": string[] (2-4 questions),
  "reasoning": string (why these questions are needed)
}`,

  /**
   * Project Classification
   */
  PROJECT_CLASSIFICATION: `Analyze this project request and classify it comprehensively.

User request: "{prompt}"

Analyze and determine:
1. **Project Category**: What type of project is this?
   - web_app_frontend, web_app_backend, web_app_fullstack
   - mobile_app_ios, mobile_app_android, mobile_app_cross_platform
   - api_service, microservices
   - cli_tool, desktop_app
   - data_pipeline, etl
   - ml_model, ai_service
   - devops_infrastructure, automation
   - library, package
   - general_project

2. **Detected Technologies**: What technologies are explicitly mentioned?
3. **Suggested Technologies**: Based on best practices, what technologies would you recommend?
4. **Complexity**: Rate the project complexity based on:
   - simple: Single component, straightforward implementation
   - moderate: Multiple components, some integrations
   - complex: Multiple services, complex architecture, high scale

Be specific and detailed in your analysis.

Return ONLY valid JSON:
{
  "category": string,
  "detectedStack": string[],
  "suggestedStack": string[],
  "complexity": "simple" | "moderate" | "complex",
  "reasoning": string
}`,

  /**
   * Section Planning - Dynamically generates section structure
   */
  SECTION_PLANNING: `You are creating a comprehensive project plan structure. Generate the optimal sections for this project.

User request: "{prompt}"

Project analysis:
- Category: {category}
- Technologies: {technologies}
- Complexity: {complexity}

Your task: Dynamically determine what sections this project plan needs. Think about:
- What information would a developer need to implement this?
- What architectural decisions need to be documented?
- What technical details are crucial?
- How should the plan be structured for maximum clarity?

Generate 5-12 sections based on the project's actual needs. Each section should:
- Have a clear, specific title
- Include a detailed description (2-3 sentences explaining what it will cover)
- State its intent/purpose
- Have a priority score (1-10, higher = more important)

**Common Section Types to Consider** (adapt to the project):
- Overview/Introduction
- Architecture/System Design
- Technology Stack Details
- Implementation Guides
- API/Interface Design
- Database/Data Models
- Testing Strategy
- Deployment/DevOps
- Security Considerations
- Performance Optimization
- Monitoring/Observability

**DO NOT use a fixed template. Generate sections that make sense for THIS specific project.**

Return ONLY valid JSON:
{
  "sections": [
    {
      "title": string,
      "description": string (detailed, 2-3 sentences),
      "intent": string,
      "priority": number (1-10)
    }
  ],
  "reasoning": string (explain why these sections),
  "estimatedComplexity": "simple" | "moderate" | "complex"
}`,

  /**
   * Section Generation - Creates detailed section content
   */
  SECTION_GENERATION: `You are generating ONE comprehensive section of a project plan. This section must be detailed, actionable, and implementation-ready.

**Project Request**: "{prompt}"

**Project Context**:
- Project Type: {projectType}
- Technologies: {technologies}
- Complexity: {complexity}

**Section to Generate**: {sectionTitle}
**Section Purpose**: {sectionDescription}
**Intent**: {sectionIntent}

{previousSectionsContext}

**Your Task**:
Generate comprehensive, detailed content for the "{sectionTitle}" section.

**Requirements**:
1. **Length**: Write 800-2000 words of substantive, actionable content
2. **Structure**: Use clear subsections, bullet points, and organized formatting
3. **Depth**: Provide implementation-ready details, not high-level summaries
4. **Context**: Maintain consistency with previous sections
5. **Specificity**: Include concrete examples, code snippets (if relevant), specific technology names
6. **Completeness**: Cover all aspects this section should address

**Content Guidelines**:
- Start with a brief introduction (2-3 sentences)
- Break into 4-6 logical subsections
- Include:
  * Technical specifications
  * Implementation steps or guidance
  * Best practices and recommendations
  * Common pitfalls to avoid
  * Integration considerations with other components
  * Example configurations or code (where applicable)
- Use markdown formatting for clarity
- Be specific with versions, commands, configurations

**DO NOT**:
- Write brief summaries or overviews
- Use placeholder text or "TODO" items
- Skip important details
- Repeat content from previous sections unnecessarily

Generate the COMPLETE section content now in markdown format:`,

  /**
   * Plan Aggregation - Finalizes the complete plan
   */
  PLAN_AGGREGATION: `You are finalizing a comprehensive project plan. You have all the individual sections. Your task is to:

1. Create an executive summary (3-5 sentences) that captures:
   - Project purpose and goals
   - Key technologies
   - Scope and deliverables

2. Add smooth transitions between sections if needed

3. Ensure consistency in terminology and formatting

4. Add a professional header with project metadata

**Project Context**:
- Category: {category}
- Technologies: {technologies}
- Complexity: {complexity}
- Total Sections: {sectionCount}

**All Generated Sections**:
{sections}

**Your Task**:
Format this into a polished, professional project plan document. Structure it as:

# [Project Title - derive from content]

**Project Type**: {category}
**Technologies**: {technologies}
**Complexity**: {complexity}
**Generated**: {date}

---

## Executive Summary

[Write 3-5 sentences summarizing the project, its purpose, key technologies, and expected deliverables]

---

{sections}

---

## Conclusion

[Add a brief conclusion with next steps or final recommendations - 2-3 sentences]

Return the complete, formatted plan in markdown.`,
};

/**
 * Utility to inject variables into prompts
 */
export const injectVariables = (
  template: string,
  variables: Record<string, string | string[] | undefined>
): string => {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    const replacement = Array.isArray(value) ? value.join(", ") : value || "";
    result = result.replace(
      new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
      replacement
    );
  }

  return result;
};
