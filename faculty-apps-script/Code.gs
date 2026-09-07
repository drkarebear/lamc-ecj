/**
 * LACCD English Faculty Commons
 * Public opt-in faculty directory backed by a private Google Sheet.
 *
 * Run setupFacultyCommons() once from a standalone Apps Script project.
 * Then deploy the project as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Only rows marked Approved = Yes are returned by doGet().
 * Verification emails, consent records, change requests, timestamps,
 * and moderator notes are never returned by the public feed.
 */

const FACULTY_CONFIG = {
  timeZone: 'America/Los_Angeles',
  formTitle: 'Join the LACCD English Faculty Commons',
  changeFormTitle: 'Update or Remove My Faculty Commons Profile',
  sheetTitle: 'LACCD English Faculty Commons',
  formDescription:
    'The Faculty Commons is a public, opt-in directory for English faculty across LACCD. Adjunct and full-time faculty are equally welcome.\n\n' +
    'Your profile will not appear until it is reviewed. Your LACCD or college email is used to verify your faculty connection and stays private unless you explicitly choose to display it.\n\n' +
    'Photos are not required. You control what you share, and you may request an update or removal at any time.',
  confirmationMessage:
    'Thank you. Your profile was sent for review. Nothing appears publicly until it is approved. Pull up a chair.',
  changeConfirmationMessage:
    'Thank you. Your request was sent for review. Your public profile will not change automatically until the request is reviewed.',
  colleges: [
    'East Los Angeles College',
    'Los Angeles City College',
    'Los Angeles Harbor College',
    'Los Angeles Mission College',
    'Los Angeles Pierce College',
    'Los Angeles Southwest College',
    'Los Angeles Trade-Technical College',
    'Los Angeles Valley College',
    'West Los Angeles College'
  ],
  interests: [
    'ENGL C1000 / first-year composition',
    'ENGL C1001 / critical thinking and writing',
    'ENGL C1002 / literature and composition',
    'Literature',
    'Creative writing',
    'OER / ZTC',
    'Online teaching',
    'Dual enrollment',
    'Accessibility / UDL',
    'AI and writing',
    'Curriculum / governance',
    'Writing center / tutoring / academic support',
    'Literary journals / publications',
    'Professional learning'
  ]
};

const F = {
  timestamp: 'Timestamp',
  publicName: 'Name to display publicly',
  college: 'College',
  verificationEmail: 'LACCD or college email for verification (private)',
  displayEmail: 'Display this email publicly?',
  role: 'How would you like your faculty role described? (optional)',
  teaches: 'What do you teach? (optional)',
  askAbout: 'What can colleagues ask you about?',
  interests: 'Areas of interest (optional)',
  bio: 'Short bio (optional)',
  website: 'Professional website or profile (optional)',
  connect: 'Open to connecting with colleagues?',
  collaborate: 'Open to collaboration?',
  newerFaculty: 'Happy to talk with newer faculty?',
  curious: 'Currently curious about... (optional)',
  happily: 'Will happily talk about... (optional)',
  affiliation: 'Current LACCD English faculty confirmation',
  consent: 'Public profile consent',
  approved: 'Approved',
  featured: 'Featured',
  moderatorNotes: 'Moderator Notes',
  lastReviewed: 'Last Reviewed'
};

const C = {
  timestamp: 'Timestamp',
  publicName: 'Name currently shown in the Faculty Commons',
  college: 'College',
  verificationEmail: 'LACCD or college email for verification',
  requestType: 'What would you like to do?',
  details: 'What should change?',
  confirmation: 'Request confirmation'
};

