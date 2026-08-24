import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Cắt ngắn label thay vì để Recharts tự bẻ dòng — bẻ dòng là nguyên nhân
// chữ đè lên nhau giữa các hàng bar khi tên project dài (bug thấy ở bản
// dùng chung components/common/charts/HorizontalBarChartCard.jsx). Tên đầy
// đủ vẫn xem được qua <title> khi hover.
function TruncatedYAxisTick({ x, y, payload }) {
  const label = String(payload.value)
  const truncated = label.length > 20 ? `${label.slice(0, 20)}…` : label
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="#475569">
      <title>{label}</title>
      {truncated}
    </text>
  )
}

// Bản Employee riêng của HorizontalBarChartCard — tách khỏi component
// dùng chung (components/common/charts/) vì bản đó có bug UI (label dài
// tự bẻ dòng, đè lên nhau) không thuộc phạm vi Employee tự sửa được ngay
// (dùng chung với Manager, cần báo team trước). Component này chỉ dùng
// trong trang Employee, được phép sửa tự do.
export default function EmployeeHorizontalBarChartCard({
  title,
  data,
  dataKey = 'value',
  barColor = '#6366f1',
}) {
  const chartHeight = Math.max(240, (data?.length ?? 0) * 56)

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium text-slate-900">{title}</p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={140} tick={<TruncatedYAxisTick />} />
          <Tooltip />
          <Bar dataKey={dataKey} fill={barColor} radius={[0, 4, 4, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
