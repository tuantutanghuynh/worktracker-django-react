import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatContainer from '../../components/common/chat/ChatContainer';

export default function ManagerChatPage() {
  const [searchParams] = useSearchParams();
  const initialJobId = searchParams.get('job') || searchParams.get('jobId') || null;

  return (
    <div className="space-y-4">
      {/* Khung Chat Dùng Chung */}
      <ChatContainer initialJobId={initialJobId} customTitle="Manager & Team Messaging" />
    </div>
  );
}
