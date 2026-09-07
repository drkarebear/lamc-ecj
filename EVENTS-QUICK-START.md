# Around the District: quick start

You do not need to hand-edit events in HTML.

1. Open `apps-script/Code.gs`.
2. Create a standalone project at Google Apps Script and paste in the code.
3. Set the Apps Script project time zone to `America/Los_Angeles`.
4. Run `setupEventSystem()` once. It creates the Google Form and private moderation Sheet.
5. Deploy the Apps Script as a Web app that executes as you and can be accessed by anyone. The Web app exposes only approved public event fields.
6. Run `getSetupInfo()` and copy the public Form URL and Web app URL.
7. Paste those two URLs into `config.js`. In this master build, they are already connected:

```js
window.LACCD_ENGLISH_EVENTS = {
  feedUrl: "https://script.google.com/macros/s/AKfycbw1wV-_fdW_6MTQKEnhHCUX3FnlLG5ESFCBq-hiCSLqDmVIu-8jaTCtI6oWlAk1ozFy/exec",
  submitUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdhQcGBi2odYj0Aj0pFjjPSua_aeKBdZKRg2Zn6iF6j57-1Ug/viewform"
};
```

## Your regular workflow after setup

- Faculty submit the public event form.
- The submission lands in your private Sheet.
- You review the row.
- Set `Approved` to `Yes`.
- The event appears automatically.
- After its end date, it stops appearing automatically.

The private Sheet keeps the historical record. You do not have to delete old events from the spreadsheet.
