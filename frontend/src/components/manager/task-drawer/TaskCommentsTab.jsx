import React from 'react';
import { Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr, formatPattern = 'HH:mm • dd/MM') {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), formatPattern);
  } catch {
    return dateStr;
  }
}

export default function TaskCommentsTab({
  comments = [],
  commentInput,
  setCommentInput,
  onSendComment,
  isSending = false,
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
        {comments.length === 0 ? (
          <p className="text-center text-slate-400 py-8">
            No comments yet. Start the conversation below!
          </p>
        ) : (
          comments.map((cm) => {
            const isRejection = cm.comment_type === 'REJECTION_NOTE';
            return (
              <div
                key={cm.id}
                className={cn(
                  'p-3.5 rounded-xl border space-y-1.5 shadow-2xs',
                  isRejection
                    ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                    : 'bg-white border-slate-200 text-slate-800'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserAvatar user={cm.user} size="xs" />
                    <span className="font-bold text-xs">
                      {cm.user?.full_name || cm.user?.email || 'User'}
                    </span>
                    {isRejection && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-200 text-rose-800">
                        Rejection Note
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {formatDateSafe(cm.created_at)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed pl-8 whitespace-pre-wrap">{cm.content}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Form Gửi Comment */}
      <form onSubmit={onSendComment} className="pt-2 border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          placeholder="Write a comment or note..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!commentInput.trim() || isSending}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
