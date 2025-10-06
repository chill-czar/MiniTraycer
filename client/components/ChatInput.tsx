"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle } from "lucide-react";
import { useGeneratePlan } from "@/hooks/useGeneratePlan";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { addMessage } from "@/redux/chatsSlice";
import { RootState } from "@/config/store";
import {
  validateChatInput,
  sanitizeInput,
} from "@/lib/validators/chatValidator";
import { VALIDATION_MESSAGES } from "@/lib/constants/validationMessages";

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutate: generatePlan, isPending } = useGeneratePlan();
  const dispatch = useDispatch();
  const messages = useSelector((state: RootState) => state.chats.messages);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawValue = e.target.value;

    // Clear validation error on input change
    if (validationError) {
      setValidationError(null);
    }

    // Prevent excessive input during typing (soft limit)
    if (rawValue.length > 5000) {
      setValidationError(VALIDATION_MESSAGES.MESSAGE_TOO_LONG);
      return;
    }

    setMessage(rawValue);
  };

  const handleSendMessage = () => {
    // 1. Pre-validation checks
    if (isPending) return;

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setValidationError(VALIDATION_MESSAGES.MESSAGE_REQUIRED);
      toast.error("Validation Error", {
        description: VALIDATION_MESSAGES.MESSAGE_REQUIRED,
      });
      return;
    }

    // 2. Validate input using Zod schema
    const validation = validateChatInput(trimmedMessage);

    if (!validation.success) {
      const errorMessage =
        validation.error.errors[0]?.message ||
        VALIDATION_MESSAGES.INVALID_INPUT;
      setValidationError(errorMessage);
      toast.error("Invalid Input", {
        description: errorMessage,
      });
      return;
    }

    // 3. Sanitize the validated input
    const sanitizedMessage = sanitizeInput(validation.data.message);

    // 4. Double-check sanitization didn't remove everything
    if (!sanitizedMessage.trim()) {
      setValidationError(VALIDATION_MESSAGES.INVALID_CONTENT);
      toast.error("Invalid Content", {
        description: VALIDATION_MESSAGES.INVALID_CONTENT,
      });
      return;
    }

    // 5. Dispatch sanitized user message
    dispatch(
      addMessage({
        role: "user",
        content: sanitizedMessage,
      })
    );

    // 6. Prepare sanitized history
    const history = messages.map((msg) => ({
      role: msg.role,
      content: sanitizeInput(msg.summary || msg.content),
      summary: msg.summary ? sanitizeInput(msg.summary) : undefined,
    }));

    // 7. Make API request with sanitized data
    generatePlan(
      { prompt: sanitizedMessage, history },
      {
        onSuccess: (response) => {
          if (response.needsClarification) {
            const clarificationMsg = sanitizeInput(
              response.message || "Please provide more information."
            );

            dispatch(
              addMessage({
                role: "assistant",
                content: clarificationMsg,
              })
            );

            toast.info("Need more information", {
              description: "Please answer the questions to continue.",
            });
            return;
          }

          if (!response.success) {
            const errorMsg = sanitizeInput(
              response.message || "Failed to generate plan"
            );

            dispatch(
              addMessage({
                role: "assistant",
                content: `❌ Error: ${errorMsg}`,
              })
            );

            toast.error("Plan generation failed", {
              description: errorMsg,
            });
            return;
          }

          if (response.data) {
            // Sanitize response data before storing
            const sanitizedMarkdown = sanitizeInput(response.data.markdown);
            const sanitizedSummary = response.data.summary
              ? sanitizeInput(response.data.summary)
              : undefined;

            dispatch(
              addMessage({
                role: "assistant",
                content: sanitizedMarkdown,
                summary: sanitizedSummary,
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
          const errorMsg = sanitizeInput(
            err?.message || "Please try again later."
          );

          dispatch(
            addMessage({
              role: "assistant",
              content: `❌ Request failed: ${errorMsg}`,
            })
          );

          toast.error("Plan request failed", {
            description: errorMsg,
          });
        },
      }
    );

    // 8. Clear input after successful submission
    setMessage("");
    setValidationError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-2 sm:p-3 md:p-4">
      <div className="relative">
        <Textarea
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your prompt... (e.g., 'Build a todo app with Next.js and PostgreSQL')"
          disabled={isPending}
          aria-label="Chat message input"
          aria-invalid={!!validationError}
          aria-describedby={validationError ? "input-error" : undefined}
          className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] 
                     max-h-[120px] sm:max-h-[140px] md:max-h-[160px]
                     pr-20 sm:pr-28 md:pr-32
                     pb-12 sm:pb-14
                     resize-none text-sm sm:text-base
                     scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
                     hover:scrollbar-thumb-gray-400 transition-colors
                     ${
                       validationError
                         ? "border-red-500 focus:ring-red-500"
                         : ""
                     }`}
        />

        {validationError && (
          <div
            id="input-error"
            className="absolute left-2 bottom-12 sm:bottom-14 flex items-center gap-1 text-red-600 text-xs"
          >
            <AlertCircle className="h-3 w-3" />
            <span>{validationError}</span>
          </div>
        )}

        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isPending || !!validationError}
          size="default"
          className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3
                     text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2
                     h-8 sm:h-10"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
              <span className="xs:inline">Thinking...</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Generate Plan</span>
              <span className="inline sm:hidden">Generate</span>
            </>
          )}
        </Button>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-right">
        {message.length}/5000 characters
      </div>
    </div>
  );
}
