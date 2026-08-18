import axiosClient from "./axiosClient"

// Fetches the calling Employee's own log_work history — GET /log-works/mine/,
// powers the Timesheet page's list table. Create/void already live in
// logWorkApi.js (built for the My Tasks drawer) — reused here, not duplicated.
export async function getMyTimesheet() {
    const { data } = await axiosClient.get("/timesheets/log-works/mine/")
    return data
}
