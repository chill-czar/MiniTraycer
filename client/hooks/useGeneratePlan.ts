import { useMutation } from "@tanstack/react-query";
import { generatePlan } from "@/lib/api/generatePlan";
import { GeneratePlanRequest, GeneratePlanResponse } from "@/types/api";

export function useGeneratePlan() {
  return useMutation<GeneratePlanResponse, Error, GeneratePlanRequest>({
    mutationFn: (data: GeneratePlanRequest) => generatePlan(data),
  });
}
