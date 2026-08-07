# Executive Code Annotation: `backend/timesheets/models.py`

**Package / Module:** `backend.timesheets.models` · Timesheet Models Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Thực Thể Quan Hệ (Entity Relationship & Constraint Diagram)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   TimeLock                                       │
│ ──────────────────────────────────────────────────────────────────────────────── │
│  - id: BigAutoField (PK)                                                         │
│  - lock_month: PositiveSmallIntegerField [1..12]                                 │
│  - lock_year: PositiveSmallIntegerField                                          │
│  - lock_scope: CharField ["JOB" | "GLOBAL"]                                      │
│  - job_id: FK -> projects.Job (RESTRICT, Nullable)                               │
│  - is_locked: BooleanField (default=True)                                        │
│  - locked_by: FK -> accounts.CustomUser (RESTRICT)                               │
│  - unlocked_by: FK -> accounts.CustomUser (SET_NULL, Nullable)                   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Restricts Lock Period
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   LogWork                                        │
│ ──────────────────────────────────────────────────────────────────────────────── │
│  - id: BigAutoField (PK)                                                         │
│  - task_id: FK -> tasks.Task (RESTRICT)                                          │
│  - user_id: FK -> accounts.CustomUser (RESTRICT)                                 │
│  - work_date: DateField                                                          │
│  - hours_spent: DecimalField(4, 2)                                               │
│  - review_status: CharField ["PENDING" | "APPROVED" | "REJECTED" | "VOIDED"]     │
│  - reviewed_by / adjusted_by: FK -> accounts.CustomUser (SET_NULL)              │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Aggregates daily hours spent
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             DailyUserTimesheet                                   │
│ ──────────────────────────────────────────────────────────────────────────────── │
│  - user_id: FK -> accounts.CustomUser (RESTRICT)                                 │
│  - work_date: DateField                                                          │
│  - total_hours: DecimalField(4, 2) <= 24.00                                      │
│  * Constraint: Unique(user, work_date)                                           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

> **Vì sao `TimeLock` phân tách thành 2 phạm vi `GLOBAL` và `JOB`?**
> - **GLOBAL scope:** Dành riêng cho Super Admin khóa sổ kế toán toàn bộ công ty cho cả tháng/năm. Khi đã khóa GLOBAL, `job` phải là `NULL`.
> - **JOB scope:** Cho phép Project Manager khóa sổ riêng cho 1 dự án cụ thể. Điều này giúp Manager linh hoạt chốt công theo từng Job mà không ảnh hưởng tới các Job khác.
>
> **Vì sao `LogWork` không xóa vật lý (Hard-delete) mà dùng `review_status = VOIDED`?**
> Dữ liệu chấm công là cơ sở tính lương và kiểm toán tài chính. Việc xóa cứng dòng record khỏi DB sẽ làm mất dấu vết (Audit Trail). Chuyển trạng thái sang `VOIDED` vừa giữ nguyên lịch sử giao dịch vừa loại trừ record khỏi tổng giờ tính lương.
>
> **Vì sao lại cần bảng tổng hợp `DailyUserTimesheet` thay vì `SUM(hours_spent)` trực tiếp trên `LogWork`?**
> Mỗi ngày một nhân viên có thể log hàng chục lần cho nhiều task. Việc dùng `DailyUserTimesheet` đóng vai trò là "chốt chặn khóa hàng" (`SELECT ... FOR UPDATE`), ngăn chặn 2 request log work đồng thời (Race Condition) làm tổng số giờ vượt quá 24h/ngày.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Imports & Khai Báo Đầu File

```python
1: from django.conf import settings
# "from django.conf import settings" = Nạp object settings của Django để truy cập cấu hình hệ thống (như settings.AUTH_USER_MODEL).

2: from django.core.validators import MaxValueValidator, MinValueValidator
# "from django.core.validators import ..." = Nạp các bộ kiểm tra giá trị số nhỏ nhất (MinValue) và lớn nhất (MaxValue) ở tầng ORM.

3: from django.db import models
# "from django.db import models" = Nạp module ORM core của Django chứa các kiểu Field, Model class, Constraints, Q objects.
```

