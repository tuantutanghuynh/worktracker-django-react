import React, { useState, useEffect } from 'react';
import { cn } from '../../../utils/cn';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Chuẩn hóa URL ảnh avatar từ Backend Django
 */
export function resolveAvatarUrl(url) {
  if (!url) return null;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const base = API_BASE.replace(/\/api\/?$/, '').replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${base}${cleanPath}`;
}

/**
 * Tính toán chữ cái viết tắt đại diện (Initials)
 */
export function getInitials(name, fallback = 'U') {
  if (!name || typeof name !== 'string') return fallback;
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
};

/**
 * UserAvatar - Component hiển thị ảnh đại diện chuẩn toàn hệ thống
 */
export default function UserAvatar({
  user,
  src,
  name,
  size = 'md',
  className,
  showStatus = false,
  isOnline = true,
  alt,
}) {
  const avatarRaw = src || user?.avatar_url || user?.avatar;
  const avatarUrl = resolveAvatarUrl(avatarRaw);
  const displayName = name || user?.full_name || user?.email || 'User';
  const initials = getInitials(displayName);

  const [hasError, setHasError] = useState(false);

  // Reset error khi URL thay đổi
  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center font-extrabold uppercase shadow-2xs border border-white/80',
          sizeClass,
          (!avatarUrl || hasError) &&
            'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white'
        )}
      >
        {avatarUrl && !hasError ? (
          <img
            key={avatarUrl}
            src={avatarUrl}
            alt={alt || displayName}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            size === 'xs' || size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5',
            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
          )}
        />
      )}
    </div>
  );
}
