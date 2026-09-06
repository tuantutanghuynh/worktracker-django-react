/**
 * Đầu trang dùng chung cho mọi màn hình Admin.
 *
 * Trước đây mỗi trang tự viết một cụm `<h1>` + hàng nút riêng, nên trang thì có
 * dòng mô tả, trang thì không, khoảng cách cũng lệch nhau. Gom về một chỗ để
 * năm trang trông như cùng một sản phẩm, và sau này đổi kiểu thì sửa một lần.
 *
 * Props:
 * - icon: component icon của lucide-react, hiện trong ô vuông màu bên trái.
 * - title / subtitle: tiêu đề và một dòng mô tả ngắn.
 * - count / countLabel: con số ở góc phải tiêu đề (vd: 12 clients).
 * - actions: các nút bên phải (Export, New ...).
 */
export default function AdminPageHeader({
  icon: Icon,
  title,
  subtitle,
  count,
  countLabel,
  actions,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h1>
            {count != null && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {count} {countLabel}
                {count === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
