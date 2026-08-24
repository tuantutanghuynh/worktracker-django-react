import axiosClient from "./axiosClient"

// Creates a log work entry for a specific task — same real endpoint
// EmployeeLogWorkView already exposes (built early this session), called
// directly here from inside a task's own detail drawer (task id is
// already known, no task picker needed like the future Dashboard form).
export async function createLogWork({ task, work_date, hours_spent, description }) {
    const { data } = await axiosClient.post("/timesheets/log-works/", {
        task, work_date, hours_spent, description,
    })
    return data
}

export async function voidLogWork(id, reason) {
    const { data } = await axiosClient.patch(`/timesheets/log-works/${id}/void/`, { reason })
    return data
}

export async function editLogWork(id, { hours_spent, description, adjustment_reason }) {
    const { data } = await axiosClient.patch(`/timesheets/log-works/${id}/edit/`, {
        hours_spent, description, adjustment_reason,
    })
    return data
}
