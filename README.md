# LAMC ECJ

Faculty-maintained student resource hub for the English, Communication Studies, and Journalism Department at Los Angeles Mission College.

The site includes:

- a department-wide homepage;
- a current announcement page for featured new classes;
- degree and certificate program pages;
- a public ECJ Class Finder;
- student resources and interactive guides;
- a Connect page for department opportunities and future Faculty Spotlights; and
- a dedicated page for *La Misión Review*, LAMC's student literary magazine.

Site policy pages include `privacy.html`, `accessibility.html`, and `license.html`.

## ECJ Class Finder

`classes.html` displays a static copy of public LACCD schedule data from `data/classes.json`.

The GitHub Action in `.github/workflows/update-classes.yml` refreshes that file twice each day and can also be run manually from the repository's **Actions** tab. The browser reads the saved JSON rather than querying SIS while students filter classes. It contacts an official LACCD page only when a student follows a live-section or enrollment link.

Current semester IDs live in `scripts/class_terms.json`. To add a new semester, add its verified LACCD `strm` value and label, then run the **Refresh ECJ class listings** workflow.

The updater checks these LACCD subject codes:

- `ENGL` and `ENGLISH` for English
- `COMM` for Communication Studies
- `JOURNAL` for Journalism

If LACCD changes its public Class Search markup, the updater is designed to fail without replacing the most recent working `data/classes.json` file.


## Maintenance Notes

- `ecj-accessibility.css` is loaded last on every HTML page and contains shared focus, reduced-motion, small-label, and footer-readability safeguards. Put cross-site accessibility fixes there when possible.
- `classes.html` is the single maintained Class Finder. `classes_ztc_fixed.html` remains only as a compatibility redirect for any older links.
- `scripts/update_classes.py` is the single maintained class-data updater. Keep updater code in `scripts/` so the GitHub Action and local maintenance use the same file.
- Featured-class links may use `classes.html?term=TERM_ID&class=CLASS_NUMBER` to open the finder on one exact section, regardless of whether the section is currently open or closed.
- The ECJ feedback form is hosted in Microsoft Forms. The student-facing privacy explanation is maintained on both `connect.html` and `privacy.html`.

## Privacy and Security Hardening

- Every page uses a no-referrer policy.
- A restrictive Content Security Policy limits executable scripts, styles, images, network requests, and frames to the sources each page actually needs; inline scripts/styles are not permitted.
- PlayLab frames are created only after a visitor chooses to load them, use `referrerPolicy = "no-referrer"`, and are sandboxed.
- External links use normal same-tab browser navigation rather than forcing a new browsing context, and the site-wide no-referrer policy limits referrer leakage.
- The class updater renders scraped schedule text as text rather than executable HTML.
- GitHub Actions used by the class updater are pinned to full commit SHAs, and Python dependencies are version-pinned in `scripts/requirements.txt`. The workflow does not persist repository credentials during scraping/dependency installation, installs only the explicitly listed binary packages, and exposes the write token only to the final push step.
- Dependabot is configured for weekly GitHub Actions and Python dependency update pull requests.
- Page-specific CSS lives in `styles/` instead of inline `<style>` blocks so the site can enforce a stricter style policy.
- The Accessibility page provides a direct LAMC work-email route for reporting barriers, and the footer labels that route explicitly on every full site page; visitors are told they do not need to disclose disability or medical information.