---

### 2. Model `TimeLock` — Khóa Kỳ Chấm Công

```python
18: class TimeLock(models.Model):
# Definitive model đại diện cho bảng "time_locks" dùng để khóa kỳ báo cáo timesheet theo tháng/năm.

19:     class LockScope(models.TextChoices):
# Khai báo Enum TextChoices cho phạm vi khóa.

20:         JOB = "JOB", "Job Scope"
# Quyền khóa từng Dự án cụ thể (dành cho Project Manager).

21:         GLOBAL = "GLOBAL", "Global Scope"
# Quyền khóa toàn hệ thống (dành riêng cho Admin).

23:     lock_month = models.PositiveSmallIntegerField(
24:         validators=[MinValueValidator(1), MaxValueValidator(12)],
25:     )
# Tháng khóa kỳ công. Validator đảm bảo giá trị nằm trong khoảng từ tháng 1 đến tháng 12.

26:     lock_year = models.PositiveSmallIntegerField()
# Năm khóa kỳ công (số nguyên dương nhỏ).

29:     lock_scope = models.CharField(
30:         max_length=10,
31:         choices=LockScope.choices,
32:         default=LockScope.JOB,
33:     )
# Chuỗi tối đa 10 ký tự lưu phạm vi lock ('JOB' hoặc 'GLOBAL'). Mặc định là JOB.

37:     job = models.ForeignKey(
38:         "projects.Job",
39:         on_delete=models.RESTRICT,
40:         null=True,
41:         blank=True,
42:         related_name="time_locks",
43:     )
# Liên kết N-1 tới bảng Job. RESTRICT chặn xóa Job nếu đang có TimeLock liên kết. Nullable vì lock_scope=GLOBAL sẽ không có Job.

45:     is_locked = models.BooleanField(default=True)
# Cờ trạng thái: True là đang khóa (chặn logwork), False là đã mở khóa.

48:     locked_by = models.ForeignKey(
49:         settings.AUTH_USER_MODEL,
50:         on_delete=models.RESTRICT,
51:         related_name="executed_locks",
52:     )
# Người thực hiện khóa kỳ công.

53:     locked_at = models.DateTimeField(auto_auto_add=True if hasattr(models, 'auto_now_add') else True) # auto_now_add=True
# Tự động ghi lại thời điểm thực hiện khóa.

54:     lock_reason = models.TextField(blank=True, null=True)
# Lý do khóa kỳ công (không bắt buộc).

57:     unlocked_by = models.ForeignKey(
58:         settings.AUTH_USER_MODEL,
59:         on_delete=models.SET_NULL,
60:         null=True,
61:         blank=True,
62:         related_name="executed_unlocks",
63:     )
# Người mở khóa kỳ công gần nhất. Dùng SET_NULL để giữ lịch sử nếu user bị xóa.

64:     unlocked_at = models.DateTimeField(blank=True, null=True)
# Thời điểm thực hiện mở khóa.

66:     unlock_reason = models.TextField(blank=True, null=True)
# Lý do mở khóa (bắt buộc ở tầng service khi unlock).

68:     updated_at = models.DateTimeField(auto_now=True)
# Tự động cập nhật thời gian mỗi khi record thay đổi.

70:     class Meta:
71:         db_table = "time_locks"
72:         constraints = [
74:             models.UniqueConstraint(
75:                 fields=["lock_month", "lock_year"],
76:                 condition=models.Q(lock_scope="GLOBAL", job__isnull=True),
77:                 name="unique_global_lock_per_month",
78:             ),
# Partial Unique Constraint 1: Mỗi tháng/năm chỉ có duy nhất 1 bản ghi lock GLOBAL.

80:             models.UniqueConstraint(
81:                 fields=["lock_month", "lock_year", "job"],
82:                 condition=models.Q(lock_scope="JOB", job__isnull=False),
83:                 name="unique_job_lock_per_month_year",
84:             ),
# Partial Unique Constraint 2: Mỗi tháng/năm/job chỉ có duy nhất 1 bản ghi lock JOB.

87:             models.CheckConstraint(
88:                 condition=(
89:                     models.Q(lock_scope="GLOBAL", job__isnull=True)
90:                     | models.Q(lock_scope="JOB", job__isnull=False)
91:                 ),
92:                 name="check_lock_scope_job_consistency",
93:             ),
# Check Constraint ở CSDL: Đảm bảo tính nhất quán — nếu GLOBAL thì job phải NULL; nếu JOB thì job không được NULL.
94:         ]

96:     def __str__(self):
97:         scope_label = f"{self.lock_scope}"
98:         if self.lock_scope == self.LockScope.JOB and self.job_id:
99:             scope_label += f" (job={self.job_id})"
100:        status = "LOCKED" if self.is_locked else "UNLOCKED"
101:        return f"{scope_label} {self.lock_month}/{self.lock_year} - {status}"
# Chuỗi hiển thị đại diện cho đối tượng TimeLock khi print hoặc trên Admin.
```

