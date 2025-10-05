// app/api/generate-plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { GeneratePlanRequest } from "@/types/generatePlan";

export async function POST(req: NextRequest) {
  try {
    const body: GeneratePlanRequest = await req.json();

    if (!body.prompt || typeof body.prompt !== "string") {
      return NextResponse.json(
        { success: false, data: null, message: "Invalid prompt" },
        { status: 400 }
      );
    }

    const response = await runPipeline(body);

    return NextResponse.json(response, {
      status: response.success ? 200 : 400,
    });
  } catch (error) {
    console.error("API Error:", error);

    return NextResponse.json(
      {
        success: false,
        data: null,
        message:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
