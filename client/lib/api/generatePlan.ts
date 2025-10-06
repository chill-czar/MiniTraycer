import api from "@/config/axios";
import {
  GeneratePlanRequest,
  GeneratePlanResponse,
} from "@/types/api";
import { AxiosError } from "axios";

export async function generatePlan(
  data: GeneratePlanRequest
): Promise<GeneratePlanResponse> {
  try {
    const res = await api.post<GeneratePlanResponse>("/generate-plan", data);
    
    return res.data;
  } catch (err) {
    
    if (err instanceof AxiosError) {
      return {
        data: null,
        success: false,
        message:
          err.response?.data?.message || err.message || "API request failed",
      };
    }

    return {
      data: null,
      success: false,
      message: err instanceof Error ? err.message : "API request failed",
    };
  }
}
