'use client';

/**
 * `app/chat/page.tsx` — a minimal streaming chat against the mounted runtime.
 * The hooks come from the same package the route handler did.
 */
import { useChat } from '@personaai/nextjs';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isStreaming } = useChat({
    agentId: process.env.NEXT_PUBLIC_PERSONA_AGENT_ID,
  });

  return (
    <main>
      {messages.map((message) => (
        <p key={message.id}>
          <strong>{message.role}:</strong> {message.content}
        </p>
      ))}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} disabled={isStreaming} />
        <button type="submit" disabled={isStreaming}>
          Send
        </button>
      </form>
    </main>
  );
}
