"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useGeneratePlan } from "@/hooks/useGeneratePlan";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { addMessage } from "@/redux/chatsSlice";
import { RootState } from "@/config/store";

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const { mutate: generatePlan, isPending } = useGeneratePlan();
  const dispatch = useDispatch();
  const messages = useSelector((state: RootState) => state.chats.messages);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    // Add user message to chat
    dispatch(addMessage({ role: "user", content: message }));

    // Prepare history in the format expected by the pipeline
    const history = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    generatePlan(
      { prompt: message, history },
      {
        onSuccess: (response) => {
          console.log("API Response:", response);

          // Handle clarification needed
          if (response.needsClarification) {
            const clarificationMessage = {
              role: "assistant" as const,
              content: response.message || "Please provide more information.",
            };
            dispatch(addMessage(clarificationMessage));

            toast.info("Need more information", {
              description: "Please answer the questions to continue.",
            });
            return;
          }

          // Handle error response
          if (!response.success) {
            const errorMessage = {
              role: "assistant" as const,
              content: `❌ Error: ${
                response.message || "Failed to generate plan"
              }`,
            };
            dispatch(addMessage(errorMessage));

            toast.error("Plan generation failed", {
              description: response.message || "Unexpected error occurred.",
            });
            return;
          }

          // Handle successful plan generation
          if (response.success && response.data) {
            const planData = response.data;

            // Format the assistant response with markdown plan
            const assistantMessage = {
              role: "assistant" as const,
              content: planData.markdown || "No plan content received.",
            };

            dispatch(addMessage(assistantMessage));

            // Optional: Show metadata in console
            if (planData.metadata) {
              console.log("Plan Metadata:", {
                classification: planData.metadata.classification,
                retryCount: planData.metadata.retryCount,
                generatedAt: planData.metadata.generated_at,
              });
            }

            toast.success("Plan generated successfully!", {
              description: `Type: ${
                planData.metadata?.classification || "unknown"
              }`,
            });
          }
        },
        onError: (err: any) => {
          console.error("API Error:", err);

          // Add error message to chat
          const errorMessage = {
            role: "assistant" as const,
            content: `❌ Request failed: ${
              err?.message || "Please try again later."
            }`,
          };
          dispatch(addMessage(errorMessage));

          toast.error("Plan request failed", {
            description: err?.message || "Please try again later.",
          });
        },
      }
    );

    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-3 border-t">
      <div className="relative">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your prompt... (e.g., 'Build a todo app with Next.js and PostgreSQL')"
          disabled={isPending}
          className="min-h-[100px] max-h-[140px] pr-28 resize-none
                     scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
                     hover:scrollbar-thumb-gray-400 transition-colors"
        />

        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isPending}
          size="default"
          className="absolute right-3 bottom-3"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            "Generate Plan"
          )}
        </Button>
      </div>
    </div>
  );
}
