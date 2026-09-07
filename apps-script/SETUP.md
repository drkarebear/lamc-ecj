# Event system setup

This site uses a simple moderated workflow:

**Google Form -> private Google Sheet -> Karen approves -> public event feed -> website**

Only approved public event fields are exposed. Verification email and moderator notes stay in the private Sheet.

## 1. Create the form and Sheet

1. Go to https://script.google.com and create a new standalone Apps Script project.
2. Replace the default `Code.gs` with the contents of this folder's `Code.gs`.
3. In **Project Settings**, set the time zone to **America/Los_Angeles**.
4. Run `setupEventSystem()`.
5. Approve the requested Google Forms and Google Sheets permissions.
6. Open **Execution log**. The function returns links to the new Form and private Sheet.

The setup script creates the questions, links the Form to a response Sheet, and adds private moderation columns:

- `Approved`
- `Featured`
- `Moderator Notes`

An event is public only when `Approved` is set to `Yes`.

## 2. Check the Google Form settings

Open the generated Form and confirm:

- The form is published and accepting responses.
- **Collect email addresses** is off.
- Respondents are not required to sign in.
- Response summaries are not public.

The form itself asks for an LACCD or college email for verification. That field remains private and is never returned by the public feed.

## 3. Deploy the public read-only feed

1. In Apps Script choose **Deploy -> New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set access to **Anyone**.
5. Deploy.
6. Run `getSetupInfo()` again.
7. Copy the returned `webAppUrl`.

The feed URL will look like:

`https://script.google.com/macros/s/EXAMPLE/exec?action=events`

The site uses the read-only JSONP version of this feed so it can load approved public event data from GitHub Pages.

## 4. Connect the website

Open `config.js` and paste:

```js
window.LACCD_ENGLISH_EVENTS = {
  feedUrl: "YOUR_WEB_APP_URL",
  submitUrl: "YOUR_GOOGLE_FORM_PUBLIC_URL"
};
```

Use the bare Web app URL ending in `/exec` for `feedUrl`. The website adds `?action=events` itself.

## 5. Moderate events

New Form submissions appear in the private response Sheet.

To publish an event:

1. Check the event details and link.
2. Confirm it is appropriate for public posting.
3. Set **Approved** to `Yes`.

The website automatically:

- sorts approved events chronologically;
- excludes anything not approved;
- hides events after their end date;
- shows the next three events on the homepage;
- shows all upcoming events on `events.html`;
- creates Google Calendar and `.ics` add-to-calendar options in the browser.

No scheduled cleanup job is required. Expired rows remain in the private Sheet as a historical record but disappear from the public site.

## Privacy and security notes

- Do not put private Zoom passwords or meeting passcodes in the public event fields.
- Prefer a public registration or official event page.
- The event feed is intentionally read-only.
- Verification emails, submitter names, consent responses, timestamps, approval status, and moderator notes are not returned by the public feed.
- The Google Sheet should remain private.

