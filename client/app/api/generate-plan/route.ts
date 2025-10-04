import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt , history } = await req.json();

  console.log("prompt:", prompt);
  console.log("history:", history );

  // Simulated demo response
  const demoPlan = {
    role: "assistant",
    content: `
# 🔍 Observations
- You want a simplified Traycer-style planning system.
- Input prompt should generate structured plan.

# 🧠 Approach
We will design a pipeline:
1. Take user prompt.
2. Send to \`/api/generate-plan\`.
3. Return structured plan.
4. Display in React Markdown.

# ✅ Steps
- [x] Setup Next.js API endpoint
- [x] Connect with TanStack Query
- [x] Store in Redux memory
- [ ] Build chat panel UI
- [ ] Extend with LLM later

# 📂 File Structure
\`\`\`
app/
 ├── api/
 │    └── generate-plan/
 │         └── route.ts
 ├── components/
 │    ├── ChatInput.tsx
 │    └── ChatPanel.tsx
 ├── lib/
 │    ├── api.ts
 │    └── redux/
 │         ├── planSlice.ts
 │         └── store.ts
\`\`\`

# 📊 Mermaid Diagram
\`\`\`mermaid
flowchart TD
    A[User Prompt] --> B[API /generate-plan]
    B --> C[Plan JSON]
    C --> D[Redux Store]
    D --> E[Chat Panel UI]
\`\`\`
    `,
  };

  return NextResponse.json({
    success: true,
    data: demoPlan,
  });
}
