"use client";

import { Item } from "@/components/ui/item";
import React from "react";

interface UserMessageProps {
  content: string;
}

export default function UserMessage({ content }: UserMessageProps) {
  return (
    <Item
      asChild
      className="self-end w-fit 
                 max-w-[90%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%]
                 bg-primary text-primary-foreground 
                 rounded-lg sm:rounded-xl
                 p-3
                 break-words shadow-sm 
                 cursor-default hover:bg-primary/90
                 transition-colors duration-200
                 text-sm sm:text-base"
    >
      <div className="leading-relaxed">{content}</div>
    </Item>
  );
}