---

### 3. Model `LogWork` — Nhật Ký Giờ Làm Việc

```python
115: class LogWork(models.Model):
# Model lưu nhật ký khai báo giờ làm việc của nhân viên cho từng nhiệm vụ (Task).

116:     class ReviewStatus(models.TextChoices):
117:         PENDING = "PENDING", "Pending Review"
118:         APPROVED = "APPROVED", "Approved"
119:         REJECTED = "REJECTED", "Rejected"
120:         VOIDED = "VOIDED", "Voided"
# Enum 4 trạng thái duyệt logwork: Chờ duyệt, Đã duyệt, Từ chối, Hủy bỏ.

122:     id = models.BigAutoField(primary_key=True)
# Khóa chính kiểu BigInt tăng tự động (phù hợp với bảng logwork tăng nhanh dữ liệu theo thời gian).

124:     task = models.ForeignKey(
125:         "tasks.Task",
126:         on_delete=models.RESTRICT,
127:         related_name="work_logs",
128:     )
# Khóa ngoại liên kết tới Task. RESTRICT ngăn xóa Task nếu đã có giờ làm việc log vào.

129:     user = models.ForeignKey(
130:         settings.AUTH_USER_MODEL,
131:         on_delete=models.RESTRICT,
132:         related_name="work_logs",
133:     )
# Người thực hiện log giờ làm.

135:     work_date = models.DateField()
# Ngày làm việc thực tế được ghi nhận.

137:     hours_spent = models.DecimalField(max_digits=4, decimal_places=2)
# Số giờ làm việc (VD: 7.50). Sử dụng Decimal để tránh sai số số thực float khi tính toán tài chính/công xá.

138:     description = models.TextField(blank=True, null=True)
# Mô tả chi tiết nội dung công việc đã làm.

140:     created_at = models.DateTimeField(auto_now_add=True)
141:     updated_at = models.DateTimeField(auto_now=True)

144:     review_status = models.CharField(
145:         max_length=20,
146:         choices=ReviewStatus.choices,
147:         default=ReviewStatus.PENDING,
148:         db_index=True,
149:     )
# Trạng thái duyệt. Tạo Index DB để tăng tốc truy vấn lọc danh sách logwork theo trạng thái duyệt.

150:     reviewed_by = models.ForeignKey(
151:         settings.AUTH_USER_MODEL,
152:         on_delete=models.SET_NULL,
153:         null=True,
154:         blank=True,
155:         related_name="reviewed_logworks",
156:     )
# Manager thực hiện Approve/Reject.

157:     reviewed_at = models.DateTimeField(blank=True, null=True)
158:     review_note = models.TextField(blank=True, null=True)

161:     adjusted_by = models.ForeignKey(
162:         settings.AUTH_USER_MODEL,
163:         on_delete=models.SET_NULL,
164:         null=True,
165:         blank=True,
166:         related_name="adjusted_logworks",
167:     )
# Người điều chỉnh (Correct) hoặc Hủy (Void) logwork.

168:     adjusted_at = models.DateTimeField(blank=True, null=True)
169:     adjustment_reason = models.TextField(blank=True, null=True)
# Lý do điều chỉnh (bắt buộc nhập ở tầng service để phục vụ kiểm toán).

172:     class Meta:
173:         db_table = "log_works"
174:         constraints = [
176:             models.CheckConstraint(
177:                 condition=models.Q(
178:                     review_status__in=["PENDING", "APPROVED", "REJECTED", "VOIDED"]
179:                 ),
180:                 name="check_logwork_review_status_valid",
181:             ),
182:         ]
# Ràng buộc Check ở mức CSDL bảo đảm review_status chỉ nhận 1 trong 4 giá trị hợp lệ.

184:     def __str__(self):
185:         return f"{self.user_id} - {self.work_date}: {self.hours_spent}h [{self.review_status}]"
```

