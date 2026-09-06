import axiosClient from "./axiosClient"

// Ba endpoint tu-phuc-vu (thong bao, nhat ky cua chinh minh, lich su cham
// cong) gio da phan trang o backend nen tra ve {count, next, previous, results}
// thay vi mot mang tran. Boc `results` ra ngay tai day de cac trang dang loc va
// phan trang o phia trinh duyet khong phai sua gi.
const layDanhSach = (data) => (Array.isArray(data) ? data : data?.results ?? []);

// Fetches the calling user's own audit log entries — GET /employee/audit-logs/.
export async function getMyAuditLogs(params = {}) {
    const { data } = await axiosClient.get("/employee/audit-logs/", { params })
    return layDanhSach(data)
}
