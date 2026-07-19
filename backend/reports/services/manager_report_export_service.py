from io import BytesIO
from datetime import datetime
from django.template.loader import render_to_string
from xhtml2pdf import pisa

from openpyxl import Workbook

from rest_framework.exceptions import APIException

from reports.services.manager_task_summary_report_service import (
    build_task_summary_report,
)
from reports.services.manager_timesheet_detail_report_service import (
    build_timesheet_detail_report,
)

from system.services.audit_manager_service import log_action


class ReportExportError(APIException):
    status_code = 400
    default_detail = "Report export failed."
    default_code = "report_export_error"


def safe_value(value):
    if value is None:
        return ""

    return value


def build_filename(report_type, file_format):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    extension = file_format.lower()

    return f"{report_type.lower()}_{timestamp}.{extension}"


def get_report_data(*, user, filters):
    report_type = filters.get("report_type")

    if report_type == "TASK_SUMMARY":
        return build_task_summary_report(
            user=user,
            filters=filters,
        )

    if report_type == "TIMESHEET_DETAIL":
        return build_timesheet_detail_report(
            user=user,
            filters=filters,
        )

    raise ReportExportError("UNSUPPORTED_REPORT_TYPE")


def write_task_summary_sheet(workbook, report_data):
    sheet = workbook.active
    sheet.title = "Task Summary"

    headers = [
        "Task ID",
        "Title",
        "Job",
        "Assignee",
        "Priority",
        "Status",
        "Deadline",
        "Completed At",
        "Created At",
        "Updated At",
    ]

    sheet.append(headers)

    for row in report_data["rows"]:
        sheet.append(
            [
                row["id"],
                row["title"],
                row["job"]["job_name"],
                row["assignee"]["full_name"],
                row["priority"],
                row["status"],
                row["deadline"],
                row["completed_at"],
                row["created_at"],
                row["updated_at"],
            ]
        )

    summary_sheet = workbook.create_sheet("Summary")

    summary_sheet.append(["Metric", "Value"])
    summary_sheet.append(
        [
            "Total Tasks",
            report_data["summary"]["total_tasks"],
        ]
    )
    summary_sheet.append(
        [
            "Total Active Tasks",
            report_data["summary"]["overdue_summary"]["total_active_tasks"],
        ]
    )
    summary_sheet.append(
        [
            "Overdue Tasks",
            report_data["summary"]["overdue_summary"]["overdue_tasks"],
        ]
    )
    summary_sheet.append(
        [
            "Overdue Rate Percent",
            report_data["summary"]["overdue_summary"]["overdue_rate_percent"],
        ]
    )

    summary_sheet.append([])
    summary_sheet.append(["Status", "Count"])

    for status_value, total in report_data["summary"]["status_summary"].items():
        summary_sheet.append([status_value, total])

    summary_sheet.append([])
    summary_sheet.append(["Priority", "Count"])

    for priority_value, total in report_data["summary"]["priority_summary"].items():
        summary_sheet.append([priority_value, total])


def write_timesheet_detail_sheet(workbook, report_data):
    sheet = workbook.active
    sheet.title = "Timesheet Detail"

    headers = [
        "LogWork ID",
        "Work Date",
        "Employee",
        "Department",
        "Job",
        "Task",
        "Task Status",
        "Hours",
        "Description",
        "Review Status",
        "Reviewed By",
        "Reviewed At",
        "Reviewed Note",
        "Adjusted By",
        "Adjusted At",
        "Adjustment Reason",
        "Locked Period Status",
        "Created At",
        "Updated At",
    ]

    sheet.append(headers)

    for row in report_data["rows"]:
        employee = row["employee"]
        department = employee.get("department")

        reviewed_by = row.get("reviewed_by")
        adjusted_by = row.get("adjusted_by")

        sheet.append(
            [
                row["id"],
                row["work_date"],
                employee["full_name"],
                department["name"] if department else "",
                row["job"]["job_name"],
                row["task"]["title"],
                row["task"]["status"],
                row["hours_spent"],
                row["description"],
                row["review_status"],
                reviewed_by["full_name"] if reviewed_by else "",
                row["reviewed_at"],
                row["review_note"],
                adjusted_by["full_name"] if adjusted_by else "",
                row["adjusted_at"],
                row["adjustment_reason"],
                row["locked_period_status"],
                row["created_at"],
                row["updated_at"],
            ]
        )

    summary_sheet = workbook.create_sheet("Summary")

    summary_sheet.append(["Metric", "Value"])
    summary_sheet.append(
        [
            "Total Logs",
            report_data["summary"]["total_logs"],
        ]
    )
    summary_sheet.append(
        [
            "Total Hours",
            report_data["summary"]["total_hours"],
        ]
    )

    summary_sheet.append([])
    summary_sheet.append(["Review Status", "Count"])

    for status_value, total in report_data["summary"]["review_status_summary"].items():
        summary_sheet.append([status_value, total])

    summary_sheet.append([])
    summary_sheet.append(["Employee", "Total Logs", "Total Hours"])

    for employee_row in report_data["summary"]["employee_summary"]:
        summary_sheet.append(
            [
                employee_row["full_name"],
                employee_row["total_logs"],
                employee_row["total_hours"],
            ]
        )

    summary_sheet.append([])
    summary_sheet.append(["Job", "Total Logs", "Total Hours"])

    for job_row in report_data["summary"]["job_summary"]:
        summary_sheet.append(
            [
                job_row["job_name"],
                job_row["total_logs"],
                job_row["total_hours"],
            ]
        )


