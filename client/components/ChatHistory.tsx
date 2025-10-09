"use client";

import React, { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { RootState } from "@/config/store";
import UserMessage from "@/components/UserMessage";
import AIMessage from "@/components/AIMessage";
import { Brain, Zap } from "lucide-react";
import { FaGithub } from "react-icons/fa";

export default function ChatHistory() {
  const messages = useSelector((state: RootState) => state.chats.messages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const demoPrompt = `Plan a complete SaaS platform for real-time team collaboration with chat, file sharing, and video calls. Include system architecture, tech stack, database structure, and deployment strategy.`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(demoPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // No messages state
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
                The <strong>Planning Layer</strong> is the core of Mini Traycer
                AI. It works as a **strategic reasoning system** that analyzes
                your idea, breaks it down into clear sections like architecture,
                tech stack, deployment, and then generates structured
                implementation plans.
              </p>

              <ul className="list-disc list-inside text-left space-y-1 sm:space-y-2 pl-2">
                <li>🧠 Understands vague or detailed requests</li>
                <li>🧩 Plans structured sections dynamically</li>
                <li>⚡ Generates implementation-ready project plans</li>
              </ul>

              {/* Demo prompt box */}
              <div className="bg-muted rounded-md p-3 text-left border mt-3">
                <p className="text-[11px] sm:text-xs font-medium text-muted-foreground mb-2">
                  💬 Try this demo prompt:
                </p>
                <p className="text-xs sm:text-sm break-words">{demoPrompt}</p>
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={copyToClipboard}
                  >
                    <span>{copied ? "Copied!" : "Copy Prompt"}</span>
                  </Button>
                </div>
              </div>

              {/* GitHub Button */}
              <div className="pt-3 sm:pt-4 flex justify-center">
                <a
                  href="https://github.com/chill-czar/MiniTraycer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="default"
                    className="flex items-center space-x-2 text-xs sm:text-sm h-8 sm:h-10 px-3 sm:px-4"
                  >
                    <FaGithub className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>View on GitHub</span>
                  </Button>
                </a>
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

  // Messages state
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