---

### 4. Model `DailyUserTimesheet` — Bảng Tổng Hợp Giờ Làm Theo Ngày

```python
197: class DailyUserTimesheet(models.Model):
# Model tổng hợp tổng số giờ làm việc trong ngày của mỗi nhân viên.

200:     user = models.ForeignKey(
201:         settings.AUTH_USER_MODEL,
202:         on_delete=models.RESTRICT,
203:         related_name="daily_timesheets",
204:     )
# Nhân viên sở hữu bản ghi tổng hợp ngày. RESTRICT bảo toàn dữ liệu lịch sử.

205:     work_date = models.DateField()
# Ngày tổng hợp công.

206:     total_hours = models.DecimalField(
207:         max_digits=4,
208:         decimal_places=2,
209:         default=0.00,
210:     )
# Tổng số giờ làm tích lũy trong ngày.

212:     class Meta:
213:         db_table = "daily_user_timesheets"
214:         constraints = [
216:             models.UniqueConstraint(
217:                 fields=["user", "work_date"],
218:                 name="unique_daily_user_timesheet",
219:             ),
# Unique Constraint: Mỗi nhân viên chỉ có đúng 1 dòng tổng hợp cho từng ngày.

220:             models.CheckConstraint(
221:                 condition=models.Q(total_hours__lte=24),
222:                 name="check_total_hours_max_24",
223:             ),
# Check Constraint ở CSDL: Đảm bảo tổng số giờ trong 1 ngày không được vượt quá 24.00 giờ (Quy tắc 24h cap).
224:         ]

226:     def __str__(self):
227:         return f"{self.user_id} on {self.work_date}: {self.total_hours}h"
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Model Name | Table Name | Business Responsibility | Key Constraints & Defensive Rules |
|------------|------------|-------------------------|-----------------------------------|
| `TimeLock` | `time_locks` | Quản lý việc khóa kỳ công tháng/năm theo Job hoặc Toàn hệ thống (Global) | Partial Unique & Scope Check Constraints (JOB <-> Job != Null, GLOBAL <-> Job == Null) |
| `LogWork` | `log_works` | Lưu chi tiết từng lượt ghi nhận giờ làm việc cho Task | Soft-delete bằng status `VOIDED`, phân tách rõ 2 bộ field Review vs Adjustment |
| `DailyUserTimesheet` | `daily_user_timesheets` | Bộ đệm tổng hợp giờ làm/ngày, khóa dòng chống ghi trùng/vượt trần | Unique `(user, work_date)` và Check Constraint `total_hours <= 24.00` |
