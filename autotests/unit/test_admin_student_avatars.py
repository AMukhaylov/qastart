from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_admin_student_avatar_url_flows_from_profile_to_shared_avatar_component():
    server = (ROOT / "src/server/students.functions.ts").read_text(encoding="utf-8")
    route = (ROOT / "src/routes/admin.students.tsx").read_text(encoding="utf-8")

    assert '.select("id,login,full_name,avatar_url,created_at,course_start_at")' in server
    assert "avatar_url: profile?.avatar_url ?? null" in server
    assert "avatar_url: student.avatar_url" in route
    assert "<AvatarImage" in route
    assert 'src={row.avatar_url}' in route
    assert 'src={selectedStudent.avatar_url}' in route
    assert "<AvatarFallback" in route
