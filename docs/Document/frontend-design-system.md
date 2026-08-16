# WorkTracker Frontend — Design System 

**Nguồn:** 7 file mockup HTML  — đọc trực tiếp class Tailwind trong `<style>`/`class=""`, không đoán từ ảnh.

**Cảnh báo lệch stack quan trọng — đọc trước khi code:**
Mockup dùng **Tailwind CDN + FontAwesome 6 CDN** (prototype tĩnh, không ràng buộc gì). Dự án thật dùng **Tailwind v4 (`@tailwindcss/vite`, không có `tailwind.config.js` riêng, khai báo theme qua `@theme` trong CSS)** và **`lucide-react`** cho icon (không có FontAwesome trong `package.json`). → Khi code, giữ nguyên palette/spacing/bố cục, nhưng **đổi mọi icon `fa-solid fa-xxx` sang icon `lucide-react` tương đương** (bảng map ở cuối file).

---

## 1. Bảng màu (Palette)

| Vai trò | Token Tailwind | Hex | Dùng ở đâu |
|---|---|---|---|
| Sidebar nền | tuỳ chỉnh `bg-[#0A1128]` | `#0A1128` | Sidebar cố định, luôn tối dù theme sáng |
| Nền content | `bg-slate-50` | `#f8fafc` | `<main>` bao toàn bộ trang, phía sau sidebar |
| Card nền | `bg-white` | `#ffffff` | Mọi card/table/form |
| Primary (action chính) | `blue-600` / hover `blue-700` | `#2563eb` / `#1d4ed8` | Nút chính, nav active, link, focus ring input |
| Success / Approved / Active | `emerald-500/100/50/600` | | Badge trạng thái tốt, dot online |
| Danger / Rejected / Voided | `rose-500/100/50/600` | | Badge lỗi/từ chối, nút xoá/void, notification dot |
| Warning / Pending | `amber-500/100/50/600` | | Badge chờ duyệt |
| Secondary / Reviewing | `purple-500/100/50/600` | | Badge trạng thái trung gian |
| Alert / Overdue | `orange-500` | | Cảnh báo trễ hạn |
| Neutral / Todo | `slate-100/600` | | Badge trung tính |
| Text heading | `text-slate-900` | `#0f172a` | `h1`, `h2` |
| Text body | `text-slate-700` / `slate-600` | | Nội dung chính |
| Text muted | `text-slate-500` / `slate-400` | | Label phụ, placeholder, timestamp |
| Border | `border-slate-200` (thường thêm `/80`) | | Viền card, input, divider |
| Border nhạt | `border-slate-100` | | Divider trong card |

**Quy tắc semantic màu** (dùng nhất quán cho mọi badge trạng thái toàn app, không tự bịa màu khác):
```
PENDING    → amber   |  APPROVED / COMPLETED / Active → emerald
REJECTED / VOIDED → rose   |  IN_PROGRESS → blue   |  REVIEWING → purple
TODO / mặc định → slate
```

## 2. Typography

- **Font chữ:** `Inter` (Google Fonts, weight 300–800) — cần thêm vào `index.html` hoặc `@import` trong `index.css`, KHÔNG dùng font `--sans: system-ui` đang có sẵn trong `index.css` hiện tại (đó là theme landing page cũ của Vite, sẽ thay khi vào layout Employee thật).
- **Icon:** FontAwesome 6 trong mockup → đổi sang `lucide-react` khi code (xem bảng map).
- **Cỡ chữ** (UI rất compact, đa số `text-xs`):

| Vị trí | Class |
|---|---|
| Tiêu đề trang (`<h1>`) | `text-2xl font-extrabold text-slate-900 tracking-tight` |
| Mô tả dưới tiêu đề | `text-slate-500 text-xs` |
| Tiêu đề card | `text-sm font-bold text-slate-900` (suy từ pattern chung) |
| Label form | `text-xs font-semibold text-slate-700 mb-1` |
| Nội dung bảng/card | `text-xs` |
| Badge/tag | `text-[10px] font-bold` |
| Breadcrumb | `text-xs text-slate-500 font-medium` |

## 3. Nút (Buttons) — 4 biến thể cố định

