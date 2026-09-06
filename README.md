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

The GitHub Action in `.github/workflows/update-classes.yml` refreshes that file twice each day and can also be run manually from the repository's **Actions** tab. The browser never contacts SIS directly, so the page does not require a student login and does not send student-entered information to LACCD.

Current semester IDs live in `scripts/class_terms.json`. To add a new semester, add its verified LACCD `strm` value and label, then run the **Refresh ECJ class listings** workflow.

The updater checks these LACCD subject codes:

- `ENGL` and `ENGLISH` for English
- `COMM` for Communication Studies
- `JOURNAL` for Journalism

If LACCD changes its public Class Search markup, the updater is designed to fail without replacing the most recent working `data/classes.json` file.
