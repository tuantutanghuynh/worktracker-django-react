# 05 — Sự cố: Lộ password Postgres thật lên Git

Sự cố này không liên quan tới logic JWT/Redis, nhưng đáng ghi lại vì là
bài học bảo mật thực tế đáng giá nhất của Giai đoạn 2.

## Diễn biến

`backend/worktracker_core/settings.py` ban đầu có giá trị mẫu
`'PASSWORD': '123'`. Trong lúc làm việc, password thật của Postgres
(`tuantu209423`) được điền vào để chạy server local — và **vô tình bị
commit cùng với code khác** (commit "Add JWT login/refresh for accounts
app"), rồi **push lên `origin/TuanTu` trên GitHub**.

Sau đó, để "tránh lộ" khi push các commit kế tiếp, giá trị bị đổi tay lại
thành `'123'` — nhưng việc này chỉ thay đổi **trạng thái hiện tại** của
file, không xóa được password thật khỏi các commit cũ đã tồn tại.

## Vì sao đổi lại giá trị không giải quyết được vấn đề

Git lưu **toàn bộ lịch sử**, không chỉ trạng thái mới nhất. Xác nhận bằng:

```bash
git log --all --oneline -- backend/worktracker_core/settings.py
git show <commit_hash>:backend/worktracker_core/settings.py | grep PASSWORD
```

Kết quả cho thấy đúng 1 commit (`e3f3a342`) chứa giá trị `tuantu209423`,
và:

```bash
git branch -r --contains e3f3a342
# origin/TuanTu
```

Xác nhận commit đó đã có trên remote — bất kỳ ai có quyền xem repo (hoặc
clone trước khi sửa) đều có thể `git log -p` ra lại password thật, dù file
hiện tại đã không còn hiển thị nó.

## Hướng xử lý đã chọn — không rewrite git history

Rewrite lịch sử (`git filter-repo`, `git filter-branch`, BFG) yêu cầu
force-push, viết lại commit hash của mọi người đã có — rủi ro cao và cần
phối hợp cả team (ai đã `pull` branch này phải xử lý lại). Vì đây chỉ là
password của **database local** (`127.0.0.1`, không expose ra Internet),
rủi ro thực tế thấp — chọn hướng xử lý đơn giản hơn, không động tới lịch
sử git:

1. **Đặt lại đúng password thật vào `settings.py`** để server chạy được local — không cần giấu giá trị này trong file đang dùng hàng ngày.
2. **Chuyển sang đọc password từ biến môi trường** (`.env`, đã có sẵn trong `.gitignore`, `python-dotenv` đã có trong `requirements.txt`) — để từ nay `settings.py` không bao giờ chứa giá trị thật nữa, dù commit bao nhiêu lần:

   ```python
   import os
   from dotenv import load_dotenv

   load_dotenv()

   DATABASES = {
       "default": {
           ...
           "PASSWORD": os.getenv("DB_PASSWORD"),
       }
   }
   ```

   File `.env` (không commit) chỉ chứa: `DB_PASSWORD=tuantu209423`.

3. **(Khuyến nghị, chưa bắt buộc)** Đổi lại password Postgres thật bằng `ALTER USER postgres WITH PASSWORD '...'` để vô hiệu hóa giá trị đã từng lộ, phòng trường hợp repo chuyển sang public hoặc có người ngoài từng clone.

## Bài học cho cả team

Không bao giờ hardcode giá trị thật (password, API key, secret key) trực
tiếp vào file sẽ commit, **ngay cả trong giai đoạn dev cá nhân** — vì rất
dễ quên đổi lại trước khi commit, và một khi đã push, việc "sửa lại" file
không xóa được dấu vết trong lịch sử git. Dùng biến môi trường (`.env`)
ngay từ đầu cho mọi secret, không chỉ riêng phần `accounts`.
