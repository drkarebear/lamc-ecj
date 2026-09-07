(function () {
  'use strict';

  const TZ = 'America/Los_Angeles';
  const cfg = window.LACCD_ENGLISH_EVENTS || {};
  const lists = Array.from(document.querySelectorAll('[data-events-list]'));
  const submitLinks = Array.from(document.querySelectorAll('[data-event-submit-link]'));
  const filterForm = document.querySelector('[data-event-filters]');

  submitLinks.forEach(link => {
    if (cfg.submitUrl) {
      link.href = cfg.submitUrl;
      link.hidden = false;
    } else if (link.dataset.hideWhenUnconfigured === 'true') {
      link.hidden = true;
    } else {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.classList.add('is-disabled');
    }
  });

  if (!lists.length) return;

  let allEvents = [];

  window.LACCDEnglishEventsReceive = function (payload) {
    try {
      allEvents = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.events) ? payload.events : []);
      allEvents = allEvents.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
      populateFilters(allEvents);
      updateFilterVisibility();
      renderAll();
    } catch (error) {
      renderError();
    }
  };

  if (!cfg.feedUrl) {
    lists.forEach(list => renderUnconfigured(list));
    return;
  }

  const script = document.createElement('script');
  const separator = cfg.feedUrl.includes('?') ? '&' : '?';
  script.src = cfg.feedUrl + separator + 'action=events&callback=LACCDEnglishEventsReceive&_=' + Date.now();
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.onerror = renderError;
  document.head.appendChild(script);

  document.querySelectorAll('[data-event-filter]').forEach(control => {
    control.addEventListener('input', renderAll);
    control.addEventListener('change', renderAll);
  });

  const reset = document.querySelector('[data-event-filter-reset]');
  if (reset) {
    reset.addEventListener('click', function () {
      document.querySelectorAll('[data-event-filter]').forEach(control => {
        if (control.tagName === 'SELECT') control.value = '';
        else control.value = '';
      });
      renderAll();
    });
  }

  function updateFilterVisibility() {
    if (!filterForm) return;
    // Keep the interface simple until there are enough events to make filtering useful.
    filterForm.hidden = allEvents.length <= 5;
    if (filterForm.hidden) {
      filterForm.querySelectorAll('[data-event-filter]').forEach(control => { control.value = ''; });
    }
  }

  function renderAll() {
    const filtered = getFilteredEvents();
    lists.forEach(list => {
      const limit = Number(list.dataset.limit || 0);
      const events = limit > 0 ? filtered.slice(0, limit) : filtered;
      renderList(list, events, filtered.length);
    });
    const count = document.querySelector('[data-event-count]');
    if (count) {
      count.textContent = filtered.length === 1 ? '1 upcoming event' : filtered.length + ' upcoming events';
    }
  }

  function getFilteredEvents() {
    const college = valueOf('#event-college-filter');
    const type = valueOf('#event-type-filter');
    const search = valueOf('#event-search').toLowerCase();

    return allEvents.filter(event => {
      if (college && event.college !== college) return false;
      if (type && event.type !== type) return false;
      if (search) {
        const haystack = [event.title, event.college, event.type, event.format, event.description, event.location, event.sponsor, event.audience]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function renderList(list, events, totalFiltered) {
    list.replaceChildren();

    if (!events.length) {
      const box = el('div', 'event-empty');
      const heading = el('h3', '', totalFiltered === 0 && allEvents.length ? 'No events match those filters.' : 'No approved upcoming events are posted yet.');
      const text = el('p', '', totalFiltered === 0 && allEvents.length
        ? 'Try a different college, event type, or search term.'
        : 'Have something happening? Send it our way and it can appear here after review.');
      box.append(heading, text);
      if (cfg.submitUrl) {
        const link = el('a', 'button secondary', 'Share an Event');
        link.href = cfg.submitUrl;
        box.append(link);
      }
      list.append(box);
      return;
    }

    events.forEach(event => list.append(buildEventCard(event)));
  }

  function buildEventCard(event) {
    const article = el('article', 'event-card');
    article.dataset.eventId = event.id || '';

    const dateBox = el('div', 'event-date');
    dateBox.setAttribute('aria-hidden', 'true');
    const start = new Date(event.start);
    const month = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short' }).format(start).toUpperCase();
    const day = new Intl.DateTimeFormat('en-US', { timeZone: TZ, day: '2-digit' }).format(start);
    dateBox.append(el('span', 'event-month', month), el('span', 'event-day', day));

    const content = el('div', 'event-content');
    const metaTop = el('p', 'event-kicker', [event.college, event.type].filter(Boolean).join(' · '));
    const title = el('h3', '', event.title || 'Untitled event');
    const when = el('time', 'event-when', formatWhen(event));
    when.dateTime = event.start || '';
    const description = el('p', 'event-description', event.description || '');

    content.append(metaTop, title, when);

    if (event.format || event.location) {
      const where = el('p', 'event-where');
      const bits = [event.format, event.location].filter(Boolean);
      where.append(strong('Where: '), document.createTextNode(bits.join(' · ')));
      content.append(where);
    }

    if (event.sponsor) {
      const sponsor = el('p', 'event-sponsor');
      sponsor.append(strong('Hosted by: '), document.createTextNode(event.sponsor));
      content.append(sponsor);
    }

    content.append(description);

    if (event.audience) {
      const audience = el('p', 'event-audience');
      audience.append(strong('For: '), document.createTextNode(event.audience));
      content.append(audience);
    }

    if (event.accessibility) {
      const access = el('p', 'event-accessibility');
      access.append(strong('Accessibility: '), document.createTextNode(event.accessibility));
      content.append(access);
    }

    const actions = el('div', 'event-actions');

    if (event.url) {
      const details = el('a', 'event-action-link', 'View details for ' + (event.title || 'this event'));
      details.href = event.url;
      details.target = '_blank';
      details.rel = 'noopener noreferrer';
      actions.append(details);
    }

    const google = el('a', 'event-action-link', 'Add to Google Calendar');
    google.setAttribute('aria-label', 'Add ' + (event.title || 'this event') + ' to Google Calendar');
    google.href = googleCalendarUrl(event);
    google.target = '_blank';
    google.rel = 'noopener noreferrer';
    actions.append(google);

    const ics = el('button', 'event-action-button', 'Download .ics');
    ics.setAttribute('aria-label', 'Download ' + (event.title || 'this event') + ' as a calendar file (.ics)');
    ics.type = 'button';
    ics.addEventListener('click', function () { downloadIcs(event); });
    actions.append(ics);

    content.append(actions);
    article.append(dateBox, content);
    return article;
  }

  function formatWhen(event) {
    const start = new Date(event.start);
    const end = new Date(event.end);

    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    if (event.allDay) return dateFmt.format(start);

    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      minute: '2-digit'
    });

    const sameDate = localDateKey(start) === localDateKey(end);
    if (sameDate) return dateFmt.format(start) + ', ' + timeFmt.format(start) + ' to ' + timeFmt.format(end);

    return dateFmt.format(start) + ', ' + timeFmt.format(start) + ' to ' + dateFmt.format(end) + ', ' + timeFmt.format(end);
  }

  function populateFilters(events) {
    populateSelect('#event-college-filter', unique(events.map(e => e.college).filter(Boolean)));
    populateSelect('#event-type-filter', unique(events.map(e => e.type).filter(Boolean)));
  }

  function populateSelect(selector, values) {
    const select = document.querySelector(selector);
    if (!select) return;
    const current = select.value;
    const first = select.options[0] ? select.options[0].cloneNode(true) : new Option('All', '');
    select.replaceChildren(first);
    values.sort((a, b) => a.localeCompare(b)).forEach(value => select.add(new Option(value, value)));
    if (values.includes(current)) select.value = current;
  }

  function googleCalendarUrl(event) {
    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', event.title || 'LACCD English event');
    params.set('dates', calendarDates(event));
    if (event.description) params.set('details', event.description + (event.url ? '\n\n' + event.url : ''));
    if (event.location) params.set('location', event.location);
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  function calendarDates(event) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (event.allDay) {
      const startDate = localDateKey(start).replace(/-/g, '');
      const next = new Date(end.getTime() + 1000);
      const endDate = localDateKey(next).replace(/-/g, '');
      return startDate + '/' + endDate;
    }
    return utcStamp(start) + '/' + utcStamp(end);
  }

  function downloadIcs(event) {
    const now = utcStamp(new Date());
    const start = new Date(event.start);
    const end = new Date(event.end);
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LACCD English DDC//Events//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + icsEscape((event.id || 'event') + '@laccd-english-ddc'),
      'DTSTAMP:' + now
    ];

    if (event.allDay) {
      const startDate = localDateKey(start).replace(/-/g, '');
      const next = new Date(end.getTime() + 1000);
      const endDate = localDateKey(next).replace(/-/g, '');
      lines.push('DTSTART;VALUE=DATE:' + startDate, 'DTEND;VALUE=DATE:' + endDate);
    } else {
      lines.push('DTSTART:' + utcStamp(start), 'DTEND:' + utcStamp(end));
    }

    lines.push('SUMMARY:' + icsEscape(event.title || 'LACCD English event'));
    if (event.description) lines.push('DESCRIPTION:' + icsEscape(event.description + (event.url ? '\n\n' + event.url : '')));
    if (event.location) lines.push('LOCATION:' + icsEscape(event.location));
    if (event.url) lines.push('URL:' + icsEscape(event.url));
    lines.push('END:VEVENT', 'END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slug(event.title || 'laccd-english-event') + '.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderUnconfigured(list) {
    list.replaceChildren();
    const box = el('div', 'event-empty');
    box.append(
      el('h3', '', 'The event feed is ready to connect.'),
      el('p', '', 'Run the included Google Apps Script setup, approve events in the private Sheet, and paste the two generated URLs into config.js. No events publish until you approve them.')
    );
    list.append(box);
  }

  function renderError() {
    lists.forEach(list => {
      list.replaceChildren();
      const box = el('div', 'event-empty');
      box.append(el('h3', '', 'Events are temporarily unavailable.'), el('p', '', 'The rest of the site still works. Please try again later.'));
      list.append(box);
    });
  }

  function valueOf(selector) {
    const node = document.querySelector(selector);
    return node ? String(node.value || '').trim() : '';
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  function localDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const map = {};
    parts.forEach(part => { map[part.type] = part.value; });
    return map.year + '-' + map.month + '-' + map.day;
  }

  function utcStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  function icsEscape(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function slug(value) {
    return String(value || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'event';
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function strong(text) {
    const node = document.createElement('strong');
    node.textContent = text;
    return node;
  }
})();
