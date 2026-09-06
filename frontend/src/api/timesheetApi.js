import axiosClient from "./axiosClient"

// Ba endpoint tu-phuc-vu (thong bao, nhat ky cua chinh minh, lich su cham
// cong) gio da phan trang o backend nen tra ve {count, next, previous, results}
// thay vi mot mang tran. Boc `results` ra ngay tai day de cac trang dang loc va
// phan trang o phia trinh duyet khong phai sua gi.
const layDanhSach = (data) => (Array.isArray(data) ? data : data?.results ?? []);

// Fetches the calling Employee's own log_work history — GET /log-works/mine/,
// powers the Timesheet page's list table. Create/void already live in
// logWorkApi.js (built for the My Tasks drawer) — reused here, not duplicated.
export async function getMyTimesheet(params = {}) {
    const { data } = await axiosClient.get("/timesheets/log-works/mine/", { params })
    return layDanhSach(data)
}
