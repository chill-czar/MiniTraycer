import { ChatMessage } from "@/redux/chatsSlice";

export type generatePlanRequest = {
  prompt: string;
  history: ChatMessage[]
};

export interface generatePlanResponse {
  data: JSON | null; // JSON is too strict, use `any` or `unknown`
  success: boolean;
  message?: string; // ✅ optional message for errors
}
