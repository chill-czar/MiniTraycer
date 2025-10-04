import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  return (
    <>
      <div className="h-screen flex flex-col lg:flex-row">
        <div className="w-1/4">
          <ChatPanel />
        </div>
        <div className="flex-1">
          {/* Code block components */}
        </div>
      </div>
    </>
  );
}