def autosize_worksheet_columns(workbook):
    for sheet in workbook.worksheets:
        for column_cells in sheet.columns:
            max_length = 0
            column_letter = column_cells[0].column_letter

            for cell in column_cells:
                value = cell.value

                if value is None:
                    continue

                max_length = max(
                    max_length,
                    len(str(value)),
                )

            sheet.column_dimensions[column_letter].width = min(
                max_length + 2,
                50,
            )


def export_xlsx(*, report_type, report_data):
    workbook = Workbook()

    if report_type == "TASK_SUMMARY":
        write_task_summary_sheet(
            workbook,
            report_data,
        )

    elif report_type == "TIMESHEET_DETAIL":
        write_timesheet_detail_sheet(
            workbook,
            report_data,
        )

    else:
        raise ReportExportError("UNSUPPORTED_REPORT_TYPE")

    autosize_worksheet_columns(workbook)

    output = BytesIO()
    workbook.save(output)

    return output.getvalue()


def export_pdf(*, report_type, report_data):
    """
    Xuất file PDF sử dụng xhtml2pdf và Django Template.
    """
    # 1. Chọn file HTML tương ứng với loại báo cáo
    if report_type == "TASK_SUMMARY":
        template_path = "reports/task_summary_pdf.html"
    elif report_type == "TIMESHEET_DETAIL":
        template_path = "reports/timesheet_detail_pdf.html"
    else:
        raise ReportExportError("UNSUPPORTED_REPORT_TYPE")

    # 2. Bơm dữ liệu vào template để tạo ra mã HTML hoàn chỉnh
    html_string = render_to_string(template_path, report_data)

    # 3. Dùng xhtml2pdf "chụp" mã HTML đó thành file PDF
    output = BytesIO()
    pisa_status = pisa.CreatePDF(
        src=html_string,
        dest=output,
        encoding='utf-8'
    )

    # 4. Kiểm tra lỗi trong quá trình tạo
    if pisa_status.err:
        raise ReportExportError("Error during PDF generation.")

    return output.getvalue()


def export_manager_report(*, user, filters, request=None):
    """
    Export report cho Manager.

    Report data vẫn phải bị giới hạn bởi scope Manager thông qua
    build_task_summary_report() hoặc build_timesheet_detail_report().

    Hàm trả về:
        {
            "filename": "...xlsx",
            "content_type": "...",
            "content": bytes
        }
    """
    report_type = filters.get("report_type")
    file_format = filters.get("file_format")

    report_data = get_report_data(
        user=user,
        filters=filters,
    )

    if file_format == "XLSX":
        content = export_xlsx(
            report_type=report_type,
            report_data=report_data,
        )
        content_type = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    elif file_format == "PDF":
        content = export_pdf(
            report_type=report_type,
            report_data=report_data,
        )
        content_type = "application/pdf"

    else:
        raise ReportExportError("UNSUPPORTED_EXPORT_FORMAT")

    filename = build_filename(
        report_type=report_type,
        file_format=file_format,
    )

    log_action(
        user=user,
        action="REPORT_EXPORTED",
        table_name="reports",
        record_id=0,
        old_values=None,
        new_values={
            "report_type": report_type,
            "file_format": file_format,
            "filename": filename,
            "filters": dict(filters),
        },
        request=request,
    )

    return {
        "filename": filename,
        "content_type": content_type,
        "content": content,
    }