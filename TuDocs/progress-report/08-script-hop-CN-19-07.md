# 08 — Script nói chuyện với team, họp CN 19/07/2026

Dùng cho buổi merge + báo cáo tiến độ Tuần 3. Đọc theo thứ tự này — phần
"Rủi ro nghiêm trọng" cố ý đặt SAU phần báo cáo việc đã xong, để không mở
đầu buổi họp bằng không khí căng thẳng.

---

## Phần 1 — Báo cáo việc đã xong (mở đầu, giữ không khí thoải mái)

> "Tuần này mình tập trung xong phần khó nhất của `timesheets` — Log Work
> với chống Race Condition, với Time Lock API. Cả 2 cái đều đã test kỹ,
> kể cả test race condition thật bằng 2 request chạy song song, không phải
> giả lập.
>
> Cụ thể có 2 API mới: `POST /api/timesheets/log-works/` cho Employee log
> giờ, và `POST /api/timesheets/time-locks/` cho Manager chốt sổ kỳ báo
> cáo. Cả 2 đều đã gắn RBAC, đều test qua các case: hợp lệ, vượt giới hạn,
> sai quyền.
>
> Còn thiếu so với kế hoạch: Frontend Employee (mình chưa code trang nào cả
> ngoài phần Auth), Celery chưa cài, Profile API chưa làm, KPI cá nhân chưa
> đụng tới. Tuần tới mình dồn qua Frontend trước vì đang là chỗ trễ nhất."

---

## Phần 2 — Việc cần confirm nhanh với Đức Long

> "Đức Long ơi, mình vừa thêm `ManagerTimeLockView` vào
> `timesheets/views_manager.py` (source: L17) — đúng file cậu sẽ dùng cho phần Review log
> work. Mình có để comment đánh dấu rõ ranh giới rồi, nhưng cậu nhớ `git
> pull` nhánh mới nhất trước khi bắt đầu viết để đỡ conflict lúc merge nhé.
>
> Với lại, mình thấy nhánh `DucLong` trên GitHub đang trống, chắc cậu vẫn
> đang làm ở `LongNguyen`? Mình cứ hỏi lại cho chắc, vì lúc nãy mình định
> so sánh code để lường trước conflict mà nhánh `DucLong` không có gì cả.
>
> Một câu hỏi nữa — theo bản v2, phần review/approve/reject/void log work
> hình như giờ là của cậu (FR-124)? Roadmap timesheet gốc của mình có ghi 1
> giai đoạn 'Timesheet Review filter phía Manager' — mình muốn confirm lại
> xem có phải đã chuyển qua cậu rồi để mình khỏi code trùng."

---

## Phần 3 — Phát hiện mới (19/07): xung đột nặng với nhánh `LongNguyen`, đụng cả lõi Auth

Phát hiện sau khi đã tự kiểm tra bằng `git merge-tree` (mô phỏng merge thật,
không phải đoán) — 8 file đụng nhau giữa nhánh mình và `LongNguyen`, trong đó
4 file rất nhạy vì nằm ngay trong phần Authentication mình phụ trách chính.
Giữ tinh thần rõ ràng nhưng không nhượng bộ ở phần lõi Auth — vì đây là phần
đã test kỹ qua nhiều tuần và Frontend/các API khác đang phụ thuộc vào đúng
thiết kế này.

