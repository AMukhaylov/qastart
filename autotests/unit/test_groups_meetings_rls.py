from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GROUPS_MIGRATION = ROOT / "supabase/migrations/20260925143000_student_groups_and_meeting_audiences.sql"
MEETINGS_MIGRATION = ROOT / "supabase/migrations/20260603140000_course_meetings.sql"
NOTIFICATIONS_MIGRATION = ROOT / "supabase/migrations/20260924142259_notifications_and_web_push.sql"


def test_group_membership_policies_are_admin_scoped_and_students_see_only_their_rows():
    sql = GROUPS_MIGRATION.read_text(encoding="utf-8").lower()

    for table in ("student_groups", "group_students", "meeting_groups", "meeting_students"):
        assert f"alter table public.{table} enable row level security" in sql
    assert "private.has_role((select auth.uid()), 'admin'::public.app_role)" in sql
    assert "gs.student_id = (select auth.uid())" in sql
    assert "student_id = (select auth.uid())" in sql
    assert "grant select on public.student_groups, public.group_students, public.meeting_groups, public.meeting_students to authenticated" in sql


def test_meeting_and_notification_reads_are_limited_to_published_or_owned_records():
    meetings = MEETINGS_MIGRATION.read_text(encoding="utf-8").lower()
    notifications = NOTIFICATIONS_MIGRATION.read_text(encoding="utf-8").lower()

    assert "alter table public.course_meetings enable row level security" in meetings
    assert "is_published = true" in meetings
    assert "admins can manage course meetings" in meetings
    assert "alter table public.notifications enable row level security" in notifications
    assert "(select auth.uid()) = recipient_user_id" in notifications
    assert "to authenticated" in notifications
    assert "grant select, update on public.notifications to authenticated" in notifications
