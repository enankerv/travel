"""Markdown text cleaning and extraction utilities."""
import re


def strip_other_villas_block(markdown_text: str) -> str:
    """Remove the 'Other Properties' / 'More villas' / 'Recommended similar' block and any list of other villa names."""
    text = markdown_text
    # Section heading + content (Other/More/Recommended similar/Related villas or properties)
    text = re.sub(
        r"\n#+\s*Other\s+(?:Top-?[Rr]ated\s+)?(?:Villas|Properties)[^\n]*\n[\s\S]*?(?=\n#+\s|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\n#+\s*More\s+(?:top-?rated\s+)?(?:villas|properties)[^\n]*\n[\s\S]*?(?=\n#+\s|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\n#+\s*Recommended similar (?:villas|properties)[^\n]*\n[\s\S]*?(?=\n#+\s|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\n(?:Recommended similar (?:villas|properties)|Similar (?:villas|properties))[:\s]*\n[\s\S]*?(?=\n\n|\n#|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    # Paragraph: "[Company] offers a range of top-rated villas in X, including A, B, C."
    text = re.sub(
        r"\n[^\n]*offers a range of top-rated villas[^\n]*(?:\n[^\n]*)*?(?=\n\n|\n#|\Z)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    # List of other villa names: "    Chianti Sanctuary Villa | Tuscany" (2+ consecutive lines of "Name | Region")
    lines = text.split("\n")
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^\s*(?:[-*•]\s*)?.+\|\s*(?:Tuscany|Toscana)\s*$", line.strip(), re.IGNORECASE):
            run = [line]
            j = i + 1
            while j < len(lines) and re.match(
                r"^\s*(?:[-*•]\s*)?.+\|\s*(?:Tuscany|Toscana)\s*$", lines[j].strip(), re.IGNORECASE
            ):
                run.append(lines[j])
                j += 1
            if len(run) >= 2:
                i = j
                continue
        out.append(line)
        i += 1
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_main_property_only(markdown_text: str) -> str:
    """
    Keep only the main property block: from the first # Villa Name (or price line)
    until (not including) '## More top rated villas' / '## Other properties'.
    Also drop leading cookie banner.
    """
    text = markdown_text

    # 1. Drop leading cookie banner
    if re.search(r"We (?:value your privacy|use cookies to enhance)|This website uses (?:its own )?functional cookies", text, re.IGNORECASE):
        text = re.sub(
            r"^[\s\S]*?(?=\n#+\s+[A-Za-z]|\nFrom\s+[\d,]+)",
            "",
            text,
            flags=re.IGNORECASE,
        )
    text = text.lstrip()

    # 2. Start at first main property heading (# or ## Villa Name) or price line (From X € to Y €); include both when price comes first
    title_m = re.search(r"\n#+\s+[A-Za-z][^\n]+", text)
    price_m = re.search(r"(?:^|\n)From\s+[\d\s,]+\s*€\s+to\s+[\d\s,]+\s*€\s*/?\s*week", text, re.IGNORECASE)
    if title_m and price_m:
        start = min(title_m.start(), price_m.start())
        text = text[start :].lstrip()
    elif title_m:
        text = text[title_m.start() :].lstrip()
    elif price_m:
        text = text[price_m.start() :].lstrip()

    # 3. End before cross-sell section
    end_m = re.search(
        r"\n##\s*(?:More\s+top\s+rated\s+villas|Other\s+(?:top\s+rated\s+)?(?:villas|properties)|Recommended\s+similar)",
        text,
        re.IGNORECASE,
    )
    if end_m:
        text = text[: end_m.start()].rstrip()

    return re.sub(r"\n{3,}", "\n\n", text).strip()


def get_word_count(text: str) -> int:
    """Get word count for determining if scrape is thin."""
    return len(text.split())


def is_thin_scrape(markdown_text: str, threshold: int = 30) -> bool:
    """Check if markdown text is too thin (below word count threshold)."""
    return get_word_count(markdown_text) < threshold