```html
<!-- Primary -->
class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md shadow-blue-600/30 transition"

<!-- Secondary / neutral -->
class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition"

<!-- Outline nguy hiểm (Void/Delete/Reject) -->
class="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold px-3 py-2 rounded-lg text-xs transition"

<!-- Outline link-style (View/Export) -->
class="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition"

<!-- Pill filter toggle (active/inactive) -->
active:   class="px-3 py-1 rounded-full font-semibold bg-blue-600 text-white shadow-sm"
inactive: class="px-3 py-1 rounded-full font-medium text-slate-600 hover:bg-slate-200/60"
```

## 4. Card

```html
<!-- Card chuẩn -->
class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4"   <!-- hoặc p-5 / p-6 tuỳ nội dung -->

<!-- Hero/banner card (đầu Dashboard) -->
class="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-md"
```

## 5. Badge / Tag trạng thái

```html
class="px-2 py-0.5 font-bold text-[10px] rounded-full bg-{color}-50 text-{color}-600 border border-{color}-200"
```
Thay `{color}` theo bảng semantic ở Mục 1. Dùng đúng 1 component `<StatusBadge status="PENDING" />` cho toàn app — không viết class tay lặp lại ở từng trang.

## 6. Form / Input

```html
<!-- Input thường -->
class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium"

<!-- Input disabled (field không cho sửa, vd email) -->
class="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed"

<!-- Label -->
class="block text-xs font-semibold text-slate-700 mb-1"
```

## 7. Bảng dữ liệu (Table) — quan trọng, đúng scope thư mục `table/` của bạn

```html
<table class="w-full text-left border-collapse">
  <thead>
    <tr class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
      <th class="py-3 px-4">...</th>
    </tr>
  </thead>
  <tbody>
    <tr class="hover:bg-slate-50/60 transition">
      <td class="py-3 px-4 font-bold text-slate-900">...</td>
    </tr>
  </tbody>
</table>
```
Bọc ngoài bằng card chuẩn: `bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden`.

## 8. Layout Shell — quan trọng, đúng scope thư mục `layout/` của bạn

```
<div class="flex h-screen overflow-hidden">
  <aside class="w-64 bg-[#0A1128] ... flex flex-col justify-between p-4 h-screen shrink-0">
    <!-- Sidebar: Header component -->
  </aside>
  <main class="flex-1 bg-slate-50 text-slate-800 p-6 h-screen overflow-y-auto space-y-6">
    <!-- Nội dung từng trang Employee -->
  </main>
</div>
```
Sidebar chia 3 khối: Nav chính (Dashboard/My Tasks/Timesheet/My Performance/Notifications/Profile) → Quick Access → Recently Viewed. Route active dùng `bg-blue-600 shadow-md shadow-blue-600/30`, route thường dùng `text-slate-400 hover:text-white hover:bg-slate-800/60`.

## 9. Bảng map icon FontAwesome → lucide-react

| FontAwesome (mockup) | lucide-react (code thật) |
|---|---|
| `fa-border-all` | `LayoutGrid` |
| `fa-list-check` | `ListChecks` |
| `fa-clock` | `Clock` |
| `fa-chart-line` | `TrendingUp` |
| `fa-bell` | `Bell` |
| `fa-user` | `User` |
| `fa-magnifying-glass` | `Search` |
| `fa-bars` | `Menu` |
| `fa-chevron-right` / `fa-chevron-down` | `ChevronRight` / `ChevronDown` |
| `fa-building` | `Building2` |
| `fa-envelope` | `Mail` |
| `fa-shield-halved` | `ShieldCheck` |
| `fa-cloud-arrow-up` | `CloudUpload` |

## 10. Việc cần làm để đưa palette vào code (Tailwind v4)

Tailwind v4 không dùng `tailwind.config.js` để khai màu tuỳ chỉnh — khai trong `@theme` ngay trong `index.css`:
```css
@theme {
  --color-sidebar: #0A1128;
}
```
Sau đó dùng như class có sẵn: `bg-sidebar` thay vì `bg-[#0A1128]` lặp lại khắp nơi.
