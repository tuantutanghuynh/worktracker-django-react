# Prompt: Tiếp tục series chú thích code TuDocs/ (file 15 trở đi)

Dán nguyên văn phần dưới đây cho agent/session khác để nó làm tiếp đúng quy trình đã dùng cho file 01-14.

---

Bối cảnh: Project WorkTracker (Django backend + React frontend) tại
worktracker-django-react/. Thư mục TuDocs/ chứa 1 series file .md đánh số
(01 -> 41), mỗi file là bản "Executive Code Annotation" chú thích chi tiết
cho đúng 1 file source Python thật trong backend/, dùng để dạy tôi (Java
background, đang học Python/Django) hiểu sâu cú pháp lẫn nghiệp vụ.

Quy ước đặt tên: TuDocs/NN_<app>_<filename>_py.md tương ứng với file source
thật ở backend/<app>/<filename>.py (dấu "_" trong tên file .md thay cho "/"
và ".py" gốc, ví dụ 19_timesheets_views_employee_py.md <->
backend/timesheets/views_employee.py).

Đã hoàn thành: file 01-14. Việc cần làm tiếp: lặp lại ĐÚNG quy trình dưới
đây cho các file còn lại theo thứ tự, bắt đầu từ 15:

15_projects_models_py.md, 16_tasks_models_py.md,
17_timesheets_models_py.md, 18_timesheets_serializers_employee_py.md,
19_timesheets_views_employee_py.md, 20_timesheets_urls_employee_py.md,
21_timesheets_services_daily_total_manager_service_py.md,
22_timesheets_services_timelock_manager_service_py.md,
23_timesheets_services_logwork_review_manager_service_py.md,
24_timesheets_serializers_manager_py.md, 25_timesheets_views_manager_py.md,
26_timesheets_urls_manager_py.md, 27_timesheets_filters_manager_py.md,
28_system_models_py.md, 29_system_utils_py.md,
30_system_services_audit_manager_service_py.md,
31_system_services_notification_manager_service_py.md,
32_system_permissions_manager_py.md, 33_system_scoping_manager_py.md,
34_system_serializers_admin_py.md, 35_system_views_admin_py.md,
36_system_urls_admin_py.md, 37_projects_views_admin_py.md,
38_projects_views_manager_py.md, 39_tasks_views_manager_py.md,
40_tasks_services_task_transition_manager_service_py.md,
41_reports_views_manager_py.md

QUY TRÌNH cho mỗi file (làm tuần tự, không nhảy cóc, hỏi tôi nếu muốn dừng
giữa chừng hay đi hết một mạch):

1. Đọc file .md hiện có trong TuDocs/ VÀ đọc file source thật tương ứng
   trong backend/ (bắt buộc — nội dung code trong .md đôi khi đã được viết
   lại/rút gọn so với source thật, phải đối chiếu để chú thích chính xác,
   không suy đoán).

2. Sửa TRỰC TIẾP các dòng `#` nằm NGAY DƯỚI mỗi dòng code trong các khối
   ```python ...``` đã có sẵn trong file .md — KHÔNG tách chú thích ra
   thành đoạn văn/heading riêng bên ngoài code block (đã thử cách đó và bị
   yêu cầu sửa lại thành comment inline). Giữ nguyên toàn bộ cấu trúc khác
   của file: tiêu đề, sơ đồ ASCII, khối "Vì sao...", bảng tổng kết cuối
   file — chỉ làm giàu thêm phần comment trong code block.

3. Mức độ sâu cần đạt cho mỗi dòng code: không chỉ tả "dòng này làm gì" mà
   phải giải thích CƠ CHẾ cú pháp Python/Django/DRF đứng sau nó. Ví dụ các
   loại insight cần chủ động tìm và giải thích khi gặp:
   - super()/MRO khi có kế thừa nhiều tầng, override method
   - is None / is not None vs kiểm tra truthy (đặc biệt khi giá trị hợp lệ
     có thể là False/0/rỗng — dễ gây bug nếu dùng sai)
   - f-string, dict.get() vs subscript [], dict.pop(), **kwargs unpacking
   - decorator (@action, @property...) — nó gắn metadata/wrap hàm thế nào
   - list/dict comprehension, khi nào QuerySet lazy thực sự chạy SQL
   - Django ORM: select_related (và phát hiện N+1 query nếu thiếu),
     values_list(flat=True), foreign key lookup bằng "__", so sánh FK field
     trực tiếp với 1 instance Model
   - DRF: Serializer vs ModelSerializer (class Meta tự sinh field thế nào),
     nested serializer + source=, extra_kwargs, APIView vs ViewSet/
     ModelViewSet/ReadOnlyModelViewSet, get_permissions()/get_serializer_class()
     hook theo self.action, .as_view() là closure chứ không phải instance,
     contract 3 khả năng của authenticate()/permission classes
   - urls.py: path converter <int:...>, DefaultRouter.register() + basename,
     include() nhận list vs nhận string module path, urlpatterns là tên
     biến cố định
   - Bất cứ khi nào 1 khái niệm đã giải thích sâu ở file trước (vd file 05
     đã giải thích is not None kỹ) mà file sau lặp lại pattern tương tự thì
     có thể ghi ngắn gọn hơn kèm "giống hệt cách đã học ở file NN", không
     cần viết lại dài dòng từ đầu.

4. Nếu khi đối chiếu source thật phát hiện điểm bất thường đáng chú ý (bug
   tiềm ẩn, thiếu tối ưu N+1, thiếu đồng bộ cache, đặt tên không nhất quán,
   sai lệch giữa 2 chỗ code làm cùng 1 việc...) — CHỦ ĐỘNG ghi chú lại điều
   đó ngay trong comment như 1 quan sát trung thực, đối chiếu rõ với phần
   nào của code khác. TUYỆT ĐỐI KHÔNG tự ý sửa code nguồn thật trong
   backend/ — chỉ ghi chú trong tài liệu .md.

5. Viết bằng tiếng Việt, giữ giọng văn đã thiết lập trong file: có thể chêm
   ví von đời thường khi giúp dễ hình dung, nhưng ưu tiên chính xác kỹ
   thuật hơn là màu mè.

6. Dùng Edit tool để sửa từng khối code trong file .md (không dùng Write
   ghi đè toàn bộ file, không cần rewrite những phần đã ổn).

7. Sau khi xong 1-2 file, dừng lại báo cáo ngắn gọn cho tôi: đã làm file
   nào, điểm cú pháp/bất thường nổi bật nhất tìm được — rồi hỏi có tiếp tục
   file kế tiếp không (đừng tự động chạy hết 27 file còn lại trong 1 lần
   nếu tôi không nói "làm hết"/"làm tới file X").