function setupFacultyCommons() {
  const props = PropertiesService.getScriptProperties();
  const existingFormId = props.getProperty('FACULTY_FORM_ID');
  const existingSheetId = props.getProperty('FACULTY_SHEET_ID');

  if (existingFormId && existingSheetId) {
    const existing = getSetupInfo_();
    Logger.log(JSON.stringify(existing, null, 2));
    return existing;
  }

  const ss = SpreadsheetApp.create(FACULTY_CONFIG.sheetTitle);
  ss.setSpreadsheetTimeZone(FACULTY_CONFIG.timeZone);

  const form = FormApp.create(FACULTY_CONFIG.formTitle);
  form.setDescription(FACULTY_CONFIG.formDescription);
  form.setConfirmationMessage(FACULTY_CONFIG.confirmationMessage);
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);

  if (form.supportsAdvancedResponderPermissions()) {
    form.setPublished(true);
  } else {
    form.setAcceptingResponses(true);
  }

  form.addTextItem()
    .setTitle(F.publicName)
    .setHelpText('Use the name you would like colleagues and visitors to see.')
    .setRequired(true);

  form.addListItem()
    .setTitle(F.college)
    .setChoiceValues(FACULTY_CONFIG.colleges)
    .setRequired(true);

  const emailValidation = FormApp.createTextValidation()
    .requireTextIsEmail()
    .setHelpText('Enter a valid LACCD or college email address.')
    .build();

  form.addTextItem()
    .setTitle(F.verificationEmail)
    .setHelpText('This stays in the private moderation Sheet unless you explicitly choose to display it publicly.')
    .setValidation(emailValidation)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle(F.displayEmail)
    .setHelpText('Choosing Yes means this email address can appear on a public web page. No is the privacy-first default.')
    .setChoiceValues(['No', 'Yes'])
    .setRequired(true);

  form.addTextItem()
    .setTitle(F.role)
    .setHelpText('Optional. For example: Adjunct faculty, Professor, Department chair, or another description you prefer.')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle(F.teaches)
    .setHelpText('Courses, areas, genres, or programs are all fine. Keep it brief.')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle(F.askAbout)
    .setHelpText('Name at least one course, topic, practice, project, or district process you are comfortable talking about with colleagues.')
    .setRequired(true);

  const interestsItem = form.addCheckboxItem()
    .setTitle(F.interests)
    .setChoiceValues(FACULTY_CONFIG.interests)
    .setRequired(false);
  interestsItem.showOtherOption(true);

  form.addParagraphTextItem()
    .setTitle(F.bio)
    .setHelpText('Optional. Two or three sentences is plenty. This is a colleague introduction, not a CV.')
    .setRequired(false);

  const urlValidation = FormApp.createTextValidation()
    .requireTextIsUrl()
    .setHelpText('Enter a complete https:// URL.')
    .build();

  form.addTextItem()
    .setTitle(F.website)
    .setHelpText('Optional. College profile, professional website, publication page, or similar public professional link.')
    .setValidation(urlValidation)
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle(F.connect)
    .setChoiceValues(['Yes', 'No'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle(F.collaborate)
    .setHelpText('For example: shared teaching resources, presentations, professional learning, publications, or district projects.')
    .setChoiceValues(['Yes', 'No'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle(F.newerFaculty)
    .setChoiceValues(['Yes', 'No'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle(F.curious)
    .setRequired(false);

  form.addTextItem()
    .setTitle(F.happily)
    .setHelpText('Optional and human. Books, pedagogy, a course you love, a research interest, or something else colleagues might connect over.')
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle(F.affiliation)
    .setChoiceValues(['I am currently affiliated with an LACCD English department as faculty.'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle(F.consent)
    .setChoiceValues(['I understand that the profile information I chose to share may appear on a public website after review. My verification email stays private unless I selected Yes to display it.'])
    .setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(1500);

  const responseSheet = getNewestFormResponseSheet_(ss, []);
  addModeratorColumns_(responseSheet);
  formatSheet_(responseSheet);

  const changeForm = FormApp.create(FACULTY_CONFIG.changeFormTitle);
  changeForm.setDescription(
    'Use this form to request a change to, or removal of, your public Faculty Commons profile. Requests are reviewed before the public directory changes.');
  changeForm.setConfirmationMessage(FACULTY_CONFIG.changeConfirmationMessage);
  changeForm.setCollectEmail(false);
  changeForm.setLimitOneResponsePerUser(false);
  changeForm.setProgressBar(true);
  changeForm.setShowLinkToRespondAgain(false);

  if (changeForm.supportsAdvancedResponderPermissions()) {
    changeForm.setPublished(true);
  } else {
    changeForm.setAcceptingResponses(true);
  }

  changeForm.addTextItem().setTitle(C.publicName).setRequired(true);
  changeForm.addListItem().setTitle(C.college).setChoiceValues(FACULTY_CONFIG.colleges).setRequired(true);
  changeForm.addTextItem()
    .setTitle(C.verificationEmail)
    .setHelpText('Used to verify the request. This is not published.')
    .setValidation(emailValidation)
    .setRequired(true);
  changeForm.addMultipleChoiceItem()
    .setTitle(C.requestType)
    .setChoiceValues(['Update my profile', 'Remove my profile'])
    .setRequired(true);
  changeForm.addParagraphTextItem()
    .setTitle(C.details)
    .setHelpText('For an update, describe the new wording or information. For removal, you may simply write Remove my profile.')
    .setRequired(true);
  changeForm.addCheckboxItem()
    .setTitle(C.confirmation)
    .setChoiceValues(['I am requesting a change to the public profile associated with the name and college above.'])
    .setRequired(true);

  const beforeNames = ss.getSheets().map(s => s.getName());
  changeForm.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(1500);
  const changeSheet = getNewestFormResponseSheet_(ss, beforeNames);
  formatSheet_(changeSheet);

  props.setProperties({
    FACULTY_FORM_ID: form.getId(),
    FACULTY_CHANGE_FORM_ID: changeForm.getId(),
    FACULTY_SHEET_ID: ss.getId(),
    FACULTY_RESPONSE_SHEET_NAME: responseSheet.getName(),
    FACULTY_CHANGE_SHEET_NAME: changeSheet.getName()
  });

  createSetupSheet_(ss, form, changeForm, responseSheet, changeSheet);

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
  const formId = props.getProperty('FACULTY_FORM_ID');
  const changeFormId = props.getProperty('FACULTY_CHANGE_FORM_ID');
  const sheetId = props.getProperty('FACULTY_SHEET_ID');
  const form = formId ? FormApp.openById(formId) : null;
  const changeForm = changeFormId ? FormApp.openById(changeFormId) : null;
  const webAppUrl = ScriptApp.getService().getUrl() || '';

  return {
    joinUrl: form ? form.getPublishedUrl() : '',
    joinEditUrl: form ? form.getEditUrl() : '',
    changeUrl: changeForm ? changeForm.getPublishedUrl() : '',
    changeEditUrl: changeForm ? changeForm.getEditUrl() : '',
    sheetUrl: sheetId ? 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit' : '',
    webAppUrl: webAppUrl,
    feedUrl: webAppUrl ? webAppUrl + '?action=faculty' : '',
    timeZone: FACULTY_CONFIG.timeZone
  };
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'faculty').toLowerCase();
  const callback = String((e && e.parameter && e.parameter.callback) || '');

  if (action === 'health') {
    return publicResponse_({ ok: true, service: 'laccd-english-faculty-commons', time: new Date().toISOString() }, callback);
  }

  if (action !== 'faculty') {
    return publicResponse_({ ok: false, error: 'Unknown action.' }, callback);
  }

  return publicResponse_({
    ok: true,
    generatedAt: new Date().toISOString(),
    profiles: getPublicProfiles_()
  }, callback);
}

function getPublicProfiles_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('FACULTY_SHEET_ID');
  const sheetName = props.getProperty('FACULTY_RESPONSE_SHEET_NAME');
  if (!sheetId || !sheetName) return [];

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());
  const index = headerIndex_(headers);
  const profiles = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!isYes_(cell_(row, index, F.approved))) continue;

    const name = cleanText_(cell_(row, index, F.publicName));
    const college = cleanText_(cell_(row, index, F.college));
    if (!name || !college) continue;

    const submittedAt = cell_(row, index, F.timestamp);
    const idSource = [
      submittedAt instanceof Date ? submittedAt.getTime() : r,
      name,
      college
    ].join('|');

    const displayEmail = isYes_(cell_(row, index, F.displayEmail));
    const verificationEmail = cleanEmail_(cell_(row, index, F.verificationEmail));

    profiles.push({
      id: 'faculty-' + shortHash_(idSource),
      name: name,
      college: college,
      role: cleanText_(cell_(row, index, F.role)),
      teaches: cleanText_(cell_(row, index, F.teaches)),
      askAbout: cleanText_(cell_(row, index, F.askAbout)),
      interests: splitList_(cell_(row, index, F.interests)),
      bio: cleanText_(cell_(row, index, F.bio)),
      website: safeHttpUrl_(cell_(row, index, F.website)),
      email: displayEmail ? verificationEmail : '',
      openToConnect: isYes_(cell_(row, index, F.connect)),
      openToCollaborate: isYes_(cell_(row, index, F.collaborate)),
      happyToTalkWithNewerFaculty: isYes_(cell_(row, index, F.newerFaculty)),
      curiousAbout: cleanText_(cell_(row, index, F.curious)),
      happilyTalkAbout: cleanText_(cell_(row, index, F.happily)),
      featured: isYes_(cell_(row, index, F.featured))
    });
  }

  profiles.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return profiles;
}

function publicResponse_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getNewestFormResponseSheet_(ss, existingNames) {
  const existing = new Set(existingNames || []);
  const candidates = ss.getSheets().filter(sheet => /^Form Responses/i.test(sheet.getName()) && !existing.has(sheet.getName()));
  if (candidates.length) return candidates[candidates.length - 1];
  const all = ss.getSheets().filter(sheet => /^Form Responses/i.test(sheet.getName()));
  if (!all.length) throw new Error('The Google Form response sheet was not created. Open the spreadsheet and confirm the form destination.');
  return all[all.length - 1];
}

function addModeratorColumns_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  [F.approved, F.featured, F.moderatorNotes, F.lastReviewed].forEach(header => {
    if (!headers.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers.push(header);
    }
  });

  const finalHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  [F.approved, F.featured].forEach(header => {
    const col = finalHeaders.indexOf(header) + 1;
    if (col > 0) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Yes', 'No'], true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
    }
  });
}

function formatSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setWrap(true);
  sheet.getDataRange().setVerticalAlignment('top');
  sheet.autoResizeColumns(1, Math.min(sheet.getLastColumn(), 8));
}

function createSetupSheet_(ss, form, changeForm, responseSheet, changeSheet) {
  let setup = ss.getSheetByName('SETUP');
  if (!setup) setup = ss.insertSheet('SETUP', 0);
  setup.clear();

  const rows = [
    ['LACCD English Faculty Commons', ''],
    ['Public Join the Faculty Commons form', form.getPublishedUrl()],
    ['Edit the Join form', form.getEditUrl()],
    ['Public update/remove request form', changeForm.getPublishedUrl()],
    ['Edit the update/remove form', changeForm.getEditUrl()],
    ['Private moderation spreadsheet', ss.getUrl()],
    ['Profile response tab', responseSheet.getName()],
    ['Change request tab', changeSheet.getName()],
    ['How to publish a profile', 'In the profile response tab, set Approved to Yes. Nothing is returned publicly until you do this.'],
    ['How to hide a profile', 'Set Approved to No or blank. The profile will disappear from the public feed.'],
    ['Email privacy', 'Verification emails are private. The public feed includes an email only when the faculty member explicitly selected Yes to display it publicly.'],
    ['Public-data rule', 'The feed returns only the approved public profile fields. It never returns timestamps, consent text, moderator notes, change requests, or private verification emails.'],
    ['Next step', 'Deploy this Apps Script as a Web app. Execute as Me. Allow Anyone to access it. Then run getSetupInfo() and copy feedUrl, joinUrl, and changeUrl into the site config.js file.'],
    ['Annual maintenance', 'Later, review profiles periodically so the directory does not become stale. Faculty can use the update/remove form at any time.']
  ];

  setup.getRange(1, 1, rows.length, 2).setValues(rows);
  setup.getRange(1, 1, 1, 2).merge().setFontWeight('bold').setFontSize(14);
  setup.setFrozenRows(1);
  setup.setColumnWidth(1, 245);
  setup.setColumnWidth(2, 680);
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

function cleanText_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function splitList_(value) {
  const text = cleanText_(value);
  if (!text) return [];
  return text.split(/\s*,\s*/).map(cleanText_).filter(Boolean);
}

function cleanEmail_(value) {
  const email = cleanText_(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
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
