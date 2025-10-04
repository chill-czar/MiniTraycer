"use client";

import React from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface OptimizedMarkdownProps {
  content: string;
}

// Custom components for ReactMarkdown
const markdownComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1 className="text-2xl font-bold mt-4 mb-2 break-words" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="text-xl font-semibold mt-3 mb-2 break-words" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-lg font-semibold mt-2 mb-1 break-words" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="mb-2 break-words whitespace-pre-wrap" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="list-disc ml-5 mb-2 break-words" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal ml-5 mb-2 break-words" {...props} />
  ),
  li: ({ node, ...props }) => <li className="mb-1 break-words" {...props} />,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-2">
      <table
        className="table-auto border border-border text-sm w-full"
        {...props}
      />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      className="border px-2 py-1 bg-muted font-medium text-left"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td className="border px-2 py-1 break-words" {...props} />
  ),
  code: ({ node, className, children, ...props }) => {
    // if (inline) {
    //   return (
    //     <code
    //       className="bg-gray-200 text-gray-900 px-1 py-[2px] rounded text-sm break-words"
    //       {...props}
    //     >
    //       {children}
    //     </code>
    //   );
    // }

    return (
      <pre className="overflow-x-auto bg-gray-100 text-gray-900 p-3 rounded my-2 whitespace-pre-wrap">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="border-l-2 border-muted pl-3 italic text-muted my-2 break-words"
      {...props}
    />
  ),
  img: ({ node, ...props }) => (
    <img className="rounded max-w-full my-2" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a className="text-blue-600 hover:underline break-all" {...props} />
  ),
  hr: ({ node, ...props }) => (
    <hr className="my-3 border-gray-300" {...props} />
  ),
  pre: ({ node, children, ...props }) => (
    <div className="overflow-x-auto bg-gray-100 text-gray-900 p-3 rounded my-2 whitespace-pre-wrap">
      <pre {...props}>{children}</pre>
    </div>
  ),
};

export default function OptimizedMarkdown({ content }: OptimizedMarkdownProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
