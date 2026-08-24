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
} from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { chatService } from '../../../services/common/chatService';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../utils/cn';
import UserAvatar from '../avatar/UserAvatar';

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

  // State quản lý danh sách phòng & phòng đang chọn
  const [jobChannels, setJobChannels] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);

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

  // ============================================================
  // 1. NẠP DANH SÁCH CÁC PHÒNG CHAT TỪ BACKEND
  // ============================================================
  const fetchRooms = useCallback(
    async (autoSelectJobId = null, autoSelectUserId = null, autoSelectRoomId = null) => {
      try {
        setLoadingRooms(true);
        const data = await chatService.getRooms();
        let channels = data.job_channels || [];
        let dms = data.direct_messages || [];

        // 1. Ưu tiên: autoSelectRoomId
        if (autoSelectRoomId) {
          const found = [...channels, ...dms].find(
            (r) => String(r.id) === String(autoSelectRoomId)
          );
          if (found) {
            setJobChannels(channels);
            setDirectMessages(dms);
            setActiveRoom(found);
            if (dms.some((d) => d.id === found.id)) setActiveTab('DIRECT');
            return;
          }
        }

        // 2. Ưu tiên: autoSelectUserId (Chat 1-1 với một nhân viên cụ thể)
        if (autoSelectUserId) {
          try {
            const dmRoom = await chatService.startDirect(autoSelectUserId);
            if (dmRoom?.id) {
              setJobChannels(channels);
              setDirectMessages(dms);
              setActiveRoom(dmRoom);
              setActiveTab('DIRECT');
              return;
            }
          } catch (e) {
            console.error('Could not auto-start direct room:', e);
          }
        }

        // 3. Ưu tiên: autoSelectJobId (Kênh chat dự án)
        if (autoSelectJobId) {
          const targetChannel = channels.find(
            (c) =>
              String(c.job) === String(autoSelectJobId) ||
              String(c.job_code) === String(autoSelectJobId)
          );
          if (targetChannel) {
            setJobChannels(channels);
            setDirectMessages(dms);
            setActiveRoom(targetChannel);
            setActiveTab('CHANNELS');
            return;
          }
        }

        setJobChannels(channels);
        setDirectMessages(dms);

        // Mặc định chọn phòng đầu tiên nếu chưa có phòng nào active
        setActiveRoom((prev) => {
          if (prev) {
            const updated = [...channels, ...dms].find((r) => r.id === prev.id);
            return updated || prev;
          }
          return channels[0] || dms[0] || null;
        });
      } catch (err) {
        console.error('Failed to load chat rooms:', err);
        toast.error('Failed to load chat rooms');
      } finally {
        setLoadingRooms(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchRooms(initialJobId, initialDirectUserId, initialRoomId);
  }, [fetchRooms, initialJobId, initialDirectUserId, initialRoomId]);

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws/chat/${activeRoom.id}/`;

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

            // Cập nhật lại tin nhắn cuối cùng trong danh sách sidebar
            setJobChannels((prevList) =>
              prevList.map((room) =>
                room.id === activeRoom.id
                  ? {
                      ...room,
                      last_message: {
                        id: newMsg.id,
                        content: newMsg.content || `[Attachment] ${newMsg.attachment_name}`,
                        sender_name: newMsg.sender?.full_name || 'User',
                        created_at: newMsg.created_at,
                      },
                    }
                  : room
              )
            );
            setDirectMessages((prevList) => {
              const updatedRoom = {
                ...activeRoom,
                last_message: {
                  id: newMsg.id,
                  content: newMsg.content || `[Attachment] ${newMsg.attachment_name}`,
                  sender_name: newMsg.sender?.full_name || 'User',
                  created_at: newMsg.created_at,
                },
              };
              const exists = prevList.some((room) => room.id === activeRoom.id);
              if (exists) {
                return prevList.map((room) =>
                  room.id === activeRoom.id ? updatedRoom : room
                );
              }
              if (activeRoom.room_type === 'DIRECT') {
                return [updatedRoom, ...prevList];
              }
              return prevList;
            });
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

      // Cập nhật last_message trên Sidebar DMs
      if (activeRoom.room_type === 'DIRECT') {
        setDirectMessages((prevList) => {
          const updatedRoom = {
            ...activeRoom,
            last_message: {
              id: res.id,
              content: res.content || `[Attachment] ${res.attachment_name}`,
              sender_name: 'You',
              created_at: res.created_at,
            },
          };
          const exists = prevList.some((room) => room.id === activeRoom.id);
          if (exists) {
            return prevList.map((room) =>
              room.id === activeRoom.id ? updatedRoom : room
            );
          }
          return [updatedRoom, ...prevList];
        });
      }

      setInputText('');
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Send message failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to send message');
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
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 shrink-0">
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
              DMs ({directMessages.length})
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
                            onClick={() => setActiveRoom(room)}
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
                            onClick={() => setActiveRoom(room)}
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
                                    'text-xs font-semibold truncate',
                                    isActive ? 'text-white' : 'text-slate-900'
                                  )}
                                >
                                  {displayName}
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
      <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden min-w-0">
        {activeRoom ? (
          <>
            {/* Header phòng chat đang chọn */}
            <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
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
        <div className="w-72 border-l border-slate-200 bg-white flex flex-col shrink-0 animate-fade-in">
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
              ) : (
                directoryUsers
                  .filter((u) => {
                    const query = directorySearch.toLowerCase();
                    return (
                      (u.full_name || '').toLowerCase().includes(query) ||
                      (u.email || '').toLowerCase().includes(query) ||
                      (u.department_name || '').toLowerCase().includes(query)
                    );
                  })
                  .map((u) => (
                    <button
                      key={`user-${u.id}`}
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
                            {u.role || 'Member'} • {u.department_name || 'General'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
