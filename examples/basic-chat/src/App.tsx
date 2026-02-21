import { AgentProvider, ChatInput, MessageList, useAgentContext } from "@neeter/react";

function Chat() {
  const { sendMessage } = useAgentContext();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Neeter Chat</h1>
      </header>
      <MessageList className="flex-1" />
      <div className="border-t">
        <ChatInput onSend={sendMessage} />
      </div>
    </div>
  );
}

export function App() {
  return (
    <AgentProvider>
      <Chat />
    </AgentProvider>
  );
}
