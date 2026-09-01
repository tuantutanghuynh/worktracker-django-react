import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

// "53h" -> "53h · 22%" khi data row có field pct (useMyPerformance.js đã
// tính sẵn) — đọc từ payload (bản ghi gốc của đúng hàng đó do Recharts
// truyền vào LabelList content), không match theo value (dễ sai nếu 2
// project trùng số giờ).
function ValueWithPctLabel({ x, y, width, height, value, payload }) {
  const text = payload?.pct != null ? `${value}h · ${payload.pct}%` : `${value}h`
  return (
    <text x={x + width + 6} y={y + height / 2} dy={4} fontSize={11} fill="#475569" fontWeight={600}>
      {text}
    </text>
  )
}

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
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 56 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={140} tick={<TruncatedYAxisTick />} />
          <Tooltip formatter={(value, _name, item) => [
            item?.payload?.pct != null ? `${value}h (${item.payload.pct}%)` : `${value}h`,
            'Logged',
          ]} />
          <Bar dataKey={dataKey} fill={barColor} radius={[0, 4, 4, 0]} barSize={28}>
            <LabelList dataKey={dataKey} content={ValueWithPctLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
