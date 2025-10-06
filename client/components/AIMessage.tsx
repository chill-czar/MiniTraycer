"use client";

import { Item } from "@/components/ui/item";
import React from "react";
import OptimizedMarkdown from "./Markdown";

interface AIMessageProps {
  content: string;
}

export default function AIMessage({ content }: AIMessageProps) {
  return (
    <Item
      asChild
      className="self-start w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%]
                 bg-secondary text-secondary-foreground 
                 rounded-lg sm:rounded-xl
                 p-3 sm:p-4 md:p-5
                 break-words shadow-sm 
                 cursor-default hover:bg-secondary/90 
                 transition-colors duration-200"
    >
      <div
        className="prose prose-xs sm:prose-sm md:prose-base 
                      break-words overflow-hidden
                      max-w-none
                      prose-headings:text-secondary-foreground
                      prose-p:text-secondary-foreground
                      prose-strong:text-secondary-foreground
                      prose-code:text-secondary-foreground
                      prose-pre:text-xs prose-pre:sm:text-sm
                      prose-pre:max-w-full prose-pre:overflow-x-auto"
      >
        <OptimizedMarkdown content={content} />
      </div>
    </Item>
  );
}
