# 10 — Rà soát tiến độ so với yêu cầu đề bài (sau Giai đoạn 1-3)

Đối chiếu checklist gốc ở `08-roadmap-and-talking-points.md` (lấy từ
`WorkTracker_Authentication_Guide.md`) với code thật hiện tại trong
`backend/accounts/`.

## Checklist "Bắt buộc"

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| JWT Access/Refresh Token | ✅ Xong | Giai đoạn 1 |
| Refresh Rotation | ✅ Xong | `ROTATE_REFRESH_TOKENS=True`, Giai đoạn 1 |
| Redis Blacklist Logout | ✅ Xong | Giai đoạn 2 |
| Forgot Password | ❌ Chưa làm | **→ Giai đoạn 4 (file 11)** |
| Change Password First Login | ❌ Chưa làm | Cần thêm field `must_change_password` — chưa có trong `CustomUser` (đã kiểm tra lại bằng `grep`) |
| RBAC (Role + Permission) | ✅ Xong | Giai đoạn 3 |
| Protected Route React | ❌ Chưa làm | Thuộc phần Frontend, ngoài phạm vi backend hiện tại |
| Data Isolation | ✅ Xong | Giai đoạn 3 (`TeamEmployeeListView`) |
| Audit Log | ❌ Chưa làm | Chủ động defer sang giai đoạn sau theo roadmap gốc |
| Account Disable | 🟡 Một phần | Xem ghi chú riêng dưới đây |

## Checklist "Nâng cao" (đều optional theo tài liệu, chưa làm cái nào)

- [ ] Login Rate Limit
- [ ] Account Locking
- [ ] Session Management
- [ ] 2FA

Không cần lo các mục này — tài liệu xếp vào nhóm tùy thời gian, không phải
điều kiện hoàn thành.

## Ghi chú riêng — "Account Disable" mới chỉ xong 1 nửa

Đã có:
- `DisableUserView` (Admin khóa tài khoản — set `is_active=False`).
- Xác nhận bằng test thật ở Giai đoạn 3: tài khoản bị khóa **tự động** bị
  `JWTAuthentication` chặn (401) ở mọi API ngay lập tức, không cần code
  thêm logic blacklist riêng cho hành động khóa — đáp ứng đúng yêu cầu
  *"ép họ văng khỏi hệ thống lập tức"* trong tài liệu.

Còn thiếu (thuộc "Giai đoạn 5 — Account Lifecycle" theo roadmap gốc, **chưa
đụng tới**):
- API **tạo user mới** (Admin tạo tài khoản nhân viên, cấp password mặc
  định) — hiện chỉ tạo được qua `createsuperuser`/shell, chưa có API thật.
- API **mở lại** tài khoản đã khóa (chỉ có chiều khóa, chưa có chiều mở).
- Field `must_change_password` trên `CustomUser` — chưa thêm.

## Ghi chú riêng — CRUD nhân viên/phòng ban (theo phân công gốc)

Theo `Hướng dẫn Django.docx`, bạn còn trách nhiệm *"CRUD danh sách nhân
viên, phòng ban"* — hiện tại **chưa có API CRUD thật** cho `Department`
hay `EmployeeProfile` (chỉ dùng trong `TeamEmployeeListView` ở dạng đọc,
chưa có Create/Update/Delete). Đây không nằm trong 8 giai đoạn của roadmap
Auth (vốn tập trung Authentication/Authorization), nên **không tính là
thiếu sót của Giai đoạn 1-3** — nhưng cần nhớ để lên kế hoạch riêng sau khi
xong toàn bộ phần Auth.

## Việc cần làm tiếp, theo đúng thứ tự ưu tiên

1. **Giai đoạn 4 — Forgot Password** (file `11-giai-doan-4-roadmap.md`, đã viết sẵn).
2. **Giai đoạn 5 — Account Lifecycle**: thêm `must_change_password`, API tạo user mới, API mở lại tài khoản.
3. **CRUD Department/EmployeeProfile** — việc riêng, không thuộc 6 giai đoạn Auth.
4. **Audit Log** — sau khi xong các mục trên.
