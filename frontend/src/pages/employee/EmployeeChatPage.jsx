import { useSearchParams } from 'react-router-dom'
import ChatContainer from '../../components/common/chat/ChatContainer'

// Employee Team Chat — reuses the same ChatContainer Manager's chat page
// uses. Backend (chat/) is role-agnostic (plain IsAuthenticated) and
// sync_user_job_channels() already auto-joins an Employee into the Job
// channels for every task assigned to them — no backend changes needed.
export function EmployeeChatPage() {
    const [searchParams] = useSearchParams()
    const initialJobId = searchParams.get('job') || searchParams.get('jobId') || null
    const initialDirectUserId = searchParams.get('userId') || searchParams.get('user') || null
    const initialRoomId = searchParams.get('room') || searchParams.get('roomId') || null

    return (
        <div className="space-y-4">
            <ChatContainer
                initialJobId={initialJobId}
                initialDirectUserId={initialDirectUserId}
                initialRoomId={initialRoomId}
                customTitle="Team Messaging"
            />
        </div>
    )
}