> "Đức Long ơi, có thêm 1 việc quan trọng mình mới phát hiện tối qua khi thử
> mô phỏng merge thật giữa nhánh mình với `LongNguyen` (dùng git, không phải
> đoán) — có 8 file đụng nhau, trong đó 4 file khá nhạy: `accounts/
> authentication.py`, `accounts/models.py`, `worktracker_core/settings.py`,
> và `worktracker_core/urls.py`.
>
> Cụ thể: bên cậu có viết `CachedIsActiveJWTAuthentication` riêng, làm được
> phần is_active cache giống mình, nhưng **chưa có phần chặn token sau khi
> logout** (blacklist) — nếu merge thẳng bản của cậu, tính năng logout coi
> như mất tác dụng. Bên `urls.py`, cậu đang route login thẳng qua
> `TokenObtainPairView` gốc của SimpleJWT, không qua `LoginView` của mình —
> nghĩa là mất luôn custom JWT claims, message chống dò email, và cả
> `user`/`permissions` trả về lúc login mà Frontend đang phụ thuộc vào.
>
> Vì Authentication là phần tụi mình đã thống nhất từ đầu mình phụ trách
> chính, với lại đã test khá kỹ nhiều tuần (JWT, Redis blacklist, is_active
> cache, RBAC) — mình đề xuất: mọi thứ đụng trực tiếp tới Authentication
> (`accounts/authentication.py`, `accounts/models.py` phần Role/Permission/
> User, khối `SIMPLE_JWT`/Redis trong `settings.py`, và các route
> `/api/auth/...` trong `urls.py`) giữ nguyên bản của mình làm nền — cậu
> không cần viết lại phần này, chỉ cần gọi đúng vào class/hàm mình đã có.
>
> Ngược lại, `ManagerLogWorkViewSet` cậu viết cho review/approve/reject/void
> log work — đây là logic nghiệp vụ Manager, không phải Auth, nên mình không
> giữ phần này. Bên mình chỉ có `ManagerTimeLockView` đơn giản hơn nhiều (chỉ
> time-lock). Nếu bản của cậu đã làm đủ review/approve/reject/void rồi, mình
> đề xuất dùng bản của cậu làm nền cho phần review, mình merge phần
> time-lock của mình vào chung.
>
> Cậu thấy hướng chia thế này ổn không?"

**Nếu Đức Long phản đối phần Auth**: lắng nghe lý do, nhưng không nhượng bộ
merge thẳng `authentication.py`/`models.py`/`settings.py`/`urls.py` của cậu
ấy mà chưa xem kỹ — vì mất blacklist logout và mất custom login response là
ảnh hưởng tới bảo mật + Frontend đang chạy, không phải chuyện nhỏ. Nếu cậu
ấy có lý do chính đáng (ví dụ cần thêm field/behavior gì đó), ghi lại và xử
lý như đã làm với Minh Anh: viết migration/patch bổ sung, không viết lại
toàn bộ file.

---

## Phần 4 — Phần khó nói nhất: xung đột thiết kế `accounts` với Minh Anh

Đây là phần nhạy cảm — nên mở đầu bằng việc mình **đã tự kiểm tra kỹ trước
khi nói**, không phải đoán, và giữ tinh thần "cùng gỡ vấn đề", không phải
"bắt lỗi".

> "Minh Anh ơi, có 1 việc mình cần trao đổi trước khi mình merge code lên,
> không thì tuần sau dễ rối. Hôm qua mình có thử so sánh nhánh của mình với
> nhánh MinhAnh để xem có đụng file nhau không, thì phát hiện tụi mình đang
> có 2 bản `accounts/models.py` khác nhau khá nhiều.
>
> Mình có coi lại đúng file roadmap của bạn (`01-phase-minh-anh-admin.md`)
> để chắc là mình nhớ đúng — trong đó ghi rõ phần bạn phụ trách là API/UI
> gán quyền cho user (trang Quản lý Nhân sự & Phân quyền), viết vào
> `views_admin.py`/`urls_admin.py`, còn `models.py`/`permissions.py` là
> phần lõi mình giữ, cần thống nhất trước khi ai sửa.
>
> Nhưng nhìn code thật thì bạn đang sửa thẳng vào `models.py` — thêm
> `CustomUserManager`, đổi vài field ở `Role`/`Permission` — và code cũng
> đang nằm ở `views.py`/`urls.py` mặc định, chưa qua `views_admin.py`. Mình
> đoán có thể lúc bạn code chưa để ý tới quy ước 3 file này, hoặc 2 đứa
> hiểu khác nhau chỗ nào đó — mình muốn hỏi lại cho rõ trước khi quyết định
> gì.
>
> Về hướng giải quyết, mình đề xuất thế này: giữ nguyên `models.py` hiện
> tại của mình làm nền (vì nó đã chạy thật, có data test qua nhiều tuần,
> RBAC/JWT/Log Work/Time Lock đều đang dựa vào đúng cấu trúc này) — bạn xem
> lại bản của bạn có field/ý tưởng nào cần thêm không, ví dụ mình thấy bạn
> có thêm `is_active` cho Role với `group` cho Permission, nghe khá hợp lý
> — báo mình, mình viết 1 migration mới thêm vào, không cần bạn viết lại
> `models.py`.
>
> Phần API tạo user/gán role bạn đã viết thì giữ lại được, chỉ cần chuyển
> đúng qua `views_admin.py` thôi, không mất công viết lại từ đầu.
>
> Bạn thấy hướng này ổn không, hay có lý do gì mình chưa biết mà bạn cần
> đổi cấu trúc `models.py`?"

