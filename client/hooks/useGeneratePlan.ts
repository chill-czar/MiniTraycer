import { useMutation } from "@tanstack/react-query";
import { generatePlan } from "@/lib/api/generatePlan";
import {
  generatePlanRequest,
  generatePlanResponse,
} from "@/types/generatePlan";

export function useGeneratePlan() {
  return useMutation<generatePlanResponse, Error, generatePlanRequest>({
    mutationFn: (data: generatePlanRequest) => generatePlan(data),
  });
}
