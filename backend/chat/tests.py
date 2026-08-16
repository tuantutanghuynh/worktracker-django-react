import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient
from model_bakery import baker
from django.contrib.auth import get_user_model
from projects.models import Job
from tasks.models import Task
from chat.models import ChatRoom, ChatParticipant, ChatMessage

User = get_user_model()


@pytest.mark.django_db
class TestChatBackend:
    def setup_method(self):
        cache.clear()
        self.client = APIClient()

        # Tạo Manager và Employee
        self.role_manager = baker.make("accounts.Role", code="MANAGER")
        self.role_employee = baker.make("accounts.Role", code="EMPLOYEE")

        self.manager = baker.make(
            User,
            email="manager@worktracker.vn",
            role=self.role_manager,
            is_active=True,
        )
        self.employee1 = baker.make(
            User,
            email="emp1@worktracker.vn",
            role=self.role_employee,
            is_active=True,
        )
        self.employee2 = baker.make(
            User,
            email="emp2@worktracker.vn",
            role=self.role_employee,
            is_active=True,
        )

        # Tạo Job và Task
        self.job = baker.make(
            Job,
            job_code="JOB-TEST",
            job_name="Cloud Migration Project",
            manager=self.manager,
            status=Job.Status.ACTIVE,
        )
        self.task = baker.make(
            Task,
            job=self.job,
            assignee=self.employee1,
            creator=self.manager,
            title="Setup Kubernetes",
            deadline="2026-08-30",
            status=Task.Status.IN_PROGRESS,
        )

    def test_manager_lists_auto_created_job_channel(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get("/api/chat/rooms/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["job_channels"]) == 1
        assert data["job_channels"][0]["job_code"] == "JOB-TEST"

    def test_employee_lists_assigned_job_channel(self):
        self.client.force_authenticate(user=self.employee1)
        response = self.client.get("/api/chat/rooms/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["job_channels"]) == 1
        assert data["job_channels"][0]["job_code"] == "JOB-TEST"

    def test_unrelated_employee_cannot_see_other_job_channel(self):
        self.client.force_authenticate(user=self.employee2)
        response = self.client.get("/api/chat/rooms/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["job_channels"]) == 0

    def test_send_message_in_job_channel(self):
        self.client.force_authenticate(user=self.manager)
        list_resp = self.client.get("/api/chat/rooms/")
        room_id = list_resp.json()["job_channels"][0]["id"]

        msg_resp = self.client.post(
            f"/api/chat/rooms/{room_id}/send_message/",
            {"content": "Kick-off Cloud Migration today!"},
            format="json",
        )
        assert msg_resp.status_code == status.HTTP_201_CREATED
        assert msg_resp.json()["content"] == "Kick-off Cloud Migration today!"
        assert msg_resp.json()["is_mine"] is True

        # Employee đọc tin nhắn
        self.client.force_authenticate(user=self.employee1)
        get_msgs = self.client.get(f"/api/chat/rooms/{room_id}/messages/")
        assert get_msgs.status_code == status.HTTP_200_OK
        messages = get_msgs.json()["messages"]
        assert len(messages) == 1
        assert messages[0]["content"] == "Kick-off Cloud Migration today!"
        assert messages[0]["is_mine"] is False

    def test_create_and_send_direct_message(self):
        self.client.force_authenticate(user=self.manager)
        dm_resp = self.client.post(
            "/api/chat/rooms/start_direct/",
            {"target_user_id": self.employee1.id},
            format="json",
        )
        assert dm_resp.status_code == status.HTTP_200_OK
        room_id = dm_resp.json()["id"]

        # Gửi tin nhắn 1-1
        send_resp = self.client.post(
            f"/api/chat/rooms/{room_id}/send_message/",
            {"content": "Hi Mia, check task deadline please."},
            format="json",
        )
        assert send_resp.status_code == status.HTTP_201_CREATED

        # Employee kiểm tra tin nhắn 1-1
        self.client.force_authenticate(user=self.employee1)
        emp_list = self.client.get("/api/chat/rooms/")
        assert len(emp_list.json()["direct_messages"]) == 1
        assert emp_list.json()["direct_messages"][0]["unread_count"] == 1

    def test_cannot_send_message_to_completed_job_channel(self):
        self.job.status = Job.Status.COMPLETED
        self.job.save()

        self.client.force_authenticate(user=self.manager)
        list_resp = self.client.get("/api/chat/rooms/")
        room_id = list_resp.json()["job_channels"][0]["id"]

        msg_resp = self.client.post(
            f"/api/chat/rooms/{room_id}/send_message/",
            {"content": "Try sending to closed job"},
            format="json",
        )
        assert msg_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "closed and archived as read-only" in msg_resp.json()["detail"]
