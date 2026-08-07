# 03 — Tích hợp Audit Log vào action nhạy cảm

Roadmap Tuần 4 (`project-roadmap/03-phase-tuan-tu-auth-employee.md`) yêu
cầu: *"Đảm bảo mọi action nhạy cảm của bạn ... đã gọi `log_audit_event()`"*.

## Trước tiên: xác định đúng phạm vi thật của "action nhạy cảm của bạn"

Roadmap liệt kê ví dụ chung "tạo user, khóa/mở tài khoản, đổi password, log
work, chốt timesheet" — nhưng "tạo user"/"khóa tài khoản" là việc của
Admin (Minh Anh), "chốt timesheet" giờ là của Đức Long (xem
`00-tong-quan.md` mục bối cảnh). Phạm vi thật sự còn lại của Tuấn Tú chỉ
còn: **đổi mật khẩu** (`ChangePasswordView`, `ResetPasswordView`) và
**log work** (create + void). Không tự ý thêm log cho action không thuộc
sở hữu của mình.

## Phát hiện: có 2 helper cùng ghi vào `AuditLog`, không phải 1

- `system.utils.log_audit_event(actor, action, table_name, record_id, ...)`
  — đơn giản, Minh Anh dùng ở `projects/views_admin.py`.
- `system.services.audit_manager_service.log_action(*, user, action, ...)`
  \+ `snapshot(instance, fields=)` — có chụp trước/sau, Đức Long dùng trong
  toàn bộ `timesheets/services/`.

Quyết định: **không gộp 2 hàm thành 1** (không phải việc của mình, việc này
ảnh hưởng code của cả Long lẫn Minh Anh) — chỉ theo đúng convention đã có ở
từng app: `log_audit_event` cho `accounts` (roadmap cũng gọi đích danh tên
này), `log_action` cho `timesheets` (nhất quán với phần Đức Long đã viết,
vì `EmployeeVoidLogWorkView` nằm cạnh code của Long trong cùng domain).

## Nguyên tắc quan trọng nhất: KHÔNG log giá trị mật khẩu

Dù đã hash, mật khẩu (cũ lẫn mới) không nên xuất hiện trong `old_values`/
`new_values` của `AuditLog` — đây là dữ liệu nhạy cảm không có lý do gì
phải lưu lại, kể cả dạng hash. `ChangePasswordView`/`ResetPasswordView` chỉ
log action + actor + `record_id`, không truyền `old_values`/`new_values`.

## Code — `backend/accounts/views_auth.py`

```python
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.apply_new_password()  # sửa: giờ trả về user

        log_audit_event(
            actor=user, action="RESET_PASSWORD",
            table_name="users", record_id=user.id, request=request,
        )
        return Response({"detail": "Password has been reset successfully"}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()

        log_audit_event(
            actor=request.user, action="CHANGE_PASSWORD",
            table_name="users", record_id=request.user.id, request=request,
        )
        return Response({"detail": "Password changed successfully"}, status=status.HTTP_200_OK)
```

Điểm cần sửa ở `ResetPasswordSerializer.apply_new_password()`
(`serializers_auth.py`): ban đầu không trả về gì cả — vì `ResetPasswordView`
không có `request.user` (endpoint không cần đăng nhập, xác thực qua token
email), nên serializer phải tự trả `user` ra để view biết log cho ai.

## Code — `backend/timesheets/serializers_employee.py` (log khi tạo)

```python
validated_data["user"] = user
log_work = super().create(validated_data)

log_action(
    user=user, action="CREATE_LOG_WORK",
    table_name="log_works", record_id=log_work.id,
    new_values=snapshot(log_work, fields=["task", "work_date", "hours_spent", "description", "review_status"]),
    request=self.context["request"],
)
return log_work
```

Đặt bên trong `with transaction.atomic():` đã có sẵn ở `create()` — nếu log
work tạo thất bại (vd. lỗi DB), audit log không được ghi theo, tránh audit
log "ma" cho hành động chưa từng thành công.

## Bug gặp khi tự gõ code: sai đường dẫn import

```python
from backend.system.services.audit_manager_service import log_action, snapshot   # SAI
```

```text
ModuleNotFoundError: No module named 'backend'
```

`backend/` là thư mục gốc chạy `manage.py`, không phải 1 package Python —
import luôn tính từ đó, không lặp lại tên `backend` ở đầu đường dẫn. So
sánh với import đúng đã có sẵn trong `views_employee.py` cùng module
(`from system.services.audit_manager_service import ...`) sẽ thấy ngay.

## Verify

```text
✅ manage.py check — sạch (sau khi sửa import)
✅ manage.py shell — gọi thật log_audit_event() và log_action() với user/log_work
   thật lấy từ DB, snapshot() serialize đúng (FK → *_id, Decimal → string,
   date → ISO string), tất cả trong transaction.atomic() rồi rollback —
   không để lại data rác.
```