**Nếu Minh Anh phản đối hoặc có lý do riêng**: lắng nghe trước, đừng chốt
ngay tại chỗ — ghi lại lý do, hẹn thống nhất cụ thể trong hôm nay/mai để
không trễ lịch merge, nhưng không nhượng bộ việc merge thẳng `models.py`
của cô ấy mà chưa xem kỹ — vì phần này ảnh hưởng tới toàn bộ RBAC/JWT đã
test.

---

## Phần 5 — 3 việc kỹ thuật cần cả nhóm biết (không cần tranh luận, chỉ cần thống nhất)

> "Ngoài 2 chuyện `models.py` với Đức Long/Minh Anh, có 3 điểm kỹ thuật nhỏ
> hơn cần lưu ý khi merge:
>
> 1. Migration `accounts` đang trùng số ở cả 2 phía (Minh Anh) — cả 2 đứa
>    đều có `0002`/`0003`/`0004` nhưng nội dung khác nhau hoàn toàn. Git
>    không báo lỗi vì tên file khác nhau, nhưng Django sẽ vỡ khi migrate.
>    Cần thống nhất xong `models.py` trước (Phần 4), rồi mình viết lại đúng
>    thứ tự migration sau.
>
> 2. Notification hiện có tới 3 chỗ khác nhau: mình có 1 bản tạm trong
>    `timesheets/models.py`, Minh Anh có 1 bản trong app `system`, và có 1
>    app `notifications` mình mới scaffold còn đang trống. Cần chọn đúng 1
>    chỗ duy nhất trước khi cả 3 người code tiếp phần notify.
>
> 3. Riêng với Đức Long — ngoài phần Auth (Phần 3), `settings.py` và
>    `urls.py` của 2 đứa còn khác nhau ở cả cấu hình app list và cách route
>    (`api/auth/` vs `api/manager/`, app `projects`/`tasks`/`reports` bên
>    cậu không tồn tại bên mình). Sau khi chốt xong phần Auth, 2 đứa cần
>    ngồi lại merge tay 2 file này, không tự động được."

---

## Phần 6 — Chốt lại cuối buổi họp

> "Tóm lại các việc cần follow-up sau họp:
> 1. Mình với Đức Long thống nhất phần lõi Auth
>    (`authentication.py`/`models.py`/`settings.py`/`urls.py`) giữ theo bản
>    của mình, cậu ấy trỏ code vào — mục tiêu xong trong hôm nay/mai.
> 2. Mình với Minh Anh thống nhất `accounts/models.py` — mục tiêu xong
>    trong hôm nay/mai để không trễ merge tuần này.
> 3. Đức Long xác nhận `ManagerLogWorkViewSet` cậu viết có phải đã làm luôn
>    Giai đoạn 5 Timesheet Review (FR-124) không, để 2 đứa chọn 1 bản dùng
>    chung thay vì merge tay từng dòng.
> 4. Cả 3 người thống nhất Notification model nằm ở đâu, để mình dọn lại
>    cho gọn.
>
> Còn lại, phần code mình vừa xong (Log Work, Time Lock) không phụ thuộc gì
> vào 2 nhánh kia nên merge được ngay, không cần chờ."
