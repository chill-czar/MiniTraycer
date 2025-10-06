"use client";

import React, { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { RootState } from "@/config/store";
import UserMessage from "@/components/UserMessage";
import AIMessage from "@/components/AIMessage";
import { Brain, Rocket, Zap } from "lucide-react";

export default function ChatHistory() {
  const messages = useSelector((state: RootState) => state.chats.messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // When no messages, render without ScrollArea
  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col items-center justify-center min-h-[60vh] sm:h-[70vh] text-center text-muted-foreground space-y-4 sm:space-y-6 px-4">
          <Card className="w-full max-w-xs sm:max-w-md md:max-w-lg border border-border/40 shadow-sm p-4 sm:p-6">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center justify-center sm:space-x-2 space-y-2 sm:space-y-0 text-primary">
                <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
                <CardTitle className="text-base sm:text-lg font-semibold text-center sm:text-left">
                  Traycer Mini — Planning Layer Demo
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-muted-foreground p-4 sm:p-6">
              <p className="leading-relaxed">
                This is a simplified version of <strong>Traycer AI</strong> — an
                intelligent planning assistant that sits{" "}
                <em>above coding agents</em> and helps them think in structured
                steps.
              </p>
              <p className="leading-relaxed">
                Start by describing a project idea or coding task. Traycer will:
              </p>
              <ul className="list-disc list-inside text-left space-y-1 sm:space-y-2 pl-2">
                <li>🧩 Analyze if your request is vague or detailed</li>
                <li>
                  🧱 Break it into structured sections (Overview, Architecture,
                  etc.)
                </li>
                <li>⚙️ Suggest tech stacks, data flow, and architecture</li>
              </ul>
              <div className="pt-3 sm:pt-4 flex justify-center">
                <Button
                  variant="default"
                  className="flex items-center space-x-2 text-xs sm:text-sm h-8 sm:h-10 px-3 sm:px-4"
                >
                  <Rocket className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Start Planning</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-[10px] sm:text-xs opacity-70 flex items-center justify-center flex-wrap px-4">
            <span>Built with</span>
            <Zap className="inline w-3 h-3 mx-1 text-yellow-500" />
            <span>TypeScript, Next.js, and Shadcn/UI</span>
          </div>
        </div>
      </div>
    );
  }

  // When messages exist, use ScrollArea
  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col w-[95%] sm:w-[95%] md:w-[85%] lg:w-[95%] xl:w-[95%] space-y-3 sm:space-y-4 mx-auto py-4 sm:py-6">
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
