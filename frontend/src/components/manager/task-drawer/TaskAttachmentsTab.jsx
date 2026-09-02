import React from 'react';
import { Upload, Paperclip, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function formatDateSafe(dateStr) {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function TaskAttachmentsTab({
  attachments = [],
  fileInputRef,
  onFileUpload,
}) {
  return (
    <div className="space-y-4">
      {/* Upload Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="p-6 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl text-center space-y-1.5 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition"
      >
        <Upload className="w-6 h-6 text-blue-500 mx-auto" />
        <p className="font-bold text-slate-800 text-xs">Click to upload attachment</p>
        <p className="text-[10px] text-slate-400">Supports PDF, PNG, JPG, ZIP (Max 20MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          onChange={onFileUpload}
          className="hidden"
        />
      </div>

      {/* Attachments List */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {attachments.length === 0 ? (
          <p className="text-center text-slate-400 py-6">No attachments uploaded yet.</p>
        ) : (
          attachments.map((att) => (
            <div
              key={att.id}
              className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate max-w-[240px]">
                    {att.file_name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatBytes(att.file_size)} • {formatDateSafe(att.uploaded_at)}
                  </p>
                </div>
              </div>

              <a
                href={att.file_url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
