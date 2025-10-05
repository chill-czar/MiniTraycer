import { NextResponse } from "next/server";
import { runPipeline, type generatePlanRequest } from "@/lib/chains/pipeline";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, history = [] } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { 
          success: false, 
          message: "Prompt is required and must be a string." 
        },
        { status: 400 }
      );
    }

    // Validate history array
    if (!Array.isArray(history)) {
      return NextResponse.json(
        { 
          success: false, 
          message: "History must be an array." 
        },
        { status: 400 }
      );
    }

    // Construct the request object according to generatePlanRequest type
    const request: generatePlanRequest = {
      prompt,
      history, // Array of { role: "user" | "assistant", content: string }
    };

    // Run your Langchain + Langgraph pipeline
    const result = await runPipeline(request);
    
    // Check if result indicates missing information (clarification needed)
    if (!result.success && result.message) {
      // Return the clarifying prompt to the frontend
      return NextResponse.json({
        success: false,
        needsClarification: true,
        message: result.message,
        data: null,
      }, { status: 200 }); // 200 because this is expected behavior
    }

    // Check for other errors
    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message || "Failed to generate plan",
        data: null,
      }, { status: 500 });
    }

    // Success - return the generated plan
    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Plan generated successfully",
    });

  } catch (err: any) {
    console.error("Error in /api/generate-plan:", err);

    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Failed to generate plan",
        data: null,
      },
      { status: 500 }
    );
  }
}