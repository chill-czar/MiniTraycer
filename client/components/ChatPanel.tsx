"use client";
import ChatInput from "@/components/ChatInput";
import ChatHistory from "./ChatHistory";

export default function ChatPanel() {
  return (
    <div className="flex flex-col h-full w-2/4">
      <div className="flex-1 overflow-y-auto p-4">
        <ChatHistory />
      </div>

      <div className="">
        <ChatInput />
      </div>
    </div>
  );
}
