#!/usr/bin/env python3
"""Refresh ECJ class listings from the public LACCD guest class search.

Runs in GitHub Actions. It reads only public schedule pages and writes
``data/classes.json`` for the static ECJ website. Student browsers never send
credentials or contact SIS through this script.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode, urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = (
    "https://mycollege-guest.laccd.edu/psc/classsearchguest/EMPLOYEE/HRMS/"
    "c/COMMUNITY_ACCESS.CLASS_SEARCH.GBL"
)
CAMPUS_CODE = "LAMC"
CAMPUS_NAME = "Los Angeles Mission College"

SUBJECTS = (
    ("ENGL", "English"),
    ("ENGLISH", "English"),
    ("COMM", "Communication Studies"),
    ("JOURNAL", "Journalism"),
)

COURSE_RE = re.compile(
    r"\b(ENGLISH|ENGL|COMM|JOURNAL)\s+([A-Z]*\d+[A-Z]*)\s*-\s*(.+)", re.I
)
CLASS_RE = re.compile(r"\b(\d{5})\b")
SECTION_RE = re.compile(r"^[A-Z]\d{1,3}[A-Z0-9]*-[A-Z]{2,}$", re.I)
DATE_RANGE_RE = re.compile(
    r"\b(\d{2}/\d{2}/\d{4})\s*-\s*(\d{2}/\d{2}/\d{4})\b"
)
STATUS_RE = re.compile(r"\b(Wait List|Open|Closed)\b", re.I)


@dataclass(frozen=True)
class CourseContext:
    subject_code: str
    course_number: str
    title: str


def clean(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()




def dedupe_repeated_phrase(value: str) -> str:
    """Collapse scraper repetitions such as 'Frank Williams Frank Williams'."""
    value = clean(value)
    if not value:
        return ""

    comma_parts = [clean(part) for part in value.split(",") if clean(part)]
    if len(comma_parts) > 1 and all(part == comma_parts[0] for part in comma_parts):
        return comma_parts[0]

    words = value.split()
    for size in range(1, len(words) // 2 + 1):
        if len(words) % size:
            continue
        phrase = words[:size]
        if all(words[index:index + size] == phrase for index in range(0, len(words), size)):
            return " ".join(phrase)
    return value

def normalize_title(raw: str) -> str:
    title = clean(raw)
    for marker in ("Collapsible section", "Class Section Days & Times"):
        if marker in title:
            title = title.split(marker, 1)[0].strip()
    repeated = COURSE_RE.search(title)
    if repeated and repeated.start() > 0:
        title = title[: repeated.start()].strip()
    return title.rstrip(" -")


def course_from_text(text: str) -> CourseContext | None:
    match = COURSE_RE.search(clean(text))
    if not match:
        return None
    return CourseContext(
        subject_code=match.group(1).upper(),
        course_number=match.group(2).upper(),
        title=normalize_title(match.group(3)),
    )


def element_signals(element) -> str:
    """Collect visible and accessible text without using a huge page-level scope."""
    values = [clean(element.get_text(" ", strip=True))]
    for node in element.find_all(True):
        for attr in ("alt", "title", "aria-label", "data-original-title", "src"):
            value = clean(node.get(attr, ""))
            if value:
                values.append(value)
    return clean(" ".join(values))


def infer_materials(signals: str) -> tuple[list[str], str]:
    """Detect student-facing textbook-cost labels already present in a row.

    LACCD's PeopleSoft backend uses the internal attribute value ``OER`` for the
    public "Zero Textbook Cost (ZTC)" class-search type. Because that backend
    code does not prove that a section uses openly licensed OER, it is mapped to
    ZTC rather than exposed as a separate OER badge.
    """
    flags: list[str] = []
    matched: list[str] = []

    patterns = (
        (
            "ZTC",
            r"\bZTC\b|Zero\s+Textbook\s+Cost|"
            r"All\s+textbooks/readings\s+will\s+be\s+provided\s+free\s+of\s+cost|"
            r"LAC_OER_ICON",
        ),
        (
            "Low Cost",
            r"\bLCT\b|\bLTC\b|Low\s+Textbook\s+Cost|Low\s+Cost\s+Textbook|"
            r"LAC_[A-Z0-9_]*(?:LCT|LOW[_-]?COST)[A-Z0-9_]*",
        ),
    )
    for label, pattern in patterns:
        found = re.search(pattern, signals, re.I)
        if found:
            flags.append(label)
            matched.append(found.group(0))

    return flags, clean("; ".join(dict.fromkeys(matched)))


def infer_format(room: str, schedule: str, signals: str) -> str:
    haystack = clean(f"{room} {schedule} {signals}").lower()
    if "hyflex" in haystack:
        return "HyFlex"

    hybrid = "hybrid" in haystack or "blended" in haystack
    live = "online live" in haystack or "zoom" in haystack
    online = "online" in haystack
    physical = bool(re.search(r"mission-(?!online\b)[a-z0-9]", haystack, re.I))

    if hybrid and live:
        return "Zoom Hybrid"
    if hybrid:
        return "In Person Hybrid"
    if live and physical:
        return "Zoom Hybrid"
    if live:
        return "Zoom"
    if online and physical:
        return "In Person Hybrid"
    if online:
        return "Online"
    return "In Person"


def normalize_status(value: str) -> str:
    value = clean(value).lower()
    if value == "wait list":
        return "Wait List"
    if value == "open":
        return "Open"
    if value == "closed":
        return "Closed"
    return "Unknown"


def status_from_row(row, signals: str) -> str:
    matches = list(STATUS_RE.finditer(signals))
    if matches:
        return normalize_status(matches[-1].group(1))
    return "Unknown"


def direct_cells(row) -> list[str]:
    cells = [clean(cell.get_text(" ", strip=True)) for cell in row.find_all("td", recursive=False)]
    cells = [cell for cell in cells if cell]
    if cells:
        return cells

    cells = [clean(cell.get_text(" ", strip=True)) for cell in row.find_all("td")]
    result: list[str] = []
    for item in cells:
        if item and (not result or item != result[-1]):
            result.append(item)
    return result


def find_index(items: list[str], predicate, start: int = 0) -> int | None:
    for index in range(start, len(items)):
        if predicate(items[index]):
            return index
    return None


def iso_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%m/%d/%Y").date().isoformat()
    except ValueError:
        return ""


def date_bounds(signals: str) -> tuple[str, str]:
    ranges = DATE_RANGE_RE.findall(signals)
    if not ranges:
        return "", ""
    starts = [iso_date(start) for start, _ in ranges]
    ends = [iso_date(end) for _, end in ranges]
    starts = [value for value in starts if value]
    ends = [value for value in ends if value]
    return (min(starts) if starts else "", max(ends) if ends else "")


def merge_material_note(section: dict, signals: str) -> bool:
    """Attach a textbook-cost note row to the section that immediately precedes it."""
    flags, matched_text = infer_materials(signals)
    if not flags:
        return False

    existing = list(section.get("materials") or [])
    section["materials"] = list(dict.fromkeys(existing + flags))

    note_text = clean(signals)
    friendly_notes: list[str] = []
    if "ZTC" in flags:
        friendly_notes.append("All textbooks/readings will be provided free of cost.")
    if "Low Cost" in flags:
        friendly_notes.append("Low Textbook Cost")

    current_text = clean(section.get("materials_text", ""))
    additions = friendly_notes or ([matched_text] if matched_text else [])
    section["materials_text"] = "; ".join(
        dict.fromkeys([part for part in [current_text, *additions] if part])
    )
    return True


def parse_results(
    html: str,
    subject_display: str,
    term_id: str,
    term_label: str,
    source_url: str,
) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    sections: list[dict] = []
    current_course: CourseContext | None = None
    last_section: dict | None = None

    for row in soup.find_all("tr"):
        row_text = clean(row.get_text(" ", strip=True))
        signals = element_signals(row)

        # Course heading rows reset the "previous section" pointer so that a
        # course-level note can never leak backward onto the prior course.
        maybe_course = course_from_text(row_text)
        if maybe_course and not CLASS_RE.search(row_text[:40]):
            current_course = maybe_course
            last_section = None

        cells = direct_cells(row)
        if not cells:
            if last_section is not None and signals:
                merge_material_note(last_section, signals)
            continue

        class_idx = find_index(cells, lambda value: bool(re.fullmatch(r"\d{5}", value)))
        combined_match = None
        if class_idx is None:
            for index, cell in enumerate(cells):
                match = re.match(r"^(\d{5})\s+(.+)$", cell)
                if match:
                    class_idx = index
                    combined_match = match
                    break
        if class_idx is None:
            # LACCD renders ZTC/LCT as a separate row immediately after the
            # section row. Keep the previous section active until another class
            # row or course heading appears, and attach the note here.
            if last_section is not None and signals:
                merge_material_note(last_section, signals)
            continue

        if combined_match:
            class_number = combined_match.group(1)
            cells = cells[:class_idx] + [class_number, clean(combined_match.group(2))] + cells[class_idx + 1 :]
        else:
            class_number = cells[class_idx]

        row_status = status_from_row(row, signals)
        if row_status == "Unknown":
            continue

        context = current_course
        if context is None:
            previous_text = row.find_previous(string=COURSE_RE)
            if previous_text:
                context = course_from_text(str(previous_text))
        if context is None:
            continue

        section_idx = find_index(cells, lambda value: bool(SECTION_RE.fullmatch(value)), class_idx + 1)
        date_idx = find_index(cells, lambda value: bool(DATE_RANGE_RE.search(value)), class_idx + 1)
        room_idx = find_index(cells, lambda value: "Mission-" in value, (section_idx or class_idx) + 1)
        status_idx = find_index(
            cells,
            lambda value: clean(value).lower() in {"open", "closed", "wait list"},
            class_idx + 1,
        )

        section_code = cells[section_idx] if section_idx is not None else ""
        dates = cells[date_idx] if date_idx is not None else ""
        room = cells[room_idx] if room_idx is not None else ""

        schedule = ""
        if section_idx is not None:
            end = room_idx if room_idx is not None else (date_idx if date_idx is not None else status_idx)
            if end is not None and end > section_idx + 1:
                schedule = clean(" ".join(cells[section_idx + 1 : end]))

        instructor = ""
        if room_idx is not None and date_idx is not None and date_idx > room_idx + 1:
            instructor = dedupe_repeated_phrase(" ".join(cells[room_idx + 1 : date_idx]))

        fallback_details = "" if schedule and room and dates else row_text
        start_date, end_date = date_bounds(signals)
        materials, materials_text = infer_materials(signals)

        href = ""
        for anchor in row.find_all("a", href=True):
            anchor_text = clean(anchor.get_text(" ", strip=True))
            if class_number in anchor_text or (section_code and section_code in anchor_text):
                href = urljoin(source_url, anchor["href"])
                break

        section_record = {
                "term_id": term_id,
                "term": term_label,
                "department": subject_display,
                "subject_code": context.subject_code,
                "course_number": context.course_number,
                "course": f"{context.subject_code} {context.course_number}",
                "title": context.title,
                "class_number": class_number,
                "section": section_code,
                "schedule": schedule,
                "room": room,
                "instructor": instructor,
                "dates": dates,
                "start_date": start_date,
                "end_date": end_date,
                "status": row_status,
                "format": infer_format(room, schedule, signals),
                "materials": materials,
                "materials_text": materials_text,
                "details": fallback_details,
                "sis_url": href or source_url,
            }
        sections.append(section_record)
        last_section = section_record

    unique: dict[str, dict] = {}
    for section in sections:
        key = section["class_number"]
        previous = unique.get(key)
        if previous is None:
            unique[key] = section
            continue

        score_fields = (
            "section",
            "schedule",
            "room",
            "instructor",
            "dates",
            "start_date",
            "materials",
        )
        score = sum(bool(section.get(field)) for field in score_fields)
        old_score = sum(bool(previous.get(field)) for field in score_fields)
        if score > old_score:
            unique[key] = section
        elif score == old_score:
            # Preserve any flags detected in either duplicate row.
            merged = list(dict.fromkeys((previous.get("materials") or []) + (section.get("materials") or [])))
            previous["materials"] = merged
            if section.get("materials_text") and not previous.get("materials_text"):
                previous["materials_text"] = section["materials_text"]

    return list(unique.values())


def build_search_url(term_id: str, subject: str, catalogid: str) -> str:
    params = {
        "Campus": CAMPUS_CODE,
        "PAGE": "SSR_CLSRCH_RSLT",
        "strm": term_id,
        "subj": subject,
        "catalogid": catalogid,
    }
    return f"{BASE_URL}?{urlencode(params)}"


def fetch_html(session: requests.Session, url: str, attempts: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            response = session.get(url, timeout=45)
            response.raise_for_status()
            text = response.text
            if "You must have cookies enabled" in text:
                session.get(BASE_URL, timeout=30)
                raise RuntimeError("Guest search requested a fresh cookie session")
            return text
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(2**attempt)
    raise RuntimeError(f"Could not fetch {url}: {last_error}")




def html_looks_like_results(html: str) -> bool:
    text = clean(BeautifulSoup(html, "html.parser").get_text(" ", strip=True)).lower()
    return (
        "class section(s) found" in text
        or "class sections found" in text
        or ("search results" in text and "class section" in text)
    )


def fetch_subject(
    session: requests.Session,
    term_id: str,
    term_label: str,
    subject_code: str,
    subject_display: str,
) -> list[dict]:
    broad_url = build_search_url(term_id, subject_code, "")
    broad_html = fetch_html(session, broad_url)
    broad_sections = parse_results(broad_html, subject_display, term_id, term_label, broad_url)
    if broad_sections:
        ztc_count = sum("ZTC" in (section.get("materials") or []) for section in broad_sections)
        low_count = sum("Low Cost" in (section.get("materials") or []) for section in broad_sections)
        print(
            f"{term_label}: {subject_code}: {len(broad_sections)} sections from one broad search "
            f"({ztc_count} ZTC; {low_count} low cost)"
        )
        return broad_sections

    print(f"{term_label}: {subject_code}: broad search returned no sections; trying digit sweep")
    unique: dict[str, dict] = {}
    successful_result_pages = 0
    for digit in "0123456789":
        url = build_search_url(term_id, subject_code, digit)
        html = fetch_html(session, url)
        if html_looks_like_results(html):
            successful_result_pages += 1
        for section in parse_results(html, subject_display, term_id, term_label, url):
            unique[section["class_number"]] = section
        time.sleep(0.15)

    if successful_result_pages == 0:
        raise RuntimeError(
            f"{term_label}: {subject_code}: public guest search returned no recognizable result pages"
        )

    print(f"{term_label}: {subject_code}: {len(unique)} unique sections from digit sweep")
    return list(unique.values())


def english_course_key(section: dict) -> tuple:
    subject = str(section.get("subject_code", "")).upper()
    number = str(section.get("course_number", "")).upper()
    exact = f"{subject} {number}"
    priority = {
        "ENGL C1000": 0,
        "ENGL C1000E": 1,
        "ENGL C1001": 2,
        "ENGLISH 102": 3,
    }
    if exact in priority:
        return (0, priority[exact], "", exact)

    match = re.search(r"\d+", number)
    numeric = int(match.group(0)) if match else 999999
    suffix = re.sub(r"^\D*\d+", "", number)
    return (1, numeric, suffix, exact)


def natural_course_key(section: dict) -> tuple:
    dept_order = {"English": 0, "Communication Studies": 1, "Journalism": 2}
    department = section.get("department", "")
    class_number = str(section.get("class_number", ""))

    if department == "English":
        return (0, english_course_key(section), class_number)

    course = str(section.get("course_number", ""))
    pieces = re.split(r"(\d+)", course)
    normalized = tuple(
        (0, int(piece)) if piece.isdigit() else (1, piece.lower())
        for piece in pieces
        if piece
    )
    return (dept_order.get(department, 9), normalized, class_number)


def count_statuses(sections: Iterable[dict]) -> dict:
    items = list(sections)
    return {
        "all": len(items),
        "open": sum(section.get("status") == "Open" for section in items),
        "wait_list": sum(section.get("status") == "Wait List" for section in items),
        "closed": sum(section.get("status") == "Closed" for section in items),
    }


def count_materials(sections: Iterable[dict]) -> dict:
    items = list(sections)
    return {
        "ztc": sum("ZTC" in (section.get("materials") or []) for section in items),
        "low_cost": sum("Low Cost" in (section.get("materials") or []) for section in items),
    }


def load_terms(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    terms = [item for item in data if item.get("enabled", True)]
    if not terms:
        raise RuntimeError("No enabled terms are configured in scripts/class_terms.json")
    for item in terms:
        if not item.get("id") or not item.get("label"):
            raise RuntimeError("Each class term needs both an id and a label")
    return terms


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--terms",
        default=str(Path(__file__).with_name("class_terms.json")),
        help="Path to term configuration JSON",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "data" / "classes.json"),
        help="Output JSON path",
    )
    args = parser.parse_args()

    terms_path = Path(args.terms)
    output_path = Path(args.output)
    terms = load_terms(terms_path)

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (compatible; LAMC-ECJ-Class-List/1.2; "
                "+https://www.lamc.edu/)"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    try:
        warmup = session.get(BASE_URL, timeout=30)
        warmup.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: initial guest-search warmup failed: {exc}", file=sys.stderr)

    term_payloads: list[dict] = []
    for term in terms:
        term_sections: dict[str, dict] = {}
        for subject_code, display in SUBJECTS:
            fetched = fetch_subject(
                session,
                str(term["id"]),
                str(term["label"]),
                subject_code,
                display,
            )
            for section in fetched:
                term_sections[section["class_number"]] = section

        sections = sorted(term_sections.values(), key=natural_course_key)
        if not sections:
            raise RuntimeError(
                f"{term['label']}: no ECJ sections were found. Existing site data was not overwritten."
            )

        departments = {section["department"] for section in sections}
        if len(sections) < 5 or "English" not in departments or "Communication Studies" not in departments:
            raise RuntimeError(
                f"{term['label']}: only {len(sections)} sections across {sorted(departments)}; "
                "refusing to replace the existing class feed."
            )

        term_payloads.append(
            {
                "id": str(term["id"]),
                "label": str(term["label"]),
                "sections": sections,
                "counts": count_statuses(sections),
                "material_counts": count_materials(sections),
            }
        )

    payload = {
        "schema_version": 2,
        "campus": CAMPUS_NAME,
        "campus_code": CAMPUS_CODE,
        "generated_at": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "source": {"name": "LACCD Public Class Search", "url": BASE_URL},
        "terms": term_payloads,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp_path.replace(output_path)

    total = sum(term["counts"]["all"] for term in term_payloads)
    open_total = sum(term["counts"]["open"] for term in term_payloads)
    ztc_total = sum(term["material_counts"]["ztc"] for term in term_payloads)
    low_total = sum(term["material_counts"]["low_cost"] for term in term_payloads)
    print(
        f"Wrote {total} ECJ sections ({open_total} open; "
        f"{ztc_total} ZTC; {low_total} low cost) to {output_path}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"Class refresh failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
