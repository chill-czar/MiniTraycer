"use client";
import ChatInput from "@/components/ChatInput";
import ChatHistory from "./ChatHistory";

export default function ChatPanel() {
  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex-1 overflow-y-auto p-4">
        <ChatHistory />
      </div>

      <div className="border-t">
        <ChatInput />
      </div>
    </div>
  );
}
