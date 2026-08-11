from pathlib import Path

routes_dir = Path("/var/www/qastart/src/routes")
target = routes_dir / ("lessons." + chr(36) + "day.tsx")
target.write_bytes(Path("/tmp/lessons_day.tsx").read_bytes())

for file in routes_dir.iterdir():
    if file.name.startswith("lessons.") and file.name != target.name:
        file.unlink()

print([file.name for file in routes_dir.iterdir() if file.name.startswith("lessons")])
