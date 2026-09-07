/**
 * LACCD English DDC Events
 * Google Form + private Sheet + public read-only event feed.
 *
 * Run setupEventSystem() once from a standalone Apps Script project.
 * Then deploy the project as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Only rows marked Approved = Yes are returned by doGet().
 * Verification emails and moderator notes are never included in the public feed.
 */

const EVENT_CONFIG = {
  timeZone: 'America/Los_Angeles',
  formTitle: 'Share an LACCD English Event',
  sheetTitle: 'LACCD English DDC Events',
  formDescription:
    'Have something happening at your college? If English faculty, writers, readers, or students across the district might be interested, send it our way.\n\n' +
    'Adjunct and full-time faculty are equally welcome to submit. You do not need to be a DDC representative.\n\n' +
    'This form is for information intended for public posting. Your verification email is used only to confirm the submission and is not published by the event feed.',
  confirmationMessage:
    'Thank you. Your event was sent for review. Approved events will appear on the LACCD English DDC faculty commons. The bird has been informed.',
  colleges: [
    'Districtwide / multiple LACCD colleges',
    'East Los Angeles College',
    'Los Angeles City College',
    'Los Angeles Harbor College',
    'Los Angeles Mission College',
    'Los Angeles Pierce College',
    'Los Angeles Southwest College',
    'Los Angeles Trade-Technical College',
    'Los Angeles Valley College',
    'West Los Angeles College',
    'Other / external partner'
  ],
  eventTypes: [
    'Reading or literary event',
    'Professional learning or workshop',
    'Meeting or DDC event',
    'Call, deadline, or submission opportunity',
    'Student-facing opportunity',
    'Faculty collaboration opportunity',
    'Conference or presentation',
    'Other'
  ],
  formats: [
    'In person',
    'Online',
    'Hybrid',
    'Deadline / no meeting location',
    'Other'
  ],
  audiences: [
    'English faculty',
    'All faculty',
    'Students',
    'Staff',
    'Community / public'
  ]
};

const FIELD = {
  timestamp: 'Timestamp',
  title: 'Event title',
  college: 'College or host',
  type: 'Event type',
  startDate: 'Start date',
  startTime: 'Start time (optional)',
  endDate: 'End date (optional)',
  endTime: 'End time (optional)',
  format: 'Format',
  location: 'Location or public-facing location details (optional)',
  url: 'Public event or registration link (optional)',
  description: 'Short description',
  audience: 'Who is this for?',
  accessibility: 'Accessibility or accommodation information (optional)',
  sponsor: 'Hosting department, group, or publication (optional)',
  submitterName: 'Your name',
  verificationEmail: 'Your LACCD or college email for verification (not published)',
  consent: 'Public-posting confirmation',
  approved: 'Approved',
  featured: 'Featured',
  moderatorNotes: 'Moderator Notes'
};

