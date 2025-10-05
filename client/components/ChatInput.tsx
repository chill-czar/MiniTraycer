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

    dispatch(addMessage({ role: "user", content: message }));

  
    const history = messages.map((msg) => ({
      role: msg.role,
      content: msg.summary || msg.content,
      summary: msg.summary,
    }));

    generatePlan(
      { prompt: message, history },
      {
        onSuccess: (response) => {
          if (response.needsClarification) {
            dispatch(
              addMessage({
                role: "assistant",
                content: response.message || "Please provide more information.",
              })
            );

            toast.info("Need more information", {
              description: "Please answer the questions to continue.",
            });
            return;
          }

          if (!response.success) {
            dispatch(
              addMessage({
                role: "assistant",
                content: `❌ Error: ${
                  response.message || "Failed to generate plan"
                }`,
              })
            );

            toast.error("Plan generation failed", {
              description: response.message || "Unexpected error occurred.",
            });
            return;
          }

          if (response.data) {
          
            dispatch(
              addMessage({
                role: "assistant",
                content: response.data.markdown,
                summary: response.data.summary,
              })
            );

            toast.success("Plan generated successfully!", {
              description: `Type: ${
                response.data.metadata?.classification || "unknown"
              }`,
            });
          }
        },
        onError: (err: Error) => {
          dispatch(
            addMessage({
              role: "assistant",
              content: `❌ Request failed: ${
                err?.message || "Please try again later."
              }`,
            })
          );

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
    <div className="p-3">
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
