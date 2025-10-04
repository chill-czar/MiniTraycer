"use client";

import React, { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSelector } from "react-redux";
import { RootState } from "@/config/store";
import UserMessage from "@/components/UserMessage";
import AIMessage from "@/components/AIMessage";

export default function ChatHistory() {
  const messages = useSelector((state: RootState) => state.chats.messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col w-[95%] space-y-3">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <UserMessage key={i} content={msg.content} />
          ) : (
            <AIMessage key={i} content={msg.content} />
          )
        )}
      </div>
    </ScrollArea>
  );
}
