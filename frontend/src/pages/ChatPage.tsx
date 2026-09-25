import Sidebar from "../components/layout/Sidebar";
import ChatList from "../components/layout/ChatList";
import MessageThread from "../components/chat/MessageThread";

export default function ChatPage() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-void">
      <Sidebar />
      <div className="flex min-h-0 flex-1">
        <ChatList />
        <main
          aria-label="Conversation thread"
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          <MessageThread />
        </main>
      </div>
    </div>
  );
}
