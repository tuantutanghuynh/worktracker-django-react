import React, { useRef } from 'react';
import { CloudUpload } from 'lucide-react';
import { cn } from '../../../utils/cn';

// Avatar preview + upload trigger. Pure component.
export function AvatarUploadCard({
  avatarUrl,
  email,
  name,
  onUpload,
  uploading = false,
  className = '',
}) {
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  }

  const fallbackLetter = (email || name || '?')[0]?.toUpperCase() ?? '?';

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col items-center text-center space-y-3', className)}>
      <div className="relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-28 h-28 rounded-full object-cover border-4 border-slate-100 shadow-md"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-blue-600 text-white flex items-center justify-center text-3xl font-bold border-4 border-slate-100 shadow-md">
            {fallbackLetter}
          </div>
        )}
        <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white absolute bottom-1 right-1 shadow-xs" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-xs shadow-blue-600/30 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <CloudUpload className="w-4 h-4" />
        <span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
      </button>
    </div>
  );
}