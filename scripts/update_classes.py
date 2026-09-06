#!/usr/bin/env python3
"""Refresh ECJ class listings from the public LACCD guest class search.

The site itself never contacts SIS from a student's browser. This script runs in
GitHub Actions, reads public schedule pages, and writes a small static JSON file
that the GitHub Pages site can safely load from its own origin.

The scraper first tries one subject-only request. If the guest search does not
return results without a course number, it falls back to ten broad "contains"
searches (0 through 9) and de-duplicates sections by class number. LACCD course
numbers contain digits, so the sweep covers both legacy numbers (for example,
ENGLISH 102) and CCN numbers (for example, ENGL C1000).
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

# LACCD uses both the legacy ENGLISH subject and the CCN ENGL subject.
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
SECTION_RE = re.compile(r"^[A-Z]\w*-[A-Z]+$", re.I)
DATE_RANGE_RE = re.compile(
    r"\b\d{2}/\d{2}/\d{4}\s*-\s*\d{2}/\d{2}/\d{4}\b"
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


def normalize_title(raw: str) -> str:
    title = clean(raw)
    for marker in ("Collapsible section", "Class Section Days & Times"):
        if marker in title:
            title = title.split(marker, 1)[0].strip()
    # PeopleSoft sometimes repeats the full course label in accessible text.
    repeated = COURSE_RE.search(title)
    if repeated and repeated.start() > 0:
        title = title[: repeated.start()].strip()
    return title.rstrip(" -")


def course_from_text(text: str) -> CourseContext | None:
    m = COURSE_RE.search(clean(text))
    if not m:
        return None
    return CourseContext(
        subject_code=m.group(1).upper(),
        course_number=m.group(2).upper(),
        title=normalize_title(m.group(3)),
    )


def infer_format(room: str, schedule: str, row_text: str) -> str:
    haystack = f"{room} {schedule} {row_text}".lower()
    if "hyflex" in haystack:
        return "HyFlex"
    if "hybrid" in haystack:
        return "Hybrid"
    if "online live" in haystack:
        return "Online Live"
    if "online" in haystack:
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


def status_from_row(row, text: str) -> str:
    # PeopleSoft often renders status as an image whose alt text is Open,
    # Closed, or Wait List, so normal element text alone is not enough.
    candidates = [text]
    for image in row.find_all("img"):
        candidates.extend([image.get("alt", ""), image.get("title", "")])
    for candidate in reversed(candidates):
        match = STATUS_RE.search(clean(candidate))
        if match:
            return normalize_status(match.group(1))
    return "Unknown"


def direct_cells(row) -> list[str]:
    cells = [clean(cell.get_text(" ", strip=True)) for cell in row.find_all("td", recursive=False)]
    cells = [c for c in cells if c]
    if cells:
        return cells
    # Some PeopleSoft tables nest cells. This fallback is intentionally broad.
    cells = [clean(cell.get_text(" ", strip=True)) for cell in row.find_all("td")]
    result: list[str] = []
    for item in cells:
        if item and (not result or item != result[-1]):
            result.append(item)
    return result


def find_index(items: list[str], predicate, start: int = 0) -> int | None:
    for i in range(start, len(items)):
        if predicate(items[i]):
            return i
    return None


def parse_results(html: str, subject_display: str, term_id: str, term_label: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    sections: list[dict] = []
    current_course: CourseContext | None = None

    for row in soup.find_all("tr"):
        row_text = clean(row.get_text(" ", strip=True))
        if not row_text:
            continue

        maybe_course = course_from_text(row_text)
        if maybe_course and not CLASS_RE.search(row_text[:40]):
            current_course = maybe_course

        cells = direct_cells(row)
        if not cells:
            continue

        class_idx = find_index(cells, lambda x: bool(re.fullmatch(r"\d{5}", x)))
        combined_match = None
        if class_idx is None:
            for i, cell in enumerate(cells):
                m = re.match(r"^(\d{5})\s+(.+)$", cell)
                if m:
                    class_idx = i
                    combined_match = m
                    break
        if class_idx is None:
            continue

        if combined_match:
            class_number = combined_match.group(1)
            cells = cells[:class_idx] + [class_number, clean(combined_match.group(2))] + cells[class_idx + 1 :]
        else:
            class_number = cells[class_idx]

        row_status = status_from_row(row, row_text)
        if row_status == "Unknown":
            continue

        # If the course heading lives outside the current <tr>, look backward.
        context = current_course
        if context is None:
            previous_text = row.find_previous(string=COURSE_RE)
            if previous_text:
                context = course_from_text(str(previous_text))
        if context is None:
            # A section without a course label is not useful enough to publish.
            continue

        section_idx = find_index(cells, lambda x: bool(SECTION_RE.fullmatch(x)), (class_idx or 0) + 1)
        date_idx = find_index(cells, lambda x: bool(DATE_RANGE_RE.search(x)), (class_idx or 0) + 1)
        room_idx = find_index(cells, lambda x: "Mission-" in x, (section_idx or class_idx or 0) + 1)
        status_idx = find_index(cells, lambda x: clean(x).lower() in {"open", "closed", "wait list"}, (class_idx or 0) + 1)

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
            instructor = clean(" ".join(cells[room_idx + 1 : date_idx]))

        if not schedule or not room or not dates:
            # Preserve the meaningful row text as a transparent fallback rather
            # than guessing at a field split when PeopleSoft changes markup.
            fallback_details = row_text
        else:
            fallback_details = ""

        href = ""
        for anchor in row.find_all("a", href=True):
            if class_number in clean(anchor.get_text(" ", strip=True)) or section_code in clean(anchor.get_text(" ", strip=True)):
                href = urljoin(source_url, anchor["href"])
                break

        section = {
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
            "status": row_status,
            "format": infer_format(room, schedule, row_text),
            "details": fallback_details,
            "sis_url": href or source_url,
        }
        sections.append(section)

    # De-duplicate rows created by nested PeopleSoft tables.
    unique: dict[str, dict] = {}
    for section in sections:
        key = section["class_number"]
        previous = unique.get(key)
        if previous is None:
            unique[key] = section
            continue
        # Prefer the richer parse if one duplicate has more structured fields.
        score = sum(bool(section.get(k)) for k in ("section", "schedule", "room", "instructor", "dates"))
        old_score = sum(bool(previous.get(k)) for k in ("section", "schedule", "room", "instructor", "dates"))
        if score > old_score:
            unique[key] = section
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
                # Re-warm the guest session and retry.
                session.get(BASE_URL, timeout=30)
                raise RuntimeError("Guest search requested a fresh cookie session")
            return text
        except Exception as exc:  # noqa: BLE001 - surfaced after retries
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Could not fetch {url}: {last_error}")


def html_looks_like_results(html: str) -> bool:
    text = clean(BeautifulSoup(html, "html.parser").get_text(" ", strip=True)).lower()
    return (
        "class section(s) found" in text
        or "class sections found" in text
        or "search results" in text and "class section" in text
    )


def fetch_subject(
    session: requests.Session,
    term_id: str,
    term_label: str,
    subject_code: str,
    subject_display: str,
) -> list[dict]:
    """Fetch one subject, preferring one broad request and falling back to digits."""

    # Fast path: LACCD often accepts a blank course number with term, subject,
    # and campus already supplied in the query string.
    broad_url = build_search_url(term_id, subject_code, "")
    broad_html = fetch_html(session, broad_url)
    broad_sections = parse_results(broad_html, subject_display, term_id, term_label, broad_url)
    if broad_sections:
        print(f"{term_label}: {subject_code}: {len(broad_sections)} sections from one broad search")
        return broad_sections

    # Some PeopleSoft configurations return the search form instead of results
    # when catalogid is blank. The course-number field uses "contains", so a
    # 0-9 sweep covers every normal numeric/alphanumeric course number.
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


def natural_course_key(section: dict) -> tuple:
    dept_order = {"English": 0, "Communication Studies": 1, "Journalism": 2}
    course = section.get("course_number", "")
    pieces = re.split(r"(\d+)", course)
    normalized = tuple(int(piece) if piece.isdigit() else piece.lower() for piece in pieces if piece != "")
    return (
        dept_order.get(section.get("department", ""), 9),
        normalized,
        section.get("class_number", ""),
    )


def count_statuses(sections: Iterable[dict]) -> dict:
    sections = list(sections)
    return {
        "all": len(sections),
        "open": sum(s.get("status") == "Open" for s in sections),
        "wait_list": sum(s.get("status") == "Wait List" for s in sections),
        "closed": sum(s.get("status") == "Closed" for s in sections),
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
                "Mozilla/5.0 (compatible; LAMC-ECJ-Class-List/1.0; "
                "+https://www.lamc.edu/)"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    # Establish the public guest cookie before using parameterized result pages.
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

        # Sanity check catches a parser/site change before publishing an implausibly
        # tiny partial list. Journalism may be small, so the threshold stays low.
        departments = {s["department"] for s in sections}
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
            }
        )

    payload = {
        "schema_version": 1,
        "campus": CAMPUS_NAME,
        "campus_code": CAMPUS_CODE,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": {"name": "LACCD Public Class Search", "url": BASE_URL},
        "terms": term_payloads,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp_path.replace(output_path)

    total = sum(term["counts"]["all"] for term in term_payloads)
    open_total = sum(term["counts"]["open"] for term in term_payloads)
    print(f"Wrote {total} ECJ sections ({open_total} open) to {output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"Class refresh failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
