"use client";
import ChatInput from "@/components/ChatInput";
import ChatHistory from "./ChatHistory";

export default function ChatPanel() {
  return (
    <div className="flex flex-col h-full w-full md:w-3/4 lg:w-2/3 xl:w-2/4">
      <div className="flex-1 overflow-y-auto">
        <ChatHistory />
      </div>

      <div className="p-2 sm:p-3 md:p-4">
        <ChatInput />
      </div>
    </div>
  );
}
