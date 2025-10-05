import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  return (
    <>
      <div className="h-screen flex flex-col w-full lg:flex-row">
        <div className="w-full flex justify-center">
          <ChatPanel />
        </div>
      </div>
    </>
  );
}
