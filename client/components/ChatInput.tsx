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

    // Push user message
    dispatch(addMessage({ role: "user", content: message }));

    generatePlan(
      { prompt: message, history: messages },
      {
        onSuccess: (data) => {
          if (data.success && data.data) {
            // Map API data to ChatMessage
            const assistantMessage = {
              role: "assistant" as const,
              content: (data.data as any).content || "No content",
            };
            console.log(assistantMessage);
            dispatch(addMessage(assistantMessage));
          } else {
            toast.error("Plan generation failed", {
              description: data.message || "Unexpected error occurred.",
            });
          }
        },
        onError: (err: any) => {
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
          placeholder="Type your prompt..."
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
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Generate Plan"
          )}
        </Button>
      </div>
    </div>
  );
}