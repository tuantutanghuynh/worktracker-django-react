import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from 'sonner';
import { getErrorMessage } from '../../utils/errorMessages';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Headphones, RefreshCw } from "lucide-react";
import { chatService } from "../../services/common/chatService";
import { useAuth } from "../../hooks/useAuth";
import { useNotificationStore } from "../../stores/useNotificationStore";
import SupportQueueList from "../../components/admin/support/SupportQueueList";
import SupportChatArea from "../../components/admin/support/SupportChatArea";
import SupportUserProfile from "../../components/admin/support/SupportUserProfile";

export default function AdminSupportDeskPage() {
  const { user: currentUser } = useAuth();
  const { clearRoomUnread } = useNotificationStore();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // States
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("PENDING"); // 'PENDING' | 'MANAGER' | 'EMPLOYEE' | 'ALL'
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showUserContext, setShowUserContext] = useState(true);

  // 1. Fetch Danh sách phòng Support (Chỉ lấy Direct Messages với User)
  const {
    data: roomsData,
    isLoading: loadingRooms,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ["admin-support-rooms"],
    queryFn: async () => {
      const res = await chatService.getRooms();
      return res?.direct_messages || res?.data?.direct_messages || [];
    },
    refetchInterval: 3000,
  });

  const supportRooms = roomsData || [];

  // 2. Phân loại và Lọc danh sách theo Tab
  const filteredRooms = useMemo(() => {
    return supportRooms.filter((room) => {
      const otherUser = room.other_participant || {};
      const name = (otherUser.full_name || "").toLowerCase();
      const email = (otherUser.email || "").toLowerCase();
      const dept = (otherUser.department_name || "").toLowerCase();
      const lastMsg = (room.last_message?.content || "").toLowerCase();
      const q = searchQuery.toLowerCase();

      // Search matching
      const matchesSearch = !q || name.includes(q) || email.includes(q) || dept.includes(q) || lastMsg.includes(q);
      if (!matchesSearch) return false;

      // Logic "Pending": Có unread_count > 0 HOẶC tin nhắn cuối cùng do User gửi (không phải Admin gửi)
      const lastMsgFromAdmin = room.last_message?.is_from_admin || room.last_message?.sender_role === "ADMIN" || room.last_message?.sender_id === currentUser?.id;
      const isPending = room.unread_count > 0 || (room.last_message && !lastMsgFromAdmin);
      const isManager = otherUser.role_code === "MANAGER" || otherUser.role === "MANAGER" || otherUser.role === 2;
      const isEmployee = !isManager && otherUser.role_code !== "ADMIN" && otherUser.role !== "ADMIN";

      if (filterTab === "PENDING") return isPending;
      if (filterTab === "MANAGER") return isManager;
      if (filterTab === "EMPLOYEE") return isEmployee;
      return true; // ALL
    });
  }, [supportRooms, searchQuery, filterTab, currentUser?.id]);

  // Đếm số lượng theo từng Tab
  const tabCounts = useMemo(() => {
    let pending = 0;
    let manager = 0;
    let employee = 0;

    supportRooms.forEach((r) => {
      const otherUser = r.other_participant || {};
      const lastMsgFromAdmin = r.last_message?.is_from_admin || r.last_message?.sender_role === "ADMIN" || r.last_message?.sender_id === currentUser?.id;
      const isPending = r.unread_count > 0 || (r.last_message && !lastMsgFromAdmin);
      const isMgr = otherUser.role_code === "MANAGER" || otherUser.role === "MANAGER" || otherUser.role === 2;
      const isEmp = !isMgr && otherUser.role_code !== "ADMIN" && otherUser.role !== "ADMIN";

      if (isPending) pending += 1;
      if (isMgr) manager += 1;
      if (isEmp) employee += 1;
    });

    return {
      all: supportRooms.length,
      pending,
      manager,
      employee,
    };
  }, [supportRooms, currentUser?.id]);

  // 3. Tải tin nhắn của phòng đang chọn
  const {
    data: messagesData,
    isLoading: loadingMessages,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["admin-support-messages", activeRoom?.id],
    queryFn: async () => {
      if (!activeRoom?.id) return [];
      const res = await chatService.getRoomMessages(activeRoom.id);
      return res?.messages || res?.data?.messages || [];
    },
    enabled: !!activeRoom?.id,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (messagesData) {
      setMessages(messagesData);
    }
  }, [messagesData]);

  // Cuộn xuống cuối khung chat khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Chọn phòng chat
  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    if (room?.id) {
      clearRoomUnread(room.id);
      queryClient.invalidateQueries({ queryKey: ["admin-support-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    }
  };

  // Gửi tin nhắn phản hồi từ Admin
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeRoom?.id || isSending) return;

    const content = inputMessage.trim();
    if (content.length > 4000) {
      alert("Message exceeds 4,000 characters limit.");
      return;
    }

    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      room: activeRoom.id,
      sender: {
        id: currentUser?.id,
        email: currentUser?.email,
        full_name: currentUser?.full_name || "Admin System",
        role_code: "ADMIN",
      },
      content,
      created_at: new Date().toISOString(),
      is_mine: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputMessage("");
    setIsSending(true);

    try {
      await chatService.sendMessage(activeRoom.id, { content });
      refetchMessages();
      refetchRooms();
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error(getErrorMessage(err, "Could not send the message. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  // Upload file đính kèm với 5 quy tắc an ninh
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom?.id) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File size exceeds maximum allowed limit of 20MB.");
      return;
    }

    const blockedExtensions = ["exe", "bat", "cmd", "sh", "vbs", "msi", "php", "py", "js", "html", "htm"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (blockedExtensions.includes(ext)) {
      alert(`File type .${ext} is strictly prohibited for security reasons.`);
      return;
    }

    setIsUploading(true);
    try {
      const uploadRes = await chatService.uploadAttachment(file);
      const attachment_url = uploadRes?.attachment_url || uploadRes?.data?.attachment_url;
      const attachment_name = uploadRes?.attachment_name || uploadRes?.data?.attachment_name || file.name;
      const attachment_size = uploadRes?.attachment_size || uploadRes?.data?.attachment_size || file.size;

      await chatService.sendMessage(activeRoom.id, {
        content: `Attached file: ${attachment_name}`,
        attachment_url,
        attachment_name,
        attachment_size,
      });

      refetchMessages();
      refetchRooms();
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error(getErrorMessage(err, "Could not upload the attachment. Please try again."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col bg-slate-100 antialiased overflow-hidden'>
      {/* Top Banner */}
      <div className='bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between shadow-2xs'>
        <div className='flex items-center space-x-3'>
          <div className='w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs'>
            <Headphones className='w-5 h-5' />
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-base font-bold text-slate-900'>Admin Support Desk</h1>
              <span className='px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-extrabold uppercase font-mono'>IT & Operations Hub</span>
            </div>
            <p className='text-xs text-slate-500'>Centralized inquiries & assistance queue for Managers & Employees</p>
          </div>
        </div>

        <div className='flex items-center space-x-2'>
          <button
            onClick={() => {
              refetchRooms();
              if (activeRoom) refetchMessages();
            }}
            className='px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer'
            title='Refresh inbox'>
            <RefreshCw className='w-3.5 h-3.5 text-slate-500' />
            <span className='hidden sm:inline'>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className='flex-1 flex overflow-hidden p-2 sm:p-4 gap-3 md:gap-4 max-w-[1700px] w-full mx-auto'>
        {/* Column 1: Queue List */}
        <SupportQueueList
          rooms={filteredRooms}
          loading={loadingRooms}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterTab={filterTab}
          setFilterTab={setFilterTab}
          tabCounts={tabCounts}
          activeRoom={activeRoom}
          onSelectRoom={handleSelectRoom}
        />

        {/* Column 2: Live Chat & Resolution */}
        <SupportChatArea
          activeRoom={activeRoom}
          messages={messages}
          loadingMessages={loadingMessages}
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          isSending={isSending}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          messagesEndRef={messagesEndRef}
          onBack={() => setActiveRoom(null)}
          onOpenProfile={() => setShowUserContext(true)}
          showUserContext={showUserContext}
          setShowUserContext={setShowUserContext}
        />

        {/* Column 3 & Mobile Drawer: User Profile */}
        <SupportUserProfile user={activeRoom?.other_participant} isOpen={showUserContext && !!activeRoom} onClose={() => setShowUserContext(false)} />
      </div>
    </div>
  );
}
