import React, { useState, useEffect, useRef } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import UserAvatar from "../avatar/UserAvatar";
import { chatService } from "../../../services/common/chatService";
import { useAuth } from "../../../hooks/useAuth";
import { useAuthStore } from "../../../stores/authStore";
import { cn } from "../../../utils/cn";

function formatDateSafe(dateStr, pattern = "HH:mm") {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

/**
 * FloatingDirectChatWidget - Cửa sổ chat 1-on-1 nổi thời gian thực
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - targetUser: { id, full_name, avatar_url, email }
 * - taskContext: { id, title }
 */
export default function FloatingDirectChatWidget({
  isOpen,
  onClose,
  targetUser,
  taskContext,
}) {
  const { user: currentUser } = useAuth();

  const [directRoom, setDirectRoom] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatMessagesEndRef = useRef(null);

  const targetUserId = targetUser?.id || targetUser?.user_id;
  const targetUserName = targetUser?.full_name || targetUser?.name || "Staff Member";
  const targetAvatar = targetUser?.avatar_url || targetUser?.avatar;

  // Khởi tạo phòng chat 1-1 khi mở widget
  useEffect(() => {
    if (!isOpen || !targetUserId) return;

    let isMounted = true;
    setIsChatLoading(true);

    async function initChat() {
      try {
        const roomData = await chatService.startDirect(targetUserId);
        if (!isMounted) return;
        setDirectRoom(roomData);

        const roomId = roomData.id || roomData.room_id;
        if (roomId) {
          const messagesRes = await chatService.getRoomMessages(roomId);
          if (isMounted) {
            setDirectMessages(messagesRes.messages || []);
          }
        }
      } catch (err) {
        toast.error("Could not load direct chat room with employee.");
      } finally {
        if (isMounted) setIsChatLoading(false);
      }
    }

    initChat();

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUserId]);

  // Thiết lập WebSocket Realtime cho phòng chat 1-1
  useEffect(() => {
    const roomId = directRoom?.id || directRoom?.room_id;
    if (!isOpen || !roomId) return;

    const token = useAuthStore.getState().accessToken;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = token
      ? `${protocol}//${host}/ws/chat/${roomId}/?token=${token}`
      : `${protocol}//${host}/ws/chat/${roomId}/`;

    let socket = null;
    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "chat_message" && payload.data) {
            const newMsg = payload.data;
            setDirectMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      console.warn("[FloatingChat WS] Could not connect:", e);
    }

    return () => {
      if (socket) socket.close();
    };
  }, [isOpen, directRoom?.id, directRoom?.room_id]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (isOpen && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [directMessages, isOpen]);

  const handleSendDirectMessage = async () => {
    const textToSend = chatMessage.trim();
    const roomId = directRoom?.id || directRoom?.room_id;
    if (!textToSend || !roomId) return;

    setChatMessage("");
    setIsSendingMessage(true);

    try {
      const sentMsg = await chatService.sendMessage(roomId, {
        content: textToSend,
      });
      setDirectMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      toast.error("Failed to send message.");
      setChatMessage(textToSend);
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-3xl border border-slate-300 shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
      {/* Chat Header */}
      <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar
            avatarUrl={targetAvatar}
            fullName={targetUserName}
            size="xs"
          />
          <div className="min-w-0">
            <h3 className="font-bold text-xs text-white leading-tight truncate">
              {targetUserName}
            </h3>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online • 1-on-1 Channel
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages Body */}
      <div className="p-4 h-72 overflow-y-auto space-y-3 custom-scrollbar text-xs bg-slate-50">
        <div className="text-center">
          <span className="text-[10px] font-mono text-slate-500 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
            {taskContext?.title ? `Task: ${taskContext.title}` : `1-on-1 Direct Chat`}
          </span>
        </div>

        {isChatLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : directMessages.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-[11px] italic">
            No previous chat messages with {targetUserName}. Send a message below to ask about this task!
          </div>
        ) : (
          directMessages.map((msg) => {
            const isMe =
              msg.is_mine !== undefined
                ? msg.is_mine
                : msg.sender?.id === currentUser?.id || msg.sender_id === currentUser?.id;
            return (
              <div
                key={msg.id || Math.random()}
                className={cn("flex items-start gap-2", isMe ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "p-3 rounded-2xl max-w-[85%] leading-relaxed shadow-2xs",
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-xs"
                      : "bg-white text-slate-800 border border-slate-200 rounded-tl-xs"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={cn(
                      "text-[9px] mt-1 font-mono text-right",
                      isMe ? "text-blue-200" : "text-slate-400"
                    )}
                  >
                    {formatDateSafe(msg.created_at, "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatMessagesEndRef} />
      </div>

      {/* Chat Input Box */}
      <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          placeholder={`Message ${targetUserName}...`}
          disabled={isSendingMessage || isChatLoading}
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendDirectMessage();
            }
          }}
        />
        <button
          onClick={handleSendDirectMessage}
          disabled={isSendingMessage || !chatMessage.trim() || isChatLoading}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          title="Send Message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
