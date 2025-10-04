import api from "@/config/axios";
import {
  generatePlanRequest,
  generatePlanResponse,
} from "@/types/generatePlan";

export async function generatePlan(
  data: generatePlanRequest
): Promise<generatePlanResponse> {
  try {
    const res = await api.post<generatePlanResponse>("/generate-plan", data);
    // console.log(res)
    return res.data;
  } catch (err: any) {
    // Return a consistent error format
    return {
      data: null, // ✅ add placeholder since `data` is required
      success: false,
      message:
        err.response?.data?.message || err.message || "API request failed",
    };
  }
}
