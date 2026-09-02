import React from 'react';
import {
  Headphones,
  ArrowLeft,
  Info,
  RefreshCw,
  FileText,
  Download,
  ShieldAlert,
  AlertTriangle,
  Paperclip,
  Send,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function SupportChatArea({
  activeRoom,
  messages = [],
  loadingMessages = false,
  inputMessage = '',
  setInputMessage,
  onSendMessage,
  onFileUpload,
  isSending = false,
  isUploading = false,
  fileInputRef,
  messagesEndRef,
  onBack,
  onOpenProfile,
}) {
  if (!activeRoom) {
    return (
      <div className="hidden md:flex flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex-col items-center justify-center p-8 text-slate-400 space-y-3 min-w-0">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-2xs">
          <Headphones className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Select an inquiry to view conversation</h3>
        <p className="text-xs text-slate-400 max-w-sm text-center">
          Pick a support request from the queue to start troubleshooting and resolving issues.
        </p>
      </div>
    );
  }

  const otherUser = activeRoom.other_participant || {};
  const isUserSuspended = otherUser.is_active === false;
  const isManager = otherUser.role_code === 'MANAGER' || otherUser.role === 'MANAGER' || otherUser.role === 2;

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden min-w-0 transition-all">
      {/* Active Conversation Header */}
      <div className="h-16 px-4 sm:px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center space-x-3 min-w-0">
          {/* Back button for mobile */}
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            title="Back to queue"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Clickable Avatar & User Info Header (Opens Profile on Mobile & Desktop) */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center space-x-3 min-w-0 text-left hover:opacity-85 transition cursor-pointer group"
            title="Click to view full user profile"
          >
            <div
              className={cn(
                'w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center text-white shrink-0 shadow-2xs group-hover:ring-2 group-hover:ring-purple-300 transition',
                isManager ? 'bg-blue-600' : 'bg-slate-700'
              )}
            >
              {(otherUser.full_name?.[0] || otherUser.email?.[0] || 'U').toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 truncate transition">
                  {otherUser.full_name || otherUser.email}
                </h3>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-extrabold border',
                    isManager
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  )}
                >
                  {isManager ? 'MANAGER' : 'STAFF'}
                </span>
                {isUserSuspended ? (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" /> Suspended
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {otherUser.department_name || 'General Operations'} • {otherUser.email}
              </p>
            </div>
          </button>
        </div>

        {/* Info Toggle Button (Visible on all devices) */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition cursor-pointer"
            title="View user profile"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40 custom-scrollbar">
        {loadingMessages ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
            <span>Loading conversation history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <p>No messages yet in this support ticket.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isFromAdmin = msg.sender?.role_code === 'ADMIN' || msg.sender?.role === 'ADMIN' || msg.is_mine;
            const senderName = msg.sender?.full_name || msg.sender?.email || 'User';

            return (
              <div
                key={`msg-${msg.id}`}
                className={cn('flex items-start gap-3 max-w-[85%]', isFromAdmin ? 'ml-auto justify-end' : '')}
              >
                {!isFromAdmin && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {(senderName[0] || 'U').toUpperCase()}
                  </div>
                )}

                <div className={cn('space-y-1', isFromAdmin ? 'text-right' : '')}>
                  <div className={cn('flex items-center gap-2 mb-0.5', isFromAdmin ? 'justify-end' : '')}>
                    <span className={cn('text-xs font-bold', isFromAdmin ? 'text-purple-700' : 'text-slate-900')}>
                      {isFromAdmin ? 'Admin System (You)' : senderName}
                    </span>
                    {isFromAdmin && (
                      <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded font-mono text-[9px] font-extrabold">
                        ADMIN
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  {/* Message Body */}
                  <div
                    className={cn(
                      'p-3 rounded-2xl text-xs shadow-2xs',
                      isFromAdmin
                        ? 'bg-purple-600 text-white rounded-tr-xs text-left'
                        : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>

                    {/* File Attachment Box */}
                    {msg.attachment_url && (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          'mt-2.5 p-2 rounded-xl flex items-center justify-between gap-3 text-xs transition border',
                          isFromAdmin
                            ? 'bg-purple-700/80 border-purple-500 text-white hover:bg-purple-800'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 shrink-0 text-purple-300" />
                          <span className="truncate font-semibold">{msg.attachment_name || 'Attachment'}</span>
                        </div>
                        <Download className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      </a>
                    )}
                  </div>
                </div>

                {isFromAdmin && (
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs ring-2 ring-purple-300">
                    AD
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-200 bg-white">
        {isUserSuspended ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              This user's account is currently suspended/deactivated. Re-activate the account to enable messaging.
            </span>
          </div>
        ) : (
          <form onSubmit={onSendMessage} className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.png,.jpg,.jpeg,.webp,.gif"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Attach file or screenshot (Max 20MB)"
              className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin text-purple-600" /> : <Paperclip className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type official response..."
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-purple-400 focus:outline-none transition shadow-2xs"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
