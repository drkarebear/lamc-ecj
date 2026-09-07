# LACCD English DDC faculty commons

This prototype includes the eight manuscript marginalia animals in both original and horizontally flipped orientations, the `Englishfavicon.png` favicon, the belonging-focused homepage, and a new "Nine Colleges" castle map.

## The map works in two modes

1. **No API key:** The site displays its own accessible illustrated Los Angeles map with nine clickable castle markers. Each college card also links directly to Google Maps.
2. **Optional Google Maps enhancement:** Add a Google Maps JavaScript API key to `config.js`. The same section will switch to a real pannable Google map with the manuscript castle markers on top.

If you use a Google Maps API key on GitHub Pages, restrict the key by HTTP referrer in Google Cloud Console. For this site, the allowed referrer can be:

`https://drkarebear.github.io/laccd-english-ddc/*`

Do not commit an unrestricted key.

## Accessibility

The interactive map is optional. All nine colleges, DDC representatives, email links, and Google Maps links are also available in a standard HTML directory below the map. The map uses cooperative scrolling so it is less likely to trap page scrolling.


Navigation note: the district college map is labeled **The 9** in the primary navigation.

## Site status and accessibility

This independent faculty-created resource is maintained by Karen Crozer, Ph.D., on a volunteer basis. It is not an official LACCD website and is not sponsored, endorsed, or maintained by the Los Angeles Community College District or its colleges.

Accessibility is a core design priority. The site aims to follow WCAG 2.2 AA guidance, including keyboard access, readable text, strong contrast, responsive reflow, descriptive links, and reduced-motion support.

## Around the District events

This version also includes the first dynamic participation system: a moderated public event feed.

Files:

- `events.html` is the full public upcoming-events page.
- `assets/js/events.js` loads approved future events and builds accessible event cards.
- `assets/css/events.css` contains the shared event-card and filter styles.
- `apps-script/Code.gs` creates the Google Form, private response Sheet, moderation columns, and public read-only event feed.
- `apps-script/SETUP.md` has the setup steps.
- `config.js` is connected to the deployed public event feed and the public Share an Event form.

The homepage shows the next three approved events. `events.html` shows all upcoming approved events and includes college, event-type, and keyword filters.

Past events do not need to be deleted. The feed automatically stops returning them after their end date, while the private Sheet keeps the historical row.

### Moderation and privacy

Nothing submitted through the Google Form publishes automatically. Karen reviews each row and sets `Approved` to `Yes` before it appears publicly.

The public feed does not return the submitter name, verification email, timestamp, consent response, approval status, or moderator notes. The public `featured` flag may be returned because it controls public display behavior. The response Sheet should remain private.


## Marginalia sprite orientations

Both orientations are included under `assets/marginalia/`. Files ending in `-flipped.png` are horizontal mirrors of the originals. The current layouts generally use the flipped versions when an animal sits to the right of text so the creature faces inward toward the content. Both versions remain available for later pages and responsive layouts.


## Faculty Commons

This build adds `faculty.html`, an opt-in public faculty directory with accessible search and filters. The directory is powered by a separate Google Apps Script project in `faculty-apps-script/`.

The privacy model is deliberate:

- profiles do not publish until `Approved = Yes` in the private Sheet
- verification emails are not returned by the public feed unless the faculty member explicitly opts to display that email
- timestamps, consent records, moderator notes, and update/remove requests remain private
- no photo is required
- adjunct and full-time faculty appear together rather than in separate directory sections

See `FACULTY-COMMONS-QUICK-START.md` for setup.
