import Sidebar from "../components/layout/Sidebar";
import ChatList from "../components/layout/ChatList";
import MessageThread from "../components/chat/MessageThread";

export default function ChatPage() {
    return (
        <div className="chat-shell">
            <Sidebar />
            <ChatList />
            <MessageThread />

            <style>{`
        .chat-shell {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }
      `}</style>
        </div>
    );
}
