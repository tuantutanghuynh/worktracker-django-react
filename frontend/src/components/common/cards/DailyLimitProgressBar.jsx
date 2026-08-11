import clsx from 'clsx';

export default function DailyLimitProgressBar({ hoursLogged = 0, dailyLimit = 8 }) {
  const percent = Math.min((hoursLogged / dailyLimit) * 100, 100);
  const isOver = hoursLogged > dailyLimit;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{hoursLogged}h logged</span>
        <span>{dailyLimit}h limit</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
        <div
          className={clsx(
            'h-2 rounded-full transition-all',
            isOver ? 'bg-red-500' : 'bg-emerald-500'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}