from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_browser_favicon_uses_the_user_provided_brand_image():
    source = (ROOT / "src/routes/__root.tsx").read_text(encoding="utf-8")
    brand_logo = (ROOT / "src/components/brand-logo.tsx").read_text(encoding="utf-8")
    icon = ROOT / "public/favicon.png"

    assert 'href: "/favicon.png?v=8"' in source
    assert 'type: "image/png"' in source
    assert icon.is_file()
    image = icon.read_bytes()
    assert image.startswith(b"\x89PNG\r\n\x1a\n")
    assert image[25] == 6  # RGBA PNG, preserving transparent corners.
    assert 'src="/favicon.png?v=8"' in brand_logo
    assert 'alt="Логотип QA START"' in brand_logo