function setupEventSystem() {
  const props = PropertiesService.getScriptProperties();
  const existingFormId = props.getProperty('EVENT_FORM_ID');
  const existingSheetId = props.getProperty('EVENT_SHEET_ID');

  if (existingFormId && existingSheetId) {
    const existing = getSetupInfo_();
    Logger.log(JSON.stringify(existing, null, 2));
    return existing;
  }

  const ss = SpreadsheetApp.create(EVENT_CONFIG.sheetTitle);
  ss.setSpreadsheetTimeZone(EVENT_CONFIG.timeZone);

  const form = FormApp.create(EVENT_CONFIG.formTitle);
  form.setDescription(EVENT_CONFIG.formDescription);
  form.setConfirmationMessage(EVENT_CONFIG.confirmationMessage);
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(true);

  if (form.supportsAdvancedResponderPermissions()) {
    form.setPublished(true);
  } else {
    form.setAcceptingResponses(true);
  }

  form.addTextItem()
    .setTitle(FIELD.title)
    .setHelpText('Use the title people should see on the public event listing.')
    .setRequired(true);

  form.addListItem()
    .setTitle(FIELD.college)
    .setChoiceValues(EVENT_CONFIG.colleges)
    .setRequired(true);

  form.addListItem()
    .setTitle(FIELD.type)
    .setChoiceValues(EVENT_CONFIG.eventTypes)
    .setRequired(true);

  form.addDateItem()
    .setTitle(FIELD.startDate)
    .setIncludesYear(true)
    .setRequired(true);

  form.addTimeItem()
    .setTitle(FIELD.startTime)
    .setHelpText('Leave blank for an all-day item or a deadline without a specific time.')
    .setRequired(false);

  form.addDateItem()
    .setTitle(FIELD.endDate)
    .setIncludesYear(true)
    .setHelpText('Leave blank if the event ends the same day.')
    .setRequired(false);

  form.addTimeItem()
    .setTitle(FIELD.endTime)
    .setHelpText('Leave blank if there is no specific end time.')
    .setRequired(false);

  form.addListItem()
    .setTitle(FIELD.format)
    .setChoiceValues(EVENT_CONFIG.formats)
    .setRequired(true);

  form.addTextItem()
    .setTitle(FIELD.location)
    .setHelpText('For online events, use a public-facing description such as Zoom via registration. Do not post private passwords or meeting passcodes here.')
    .setRequired(false);

  const urlValidation = FormApp.createTextValidation()
    .requireTextIsUrl()
    .setHelpText('Enter a complete public URL, preferably beginning with https://.')
    .build();

  form.addTextItem()
    .setTitle(FIELD.url)
    .setHelpText('Use an accessible public event page, registration page, official announcement, or submission page when available.')
    .setValidation(urlValidation)
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle(FIELD.description)
    .setHelpText('One to three plain-language sentences is ideal.')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle(FIELD.audience)
    .setChoiceValues(EVENT_CONFIG.audiences)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle(FIELD.accessibility)
    .setHelpText('For example: accommodation request instructions, accessibility contact, captioning information, or an accessibility page link.')
    .setRequired(false);

  form.addTextItem()
    .setTitle(FIELD.sponsor)
    .setRequired(false);

  form.addTextItem()
    .setTitle(FIELD.submitterName)
    .setRequired(true);

  const emailValidation = FormApp.createTextValidation()
    .requireTextIsEmail()
    .setHelpText('Enter a valid LACCD or college email address.')
    .build();

  form.addTextItem()
    .setTitle(FIELD.verificationEmail)
    .setHelpText('This is kept in the private response sheet and is not returned by the public event feed.')
    .setValidation(emailValidation)
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle(FIELD.consent)
    .setChoiceValues(['I confirm that the event information above is intended for public posting on the LACCD English faculty commons.'])
    .setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(1500);

  const responseSheet = getResponseSheet_(ss);
  addModeratorColumns_(responseSheet);
  formatResponseSheet_(responseSheet);
  createSetupSheet_(ss, form, responseSheet);

  props.setProperties({
    EVENT_FORM_ID: form.getId(),
    EVENT_SHEET_ID: ss.getId(),
    EVENT_RESPONSE_SHEET_NAME: responseSheet.getName()
  });

  const info = getSetupInfo_();
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

function getSetupInfo() {
  const info = getSetupInfo_();
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

function getSetupInfo_() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('EVENT_FORM_ID');
  const sheetId = props.getProperty('EVENT_SHEET_ID');
  const form = formId ? FormApp.openById(formId) : null;
  const webAppUrl = ScriptApp.getService().getUrl() || '';

  return {
    formUrl: form ? form.getPublishedUrl() : '',
    formEditUrl: form ? form.getEditUrl() : '',
    sheetUrl: sheetId ? 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit' : '',
    webAppUrl: webAppUrl,
    feedUrl: webAppUrl ? webAppUrl + '?action=events' : '',
    timeZone: EVENT_CONFIG.timeZone
  };
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'events').toLowerCase();
  const callback = String((e && e.parameter && e.parameter.callback) || '');

  if (action === 'health') {
    return publicResponse_({ ok: true, service: 'laccd-english-events', time: new Date().toISOString() }, callback);
  }

  if (action !== 'events') {
    return publicResponse_({ ok: false, error: 'Unknown action.' }, callback);
  }

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    timeZone: EVENT_CONFIG.timeZone,
    events: getPublicEvents_()
  };

  return publicResponse_(payload, callback);
}

function getPublicEvents_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('EVENT_SHEET_ID');
  const sheetName = props.getProperty('EVENT_RESPONSE_SHEET_NAME');
  if (!sheetId || !sheetName) return [];

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());
  const index = headerIndex_(headers);
  const now = new Date();
  const events = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!isYes_(cell_(row, index, FIELD.approved))) continue;

    const title = cleanText_(cell_(row, index, FIELD.title));
    const startDate = cell_(row, index, FIELD.startDate);
    if (!title || !(startDate instanceof Date) || isNaN(startDate)) continue;

    const startTime = cell_(row, index, FIELD.startTime);
    const endDate = cell_(row, index, FIELD.endDate);
    const endTime = cell_(row, index, FIELD.endTime);
    const allDay = !hasTime_(startTime);

    const start = combineDateTime_(startDate, startTime, false);
    let end;

    if (endDate instanceof Date && !isNaN(endDate)) {
      end = combineDateTime_(endDate, endTime, !hasTime_(endTime));
    } else if (hasTime_(endTime)) {
      end = combineDateTime_(startDate, endTime, false);
    } else if (allDay) {
      end = endOfDay_(startDate);
    } else {
      end = endOfDay_(startDate);
    }

    if (end < start) end = endOfDay_(startDate);
    if (end < now) continue;

    const submittedAt = cell_(row, index, FIELD.timestamp);
    const idSource = [
      submittedAt instanceof Date ? submittedAt.getTime() : r,
      title,
      cleanText_(cell_(row, index, FIELD.college))
    ].join('|');

    events.push({
      id: 'evt-' + shortHash_(idSource),
      title: title,
      college: cleanText_(cell_(row, index, FIELD.college)),
      type: cleanText_(cell_(row, index, FIELD.type)),
      format: cleanText_(cell_(row, index, FIELD.format)),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: allDay,
      location: cleanText_(cell_(row, index, FIELD.location)),
      url: safeHttpUrl_(cell_(row, index, FIELD.url)),
      description: cleanText_(cell_(row, index, FIELD.description)),
      audience: cleanText_(cell_(row, index, FIELD.audience)),
      accessibility: cleanText_(cell_(row, index, FIELD.accessibility)),
      sponsor: cleanText_(cell_(row, index, FIELD.sponsor)),
      featured: isYes_(cell_(row, index, FIELD.featured))
    });
  }

  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

