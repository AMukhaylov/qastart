from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_landing_archie_section_and_navigation_are_in_the_requested_order():
    source = (ROOT / "src/routes/index.tsx").read_text(encoding="utf-8")
    header = (ROOT / "src/components/site-header.tsx").read_text(encoding="utf-8")

    benefits_start = source.index("const benefits = [")
    benefits_end = source.index("function LandingPage()", benefits_start)
    benefits = source[benefits_start:benefits_end]
    benefits_grid = source.index("{benefits.map((s) => (")
    archie = source.index("{/* ARCHIE */}", benefits_grid)
    roadmap = source.index("{/* ROADMAP */}", archie)
    mentor = source.index("{/* MENTOR */}", roadmap)

    assert benefits.count("title:") == 5
    assert benefits_grid < archie < roadmap < mentor
    archie_section = source[archie:roadmap]
    assert 'id="archie"' in source
    assert "ИИ-ПОМОЩНИК" in source
    assert "«Арчи»" in archie_section
    assert "Твой ИИ-помощник всегда рядом во время обучения" in archie_section
    assert "Поможет разобраться в материале, если что-то окажется непонятным." in source
    assert "простыми словами и ответит на вопросы по теме урока." in source
    assert "Объясняет материал простыми словами" in source
    assert "Отвечает на вопросы по теме урока" in source
    assert "Помогает разобраться, если что-то непонятно" in source
    assert "Доступен прямо во время обучения" in source
    assert "archiePortrait from \"@/assets/archie-study-transparent.png\"" in source
    assert (ROOT / "src/assets/archie-study-transparent.png").is_file()
    assert 'id="how" className="py-20 md:py-24"' in source
    assert 'id="archie" className="scroll-mt-20 py-20 md:py-24"' in source
    assert "ИИ-ПОМОЩНИК\n            </span>" in archie_section
    assert "<Sparkles className=\"h-3.5 w-3.5\" /> ИИ-ПОМОЩНИК" not in archie_section
    assert "h-[220px] w-[220px] overflow-hidden rounded-3xl md:h-[280px] md:w-[280px]" in archie_section
    assert "h-full w-full object-contain" in archie_section
    assert "text-lg leading-relaxed text-muted-foreground" in archie_section
    assert "text-3xl font-extrabold tracking-tight md:text-5xl" in archie_section
    assert "text-base leading-relaxed" in archie_section
    archie_section = source[archie:roadmap]
    roadmap_section = source[roadmap:mentor]
    mentor_section = source[mentor:]
    assert 'id="program" className="bg-[var(--gradient-soft)] py-20 md:py-24"' in roadmap_section
    assert 'id="mentor" className="py-20 md:py-24"' in mentor_section
    assert archie_section.index("Твой ИИ-помощник всегда рядом во время обучения") < archie_section.index("src={archiePortrait}")
    assert "rounded-3xl border border-border bg-card" not in archie_section
    assert "border border-border object-cover" not in archie_section

    navigation_labels = [
        header.index(">\n              Что внутри"),
        header.index(">\n              Арчи"),
        header.index(">\n              Маршрут обучения"),
        header.index(">\n              Наставник"),
    ]
    assert navigation_labels == sorted(navigation_labels)
    assert header.count('scrollIntoView({ behavior: "smooth" })') == 4
