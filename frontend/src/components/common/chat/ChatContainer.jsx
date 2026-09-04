import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Search,
  Users,
  UserPlus,
  FileText,
  Download,
  X,
  Lock,
  RefreshCw,
  Hash,
  CheckCheck,
  Briefcase,
  User,
  Clock,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Phone,
  Mail,
  Building2,
  ArrowLeft,
} from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { chatService } from '../../../services/common/chatService';
import { useAuth } from '../../../hooks/useAuth';
import { useAuthStore } from '../../../stores/authStore';
import { cn } from '../../../utils/cn';
import UserAvatar from '../avatar/UserAvatar';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Format timestamp hiển thị trong danh sách tin nhắn
 */
function formatMessageTime(dateString) {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return format(date, 'HH:mm');
  } catch (e) {
    return '';
  }
}

/**
 * Format nhãn nhóm ngày (Date separator)
 */
function formatDateSeparator(dateString) {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (isNaN(date.getTime())) return '';
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd MMMM yyyy');
  } catch (e) {
    return '';
  }
}

/**
 * Format dung lượng file
 */
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Component Chat Doanh Nghiệp Toàn Diện (WorkTracker Pro Chat)
 * Chuẩn kiến trúc Slack / Discord / MS Teams
 */
export default function ChatContainer({
  initialJobId,
  initialDirectUserId,
  initialRoomId,
  customTitle,
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State quản lý phòng đang chọn
  const [activeRoom, setActiveRoom] = useState(null);

  // 🚀 REACT QUERY: Lấy danh sách phòng chat đồng bộ thời gian thực
  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => chatService.getRooms(),
    refetchInterval: 10000,
    enabled: Boolean(user),
  });

  const jobChannels = useMemo(() => {
    return Array.isArray(roomsData?.job_channels) ? roomsData.job_channels : [];
  }, [roomsData]);

  const directMessages = useMemo(() => {
    return Array.isArray(roomsData?.direct_messages) ? roomsData.direct_messages : [];
  }, [roomsData]);

  // State Panel Thành viên Kênh (Right Sidebar)
  const [showMembersPanel, setShowMembersPanel] = useState(true);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // State tin nhắn phòng hiện tại
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // State đính kèm tệp
  const [stagedFile, setStagedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  // State bộ lọc và tìm kiếm danh sách hội thoại
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'CHANNELS' | 'DIRECT'

  // State Danh bạ nhân viên mở chat 1-1
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [directorySearch, setDirectorySearch] = useState('');
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // State Typing Indicator
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  // Ref cuộn tin nhắn xuống cuối
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 🧹 HÀM XÓA BADGE UNREAD & ĐỒNG BỘ REACT QUERY
  const clearRoomUnread = useCallback((roomId) => {
    if (!roomId) return;
    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
  }, [queryClient]);

  const handleSelectRoom = useCallback((room) => {
    if (!room) return;
    setActiveRoom(room);
    clearRoomUnread(room.id);
  }, [clearRoomUnread]);

  const lastHandledDirectUserIdRef = useRef(null);

  // Chỉ tự động chọn phòng khi URL có chỉ định cụ thể (initialRoomId / initialJobId / initialDirectUserId)
  useEffect(() => {
    if (initialDirectUserId) return; // Ưu tiên direct chat

    if (initialRoomId && roomsData) {
      const all = [...(roomsData.job_channels || []), ...(roomsData.direct_messages || [])];
      const found = all.find((r) => String(r.id) === String(initialRoomId));
      if (found) {
        setActiveRoom(found);
        clearRoomUnread(found.id);
        if (roomsData.direct_messages?.some((d) => d.id === found.id)) setActiveTab('DIRECT');
      }
    } else if (initialJobId && roomsData?.job_channels) {
      const found = roomsData.job_channels.find(
        (c) => String(c.job) === String(initialJobId) || String(c.job_code) === String(initialJobId)
      );
      if (found) {
        setActiveRoom(found);
        clearRoomUnread(found.id);
        setActiveTab('CHANNELS');
      }
    }
  }, [initialRoomId, initialJobId, initialDirectUserId, roomsData, clearRoomUnread]);

  useEffect(() => {
    if (initialDirectUserId && lastHandledDirectUserIdRef.current !== String(initialDirectUserId)) {
      lastHandledDirectUserIdRef.current = String(initialDirectUserId);
      chatService
        .startDirect(initialDirectUserId)
        .then((dmRoom) => {
          if (dmRoom?.id) {
            setActiveRoom(dmRoom);
            clearRoomUnread(dmRoom.id);
            setActiveTab('DIRECT');
            queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
          }
        })
        .catch((e) => console.error('Could not auto-start direct room:', e));
    }
  }, [initialDirectUserId, clearRoomUnread, queryClient]);

  // ============================================================
  // 2. NẠP LỊCH SỬ TIN NHẮN KHI ĐỔI PHÒNG CHAT
  // ============================================================
  useEffect(() => {
    if (!activeRoom?.id) return;

    let isMounted = true;
    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await chatService.getRoomMessages(activeRoom.id);
        if (isMounted) {
          setMessages(data.messages || []);
          clearRoomUnread(activeRoom.id);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        console.error('Failed to load room messages:', err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    loadMessages();

    // ============================================================
    // 3. THIẾT LẬP KẾT NỐI WEBSOCKET REALTIME CHO PHÒNG ĐANG CHỌN
    // ============================================================
    const token = useAuthStore.getState().accessToken;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = token
      ? `${protocol}//${host}/ws/chat/${activeRoom.id}/?token=${token}`
      : `${protocol}//${host}/ws/chat/${activeRoom.id}/`;

    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'chat_message' && payload.data) {
            const newMsg = payload.data;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setTimeout(scrollToBottom, 50);

            // Đồng bộ danh sách phòng và tin nhắn mới nhất
            queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
          } else if (payload.type === 'typing_indicator' && payload.data) {
            const { user_id, user_name, is_typing } = payload.data;
            setTypingUsers((prev) => {
              if (is_typing) {
                return { ...prev, [user_id]: user_name };
              }
              const copy = { ...prev };
              delete copy[user_id];
              return copy;
            });
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      socket.onerror = (err) => {
        console.warn('[WS Chat] Connection error (using REST fallback):', err);
      };

      socket.onclose = () => {
        // Closed
      };
    } catch (e) {
      console.warn('[WS] Could not initiate WebSocket:', e);
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [activeRoom?.id]);

  // ============================================================
  // 4. XỬ LÝ GỬI TIN NHẮN (TEXT + TỆP ĐÍNH KÈM)
  // ============================================================
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !stagedFile) return;
    if (!activeRoom) return;

    if (activeRoom.is_archived) {
      toast.error('This project is closed. New messages are disabled.');
      return;
    }

    try {
      setSending(true);
      let attachmentData = {};

      if (stagedFile) {
        setUploadingFile(true);
        const uploadRes = await chatService.uploadAttachment(stagedFile);
        attachmentData = {
          attachment_url: uploadRes.attachment_url,
          attachment_name: uploadRes.attachment_name,
          attachment_size: uploadRes.attachment_size,
        };
        setUploadingFile(false);
        setStagedFile(null);
      }

      const payload = {
        content: inputText.trim(),
        ...attachmentData,
      };

      const res = await chatService.sendMessage(activeRoom.id, payload);

      setMessages((prev) => {
        if (prev.some((m) => m.id === res.id)) return prev;
        return [...prev, { ...res, is_mine: true }];
      });

      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });

      setInputText('');
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Send message failed:', err);
      toast.error(getErrorMessage(err, 'Could not send the message. Please try again.'));
    } finally {
      setSending(false);
      setUploadingFile(false);
    }
  };

  // ============================================================
  // 5. XỬ LÝ CHỌN FILE ĐÍNH KÈM AN TOÀN
  // ============================================================
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds 20MB limit.');
      return;
    }

    setStagedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ============================================================
  // 6. XỬ LÝ MỞ CHAT 1-1 TỪ DANH BẠ HOẶC TỪ CHANNEL MEMBER
  // ============================================================
  const handleOpenDirectory = async () => {
    try {
      setShowDirectoryModal(true);
      setLoadingDirectory(true);
      const data = await chatService.getDirectory();
      setDirectoryUsers(data || []);
    } catch (err) {
      console.error('Failed to load directory:', err);
      toast.error('Failed to load employee directory');
    } finally {
      setLoadingDirectory(false);
    }
  };

  const handleStartDirectChat = async (targetUser) => {
    if (!targetUser?.id) return;
    if (targetUser.id === user?.id) {
      toast.info('This is your own account.');
      return;
    }

    try {
      const room = await chatService.startDirect(targetUser.id);
      setShowDirectoryModal(false);
      setActiveRoom(room);
      setActiveTab('DIRECT');
      toast.success(`Direct conversation with ${targetUser.full_name || targetUser.email}`);
    } catch (err) {
      console.error('Failed to start DM:', err);
      toast.error('Failed to start conversation');
    }
  };

  // ============================================================
  // 7. LỌC DANH SÁCH PHÒNG CHAT THEO TÌM KIẾM & TAB
  // ============================================================
  const filteredChannels = useMemo(() => {
    return jobChannels.filter((c) =>
      (c.name || c.job_name || c.job_code || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [jobChannels, searchQuery]);

  const filteredDMs = useMemo(() => {
    return directMessages.filter((d) => {
      const name = d.other_participant?.full_name || d.other_participant?.email || d.name || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [directMessages, searchQuery]);

  // Danh sách thành viên kênh hiện tại (được phân loại)
  const channelParticipants = useMemo(() => {
    if (!activeRoom || activeRoom.room_type !== 'JOB') return { leads: [], members: [] };
    const rawList = Array.isArray(activeRoom.participants) ? activeRoom.participants : [];
    
    const filtered = rawList.filter((m) => {
      if (!memberSearchQuery.trim()) return true;
      const q = memberSearchQuery.toLowerCase();
      return (
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.department_name || '').toLowerCase().includes(q)
      );
    });

    const leads = filtered.filter((m) => m.role === 'MANAGER' || m.role === 'ADMIN');
    const members = filtered.filter((m) => m.role !== 'MANAGER' && m.role !== 'ADMIN');

    return { leads, members, total: filtered.length };
  }, [activeRoom, memberSearchQuery]);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden select-none">
      {/* ============================================================
          CỘT TRÁI (310px): DANH SÁCH KÊNH DỰ ÁN & CHAT 1-1
         ============================================================ */}
      <div
        className={cn(
          'w-full md:w-80 border-r border-slate-200 flex-col bg-slate-50/50 shrink-0',
          activeRoom ? 'hidden md:flex' : 'flex'
        )}
      >
        {/* Header danh sách */}
        <div className="p-4 border-b border-slate-200/80 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">{customTitle || 'Team Messages'}</h2>
            </div>
            <button
              onClick={handleOpenDirectory}
              title="Start direct message with colleague"
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New DM</span>
            </button>
          </div>

          {/* Ô tìm kiếm cuộc trò chuyện */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels or colleagues..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bộ lọc Tab (All / Channels / Direct) */}
          <div className="flex items-center gap-1 mt-2.5 p-0.5 bg-slate-100/90 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('ALL')}
              className={cn(
                'flex-1 py-1 text-center rounded-md transition-all cursor-pointer',
                activeTab === 'ALL' && 'bg-white text-blue-600 shadow-xs font-semibold'
              )}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('CHANNELS')}
              className={cn(
                'flex-1 py-1 text-center rounded-md transition-all cursor-pointer',
                activeTab === 'CHANNELS' && 'bg-white text-blue-600 shadow-xs font-semibold'
              )}
            >
              Channels ({jobChannels.length})
            </button>
            <button
              onClick={() => setActiveTab('DIRECT')}
              className={cn(
                'flex-1 py-1 text-center rounded-md transition-all cursor-pointer',
                activeTab === 'DIRECT' && 'bg-white text-blue-600 shadow-xs font-semibold'
              )}
            >
              People ({directMessages.length})
            </button>
          </div>
        </div>

        {/* Danh sách cuộn các phòng chat */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
          {loadingRooms ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mb-2 text-blue-500" />
              <span>Loading conversations...</span>
            </div>
          ) : (
            <>
              {/* KHỐI 1: KÊNH DỰ ÁN (JOB CHANNELS) */}
              {(activeTab === 'ALL' || activeTab === 'CHANNELS') && (
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-blue-500" />
                      <span>Project Channels</span>
                    </span>
                    <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                      {filteredChannels.length}
                    </span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {filteredChannels.length === 0 ? (
                      <p className="text-[11px] text-slate-400 px-3 py-2 italic">No channels found</p>
                    ) : (
                      filteredChannels.map((room) => {
                        const isActive = activeRoom?.id === room.id;
                        return (
                          <button
                            key={`job-${room.id}`}
                            onClick={() => handleSelectRoom(room)}
                            className={cn(
                              'w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition-all relative cursor-pointer',
                              isActive
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'hover:bg-slate-200/60 text-slate-700 bg-transparent'
                            )}
                          >
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono font-bold text-xs',
                                isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                              )}
                            >
                              <Hash className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span
                                  className={cn(
                                    'text-xs font-semibold truncate',
                                    isActive ? 'text-white' : 'text-slate-900'
                                  )}
                                >
                                  {room.name || `#${room.job_code}: ${room.job_name}`}
                                </span>
                                {room.last_message?.created_at && (
                                  <span
                                    className={cn(
                                      'text-[10px] font-mono shrink-0 ml-1',
                                      isActive ? 'text-blue-100' : 'text-slate-400'
                                    )}
                                  >
                                    {formatMessageTime(room.last_message.created_at)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <p
                                  className={cn(
                                    'text-[11px] truncate',
                                    isActive ? 'text-blue-100' : 'text-slate-500'
                                  )}
                                >
                                  {room.last_message?.content || 'No messages yet'}
                                </p>
                                {room.unread_count > 0 && (
                                  <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full shrink-0">
                                    {room.unread_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* KHỐI 2: TIN NHẮN TRỰC TIẾP (DIRECT MESSAGES 1-1) */}
              {(activeTab === 'ALL' || activeTab === 'DIRECT') && (
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-purple-500" />
                      <span>Direct Messages</span>
                    </span>
                    <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                      {filteredDMs.length}
                    </span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {filteredDMs.length === 0 ? (
                      <div className="p-3 text-center bg-white rounded-xl border border-slate-200/70 space-y-1">
                        <p className="text-[11px] text-slate-500">No active 1-on-1 chats</p>
                        <button
                          onClick={handleOpenDirectory}
                          className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          Start a Direct Chat
                        </button>
                      </div>
                    ) : (
                      filteredDMs.map((room) => {
                        const isActive = activeRoom?.id === room.id;
                        const otherUser = room.other_participant || {};
                        const displayName = otherUser.full_name || otherUser.email || 'Colleague';

                        return (
                          <button
                            key={`dm-${room.id}`}
                            onClick={() => handleSelectRoom(room)}
                            className={cn(
                              'w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition-all relative cursor-pointer',
                              isActive
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'hover:bg-slate-200/60 text-slate-700 bg-transparent'
                            )}
                          >
                            <UserAvatar
                              user={otherUser}
                              name={displayName}
                              size="sm"
                              showStatus={true}
                              isOnline={true}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span
                                  className={cn(
                                    'text-xs font-semibold truncate flex items-center gap-1.5',
                                    isActive ? 'text-white' : 'text-slate-900'
                                  )}
                                >
                                  <span className="truncate">{displayName}</span>
                                  {(otherUser.role_code === 'ADMIN' ||
                                    otherUser.role === 'ADMIN' ||
                                    otherUser.role === 1) && (
                                    <span
                                      className={cn(
                                        'px-1.5 py-0.2 rounded font-mono text-[9px] font-extrabold shrink-0',
                                        isActive
                                          ? 'bg-white text-purple-900'
                                          : 'bg-purple-600 text-white'
                                      )}
                                    >
                                      ADMIN
                                    </span>
                                  )}
                                </span>
                                {room.last_message?.created_at && (
                                  <span
                                    className={cn(
                                      'text-[10px] font-mono shrink-0 ml-1',
                                      isActive ? 'text-blue-100' : 'text-slate-400'
                                    )}
                                  >
                                    {formatMessageTime(room.last_message.created_at)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <p
                                  className={cn(
                                    'text-[11px] truncate',
                                    isActive ? 'text-blue-100' : 'text-slate-500'
                                  )}
                                >
                                  {room.last_message?.content || 'Started a conversation'}
                                </p>
                                {room.unread_count > 0 && (
                                  <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full shrink-0">
                                    {room.unread_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ============================================================
          CỘT GIỮA: KHUNG CHAT REALTIME TẬP TRUNG
         ============================================================ */}
      <div
        className={cn(
          'flex-1 flex-col bg-slate-50/30 overflow-hidden min-w-0',
          activeRoom ? 'flex' : 'hidden md:flex'
        )}
      >
        {activeRoom ? (
          <>
            {/* Header phòng chat đang chọn */}
            <div className="h-16 px-4 md:px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 md:space-x-3 min-w-0">
                {/* Nút quay lại danh sách trên màn hình nhỏ (Phong cách Zalo/Messenger) */}
                <button
                  onClick={() => setActiveRoom(null)}
                  className="md:hidden p-2 -ml-1.5 mr-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
                  title="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                {activeRoom.room_type === 'JOB' ? (
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                    <Hash className="w-5 h-5" />
                  </div>
                ) : (
                  <UserAvatar
                    user={activeRoom.other_participant}
                    size="md"
                    showStatus={true}
                    isOnline={true}
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {activeRoom.room_type === 'JOB'
                        ? activeRoom.name || `#${activeRoom.job_code}: ${activeRoom.job_name}`
                        : activeRoom.other_participant?.full_name || activeRoom.other_participant?.email}
                    </h3>
                    {activeRoom.room_type === 'DIRECT' &&
                      (activeRoom.other_participant?.role_code === 'ADMIN' ||
                        activeRoom.other_participant?.role === 'ADMIN' ||
                        activeRoom.other_participant?.role === 1) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white shadow-2xs">
                          👑 SYSTEM ADMIN
                        </span>
                      )}
                    {activeRoom.is_archived && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <Lock className="w-3 h-3" /> Read-Only
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {activeRoom.room_type === 'JOB'
                      ? `Project Channel • ${activeRoom.participants?.length || activeRoom.participants_count || 1} team members`
                      : `${activeRoom.other_participant?.role || 'Team Member'} • ${activeRoom.other_participant?.department_name || 'WorkTracker'}`}
                  </p>
                </div>
              </div>

              {/* Nút hành động bổ trợ (Toggle Members & Refresh) */}
              <div className="flex items-center space-x-2">
                {activeRoom.room_type === 'JOB' && (
                  <button
                    onClick={() => setShowMembersPanel((prev) => !prev)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer',
                      showMembersPanel
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    )}
                    title="Toggle channel members panel"
                  >
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Members ({activeRoom.participants?.length || activeRoom.participants_count || 1})</span>
                  </button>
                )}

                <button
                  onClick={() => fetchRooms(activeRoom.job)}
                  title="Refresh chat room"
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Khung cuộn danh sách tin nhắn */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mb-2 text-blue-500" />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 mb-1">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">No messages in this conversation yet</p>
                  <p className="text-slate-400">Send the first message to start the discussion!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMine = msg.is_mine || (user && msg.sender?.id === user.id);
                  const showAvatar =
                    !isMine &&
                    (index === 0 || messages[index - 1]?.sender?.id !== msg.sender?.id);
                  const senderName = msg.sender?.full_name || msg.sender?.email?.split('@')[0] || 'User';

                  return (
                    <div
                      key={`msg-${msg.id || index}`}
                      className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}
                    >
                      {/* Tên người gửi trong Kênh nhóm - Cho phép click Chat 1-1 */}
                      {!isMine && activeRoom.room_type === 'JOB' && showAvatar && (
                        <button
                          type="button"
                          onClick={() => handleStartDirectChat(msg.sender)}
                          title={`Click to send direct message to ${senderName}`}
                          className="text-[11px] font-bold text-slate-700 hover:text-blue-600 mb-1 ml-9 flex items-center gap-1.5 group cursor-pointer"
                        >
                          <span>{senderName}</span>
                          <span className="text-[10px] font-normal text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            (Direct Chat)
                          </span>
                        </button>
                      )}

                      <div className={cn('flex items-end gap-2 max-w-[75%]', isMine && 'flex-row-reverse')}>
                        {/* Avatar người gửi */}
                        {!isMine && (
                          <div
                            onClick={() => handleStartDirectChat(msg.sender)}
                            className="cursor-pointer"
                            title={`Chat with ${senderName}`}
                          >
                            <UserAvatar
                              user={msg.sender}
                              name={senderName}
                              size="xs"
                              className="w-7 h-7 shrink-0 hover:ring-2 hover:ring-blue-400 transition"
                            />
                          </div>
                        )}

                        {/* Bong bóng tin nhắn */}
                        <div
                          className={cn(
                            'p-3.5 rounded-2xl text-xs space-y-2 relative shadow-xs leading-relaxed',
                            isMine
                              ? 'bg-blue-600 text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                          )}
                        >
                          {/* File đính kèm nếu có */}
                          {msg.attachment_url && (
                            <div
                              className={cn(
                                'p-2.5 rounded-xl flex items-center justify-between gap-3 border',
                                isMine
                                  ? 'bg-blue-700/60 border-blue-500/50 text-white'
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className={cn('w-5 h-5 shrink-0', isMine ? 'text-blue-200' : 'text-blue-600')} />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate max-w-[180px]">
                                    {msg.attachment_name || 'Attachment File'}
                                  </p>
                                  <span className={cn('text-[10px]', isMine ? 'text-blue-200' : 'text-slate-400')}>
                                    {formatFileSize(msg.attachment_size)}
                                  </span>
                                </div>
                              </div>
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className={cn(
                                  'p-1.5 rounded-lg transition-colors shrink-0',
                                  isMine ? 'hover:bg-blue-600 text-white' : 'hover:bg-slate-200 text-slate-600'
                                )}
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          )}

                          {/* Nội dung văn bản */}
                          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

                          {/* Thời gian gửi */}
                          <div
                            className={cn(
                              'text-[10px] text-right font-mono flex items-center justify-end gap-1 mt-1 opacity-75',
                              isMine ? 'text-blue-100' : 'text-slate-400'
                            )}
                          >
                            <span>{formatMessageTime(msg.created_at)}</span>
                            {isMine && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Thanh trạng thái Typing indicator */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="px-6 py-1 bg-transparent text-[11px] text-slate-500 italic flex items-center gap-1.5 animate-pulse">
                <span>{Object.values(typingUsers).join(', ')} is typing</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-100" />
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-200" />
                </span>
              </div>
            )}

            {/* ============================================================
                KHUNG NHẬP TIN NHẮN & NỘP FILE ĐÍNH KÈM
               ============================================================ */}
            <div className="p-4 border-t border-slate-200 bg-white">
              {activeRoom.is_archived ? (
                <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>This project is completed and archived as read-only. New messages are disabled.</span>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-2">
                  {stagedFile && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs">
                      <FileText className="w-4 h-4" />
                      <span className="font-semibold truncate max-w-[200px]">{stagedFile.name}</span>
                      <span className="text-[10px] text-blue-500">({formatFileSize(stagedFile.size)})</span>
                      <button
                        type="button"
                        onClick={() => setStagedFile(null)}
                        className="p-0.5 hover:bg-blue-100 rounded-full text-blue-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      title="Attach file (Max 20MB)"
                      className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        activeRoom.room_type === 'JOB'
                          ? `Message ${activeRoom.name || activeRoom.job_code}... (Press Enter to send)`
                          : `Message ${activeRoom.other_participant?.full_name || 'colleague'}...`
                      }
                      className="flex-1 px-4 py-2.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs text-slate-900 rounded-xl border border-transparent focus:border-blue-400 focus:outline-none transition-all"
                    />

                    <button
                      type="submit"
                      disabled={(!inputText.trim() && !stagedFile) || sending || uploadingFile}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                    >
                      {sending || uploadingFile ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Send</span>
                          <Send className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-3 stroke-1" />
            <p className="font-semibold text-slate-700 text-sm">Select a conversation to start messaging</p>
            <p className="text-slate-400 mt-1">Choose a project channel on the left or click New DM to start a 1-on-1 chat.</p>
          </div>
        )}
      </div>

      {/* ============================================================
          CỘT PHẢI (280px): DANH SÁCH THÀNH VIÊN KÊNH (CHANNEL MEMBERS PANEL)
         ============================================================ */}
      {activeRoom?.room_type === 'JOB' && showMembersPanel && (
        <>
          {/* Backdrop mờ trên Mobile */}
          <div
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
            onClick={() => setShowMembersPanel(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-80 md:static md:z-auto md:w-72 border-l border-slate-200 bg-white flex flex-col shrink-0 animate-fade-in shadow-2xl md:shadow-none">
            {/* Header Panel */}
            <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2 min-w-0">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
                  Channel Members ({channelParticipants.total})
                </h3>
              </div>
              <button
                onClick={() => setShowMembersPanel(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                title="Close members panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ô lọc thành viên trong kênh */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Filter members..."
                  className="w-full pl-8 pr-2.5 py-1 bg-slate-100 text-[11px] rounded-lg border border-transparent focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Danh sách thành viên */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
              {/* Nhóm 1: QUẢN LÝ / LEADS */}
              {channelParticipants.leads.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider px-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Project Lead / Manager ({channelParticipants.leads.length})</span>
                  </p>
                  <div className="space-y-1">
                    {channelParticipants.leads.map((m) => {
                      const isSelf = m.id === user?.id;
                      return (
                        <div
                          key={`lead-${m.id}`}
                          className="p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between transition group"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <UserAvatar user={m} size="xs" showStatus={true} isOnline={m.is_active} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {m.full_name} {isSelf && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{m.department_name}</p>
                            </div>
                          </div>

                          {!isSelf && (
                            <button
                              onClick={() => handleStartDirectChat(m)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer opacity-0 group-hover:opacity-100"
                              title={`Send direct message to ${m.full_name}`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nhóm 2: THÀNH VIÊN / ASSIGNEES */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>Assigned Staff ({channelParticipants.members.length})</span>
                </p>
                <div className="space-y-1">
                  {channelParticipants.members.length === 0 ? (
                    <p className="text-[11px] text-slate-400 px-1 italic">No staff members found</p>
                  ) : (
                    channelParticipants.members.map((m) => {
                      const isSelf = m.id === user?.id;
                      return (
                        <div
                          key={`member-${m.id}`}
                          className="p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between transition group"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <UserAvatar user={m} size="xs" showStatus={true} isOnline={m.is_active} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 truncate">
                                {m.full_name} {isSelf && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{m.department_name}</p>
                            </div>
                          </div>

                          {!isSelf && (
                            <button
                              onClick={() => handleStartDirectChat(m)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer opacity-80 group-hover:opacity-100"
                              title={`Send direct message to ${m.full_name}`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============================================================
          MODAL DANH BẠ NHÂN SỰ ĐỂ BẮT ĐẦU CHAT 1-1
         ============================================================ */}
      {showDirectoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">New Direct Message</h3>
                  <p className="text-[11px] text-slate-500">Select a colleague to start a 1-on-1 conversation</p>
                </div>
              </div>
              <button
                onClick={() => setShowDirectoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search by name, email, department..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {loadingDirectory ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  <span>Loading colleagues...</span>
                </div>
              ) : (() => {
                const query = directorySearch.toLowerCase();
                const filtered = directoryUsers.filter((u) => {
                  return (
                    (u.full_name || '').toLowerCase().includes(query) ||
                    (u.email || '').toLowerCase().includes(query) ||
                    (u.department_name || '').toLowerCase().includes(query)
                  );
                });

                const currentUserRole = (user?.role_code || user?.role || '').toUpperCase();
                const isCurrentManager = currentUserRole === 'MANAGER' || currentUserRole === '2';

                const adminUsers = filtered.filter(
                  (u) => (u.role_code || u.role) === 'ADMIN' || (u.role_code || u.role) === 1
                );
                const managerUsers = filtered.filter(
                  (u) => (u.role_code || u.role) === 'MANAGER' || (u.role_code || u.role) === 2
                );
                const staffUsers = filtered.filter(
                  (u) =>
                    (u.role_code || u.role) !== 'ADMIN' &&
                    (u.role_code || u.role) !== 1 &&
                    (u.role_code || u.role) !== 'MANAGER' &&
                    (u.role_code || u.role) !== 2
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-8 text-center text-slate-400 text-xs italic">
                      No matching colleagues or administrators found
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* KHỐI 1: BAN QUẢN TRỊ & HỖ TRỢ HỆ THỐNG */}
                    {adminUsers.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-extrabold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span>System Administrators &amp; Support ({adminUsers.length})</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {adminUsers.map((u) => (
                            <button
                              key={`admin-${u.id}`}
                              onClick={() => handleStartDirectChat(u)}
                              className="w-full p-2.5 bg-purple-50/70 hover:bg-purple-100/80 border border-purple-200/80 rounded-xl flex items-center justify-between transition-colors text-left group cursor-pointer shadow-2xs"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <UserAvatar user={u} size="sm" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                    <span>{u.full_name || u.email}</span>
                                    <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded font-mono text-[9px] font-extrabold">
                                      ADMIN
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-purple-700 font-medium truncate">
                                    {u.department_name || 'System & IT Operations'}
                                  </p>
                                </div>
                              </div>
                              <div className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-bold group-hover:bg-purple-700 transition">
                                Chat
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* KHỐI 2: QUẢN LÝ / DỰ ÁN */}
                    {managerUsers.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {isCurrentManager ? 'Colleague Managers' : 'Your Managers & Project Leads'} ({managerUsers.length})
                          </span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {managerUsers.map((u) => (
                            <button
                              key={`mgr-${u.id}`}
                              onClick={() => handleStartDirectChat(u)}
                              className="w-full p-2.5 bg-indigo-50/50 hover:bg-indigo-100/70 border border-indigo-200/60 rounded-xl flex items-center justify-between transition-colors text-left group cursor-pointer"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <UserAvatar user={u} size="sm" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate group-hover:text-indigo-700">
                                    <span>{u.full_name || u.email}</span>
                                    <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded font-mono text-[9px] font-extrabold">
                                      MANAGER
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-indigo-600 font-medium truncate">
                                    {u.department_name || 'Project Management'}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* KHỐI 3: ĐỘI NGŨ / ĐỒNG NGHIỆP */}
                    {staffUsers.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {isCurrentManager ? 'Your Team Members & Project Staff' : 'Team & Project Colleagues'} ({staffUsers.length})
                          </span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {staffUsers.map((u) => (
                            <button
                              key={`staff-${u.id}`}
                              onClick={() => handleStartDirectChat(u)}
                              className="w-full p-2.5 hover:bg-blue-50 rounded-xl flex items-center justify-between transition-colors text-left group cursor-pointer"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <UserAvatar user={u} size="sm" />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate">
                                    {u.full_name || u.email}
                                  </p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {u.role_code || u.role || 'Staff'} • {u.department_name || 'General Staff'}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