function publicResponse_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function getResponseSheet_(ss) {
  const sheets = ss.getSheets();
  const formSheet = sheets.find(sheet => /^Form Responses/i.test(sheet.getName()));
  if (!formSheet) throw new Error('The Google Form response sheet was not created. Open the spreadsheet and confirm the form destination.');
  return formSheet;
}

function addModeratorColumns_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const needed = [FIELD.approved, FIELD.featured, FIELD.moderatorNotes];

  needed.forEach(header => {
    if (!headers.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers.push(header);
    }
  });

  const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  [FIELD.approved, FIELD.featured].forEach(header => {
    const col = newHeaders.indexOf(header) + 1;
    if (col > 0) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Yes', 'No'], true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
    }
  });
}

function formatResponseSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setWrap(true);
  sheet.getDataRange().setVerticalAlignment('top');
  sheet.autoResizeColumns(1, Math.min(sheet.getLastColumn(), 8));
}

function createSetupSheet_(ss, form, responseSheet) {
  let setup = ss.getSheetByName('SETUP');
  if (!setup) setup = ss.insertSheet('SETUP', 0);
  setup.clear();

  const rows = [
    ['LACCD English DDC Event System', ''],
    ['Public event submission form', form.getPublishedUrl()],
    ['Edit the Google Form', form.getEditUrl()],
    ['Private moderation sheet', ss.getUrl()],
    ['Response sheet tab', responseSheet.getName()],
    ['How to approve an event', 'In the response sheet, set Approved to Yes. Only approved, not-yet-ended events are returned by the public feed.'],
    ['Featured', 'Optional. Set Featured to Yes for future use. Events still display in chronological order.'],
    ['Verification email', 'Private. The public feed never returns this field.'],
    ['Next step', 'Deploy this Apps Script as a Web app. Execute as Me. Allow Anyone to access it. Then run getSetupInfo() and copy webAppUrl into the site config.js file.'],
    ['Privacy check', 'Open the Form Settings and confirm that sign-in is not required and email collection is off.'],
    ['Accessibility', 'Ask submitters for a public event page and accessibility/accommodation information when available.'],
    ['Time zone', EVENT_CONFIG.timeZone]
  ];

  setup.getRange(1, 1, rows.length, 2).setValues(rows);
  setup.getRange(1, 1, 1, 2).merge().setFontWeight('bold').setFontSize(14);
  setup.setFrozenRows(1);
  setup.setColumnWidth(1, 220);
  setup.setColumnWidth(2, 650);
  setup.getDataRange().setWrap(true).setVerticalAlignment('top');
}

function headerIndex_(headers) {
  const out = {};
  headers.forEach((header, i) => { out[String(header).trim()] = i; });
  return out;
}

function cell_(row, index, header) {
  const i = index[header];
  return typeof i === 'number' ? row[i] : '';
}

function isYes_(value) {
  if (value === true) return true;
  return /^(yes|y|true|approved|1)$/i.test(String(value || '').trim());
}

function hasTime_(value) {
  if (value instanceof Date && !isNaN(value)) return true;
  return /^\s*\d{1,2}:\d{2}/.test(String(value || ''));
}

function combineDateTime_(dateValue, timeValue, endOfDayWhenNoTime) {
  const d = new Date(dateValue);
  if (hasTime_(timeValue)) {
    const t = timeValue instanceof Date ? timeValue : parseTimeString_(String(timeValue));
    d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  } else if (endOfDayWhenNoTime) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function parseTimeString_(value) {
  const d = new Date(1899, 11, 30, 0, 0, 0, 0);
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (match) d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d;
}

function endOfDay_(dateValue) {
  const d = new Date(dateValue);
  d.setHours(23, 59, 59, 999);
  return d;
}

function cleanText_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function safeHttpUrl_(value) {
  const url = cleanText_(value);
  if (!url) return '';
  return /^https:\/\//i.test(url) ? url : '';
}

function shortHash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.slice(0, 8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
