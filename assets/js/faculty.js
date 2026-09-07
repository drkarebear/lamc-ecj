(function () {
  'use strict';

  const cfg = window.LACCD_ENGLISH_FACULTY || {};
  const list = document.querySelector('[data-faculty-list]');
  const count = document.querySelector('[data-faculty-count]');
  const controls = document.querySelector('[data-faculty-controls]');
  const joinLinks = Array.from(document.querySelectorAll('[data-faculty-join-link]'));
  const changeLinks = Array.from(document.querySelectorAll('[data-faculty-change-link]'));
  let profiles = [];

  configureLinks(joinLinks, cfg.joinUrl);
  configureLinks(changeLinks, cfg.changeUrl);

  if (!list) return;

  window.LACCDEnglishFacultyReceive = function (payload) {
    try {
      profiles = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.profiles) ? payload.profiles : []);
      profiles = profiles.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
      populateFilters();
      if (controls) controls.hidden = profiles.length < 6;
      render();
    } catch (error) {
      renderError();
    }
  };

  if (!cfg.feedUrl) {
    renderUnconfigured();
    return;
  }

  const script = document.createElement('script');
  const separator = cfg.feedUrl.includes('?') ? '&' : '?';
  script.src = cfg.feedUrl + separator + 'action=faculty&callback=LACCDEnglishFacultyReceive&_=' + Date.now();
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.onerror = renderError;
  document.head.appendChild(script);

  document.querySelectorAll('[data-faculty-filter]').forEach(control => {
    control.addEventListener('input', render);
    control.addEventListener('change', render);
  });

  const reset = document.querySelector('[data-faculty-reset]');
  if (reset) {
    reset.addEventListener('click', function () {
      document.querySelectorAll('[data-faculty-filter]').forEach(control => { control.value = ''; });
      render();
    });
  }

  function configureLinks(links, url) {
    links.forEach(link => {
      if (url) {
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.removeAttribute('aria-disabled');
        link.classList.remove('is-disabled');
      } else {
        link.removeAttribute('href');
        link.removeAttribute('target');
        link.setAttribute('aria-disabled', 'true');
        link.classList.add('is-disabled');
      }
    });
  }

  function populateFilters() {
    populateSelect('#faculty-college-filter', unique(profiles.map(p => p.college).filter(Boolean)), 'All colleges');
    const interests = [];
    profiles.forEach(profile => (profile.interests || []).forEach(item => interests.push(item)));
    populateSelect('#faculty-interest-filter', unique(interests), 'All interests');
  }

  function populateSelect(selector, values, firstLabel) {
    const select = document.querySelector(selector);
    if (!select) return;
    const current = select.value;
    select.replaceChildren(new Option(firstLabel, ''));
    values.sort((a, b) => a.localeCompare(b)).forEach(value => select.add(new Option(value, value)));
    if (values.includes(current)) select.value = current;
  }

  function render() {
    const filtered = getFiltered();
    list.replaceChildren();

    if (count) count.textContent = filtered.length === 1 ? '1 faculty profile' : filtered.length + ' faculty profiles';

    if (!filtered.length) {
      const box = el('div', 'faculty-empty');
      const hasProfiles = profiles.length > 0;
      box.append(
        el('h3', '', hasProfiles ? 'No profiles match those filters.' : 'The Commons is pulling up chairs.'),
        el('p', '', hasProfiles ? 'Try a different college, interest, connection option, or search term.' : 'No approved public profiles are posted yet. Faculty can opt in through the Join the Faculty Commons form.')
      );
      if (!hasProfiles && cfg.joinUrl) {
        const a = el('a', 'button secondary', 'Join the Faculty Commons');
        a.href = cfg.joinUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        box.append(a);
      }
      list.append(box);
      return;
    }

    filtered.forEach(profile => list.append(buildCard(profile)));
  }

  function getFiltered() {
    const search = value('#faculty-search').toLowerCase();
    const college = value('#faculty-college-filter');
    const interest = value('#faculty-interest-filter');
    const connection = value('#faculty-connection-filter');

    return profiles.filter(profile => {
      if (college && profile.college !== college) return false;
      if (interest && !(profile.interests || []).includes(interest)) return false;
      if (connection === 'connect' && !profile.openToConnect) return false;
      if (connection === 'collaborate' && !profile.openToCollaborate) return false;
      if (connection === 'newer' && !profile.happyToTalkWithNewerFaculty) return false;
      if (search) {
        const haystack = [
          profile.name, profile.college, profile.role, profile.teaches, profile.askAbout,
          profile.bio, profile.curiousAbout, profile.happilyTalkAbout,
          ...(profile.interests || [])
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function buildCard(profile) {
    const article = el('article', 'faculty-card');
    article.dataset.facultyId = profile.id || '';

    article.append(el('p', 'college-label', profile.college || 'LACCD English'));
    article.append(el('h3', '', profile.name || 'Faculty colleague'));
    if (profile.role) article.append(el('p', 'faculty-role', profile.role));

    if (profile.bio) article.append(block('About', profile.bio));
    if (profile.teaches) article.append(block('Teaches', profile.teaches));
    if (profile.askAbout) article.append(block('Ask me about', profile.askAbout));

    if (Array.isArray(profile.interests) && profile.interests.length) {
      const wrap = el('div', 'faculty-block');
      wrap.append(el('h4', '', 'Interests'));
      const ul = el('ul', 'faculty-interest-list');
      profile.interests.forEach(item => ul.append(el('li', '', item)));
      wrap.append(ul);
      article.append(wrap);
    }

    const connections = [];
    if (profile.openToConnect) connections.push('Open to connecting');
    if (profile.openToCollaborate) connections.push('Open to collaboration');
    if (profile.happyToTalkWithNewerFaculty) connections.push('Happy to talk with newer faculty');
    if (connections.length) {
      const ul = el('ul', 'faculty-connection-list');
      ul.setAttribute('aria-label', 'Connection preferences');
      connections.forEach(item => ul.append(el('li', '', item)));
      article.append(ul);
    }

    if (profile.curiousAbout) article.append(block('Currently curious about', profile.curiousAbout));
    if (profile.happilyTalkAbout) article.append(el('p', 'faculty-human-note', 'Will happily talk about: ' + profile.happilyTalkAbout));

    const actions = el('div', 'faculty-card-actions');
    if (profile.email) {
      const email = el('a', '', 'Email ' + firstName(profile.name));
      email.href = 'mailto:' + profile.email;
      actions.append(email);
    }
    if (profile.website) {
      const site = el('a', '', 'Professional page');
      site.href = profile.website;
      site.target = '_blank';
      site.rel = 'noopener noreferrer';
      actions.append(site);
    }
    if (actions.childNodes.length) article.append(actions);

    return article;
  }

  function block(label, text) {
    const wrap = el('div', 'faculty-block');
    wrap.append(el('h4', '', label), el('p', '', text));
    return wrap;
  }

  function renderUnconfigured() {
    list.replaceChildren();
    const box = el('div', 'faculty-empty');
    box.append(
      el('h3', '', 'The Faculty Commons is ready to connect.'),
      el('p', '', 'Run the included Faculty Commons Google Apps Script setup, deploy the read-only feed, and add its three generated URLs to config.js. No profile publishes until Karen marks it Approved in the private Sheet.')
    );
    list.append(box);
    if (count) count.textContent = 'Directory setup in progress';
    if (controls) controls.hidden = true;
  }

  function renderError() {
    list.replaceChildren();
    const box = el('div', 'faculty-error');
    box.append(
      el('h3', '', 'Faculty profiles are temporarily unavailable.'),
      el('p', '', 'The rest of the site still works. Please try the directory again later.')
    );
    list.append(box);
    if (count) count.textContent = 'Directory temporarily unavailable';
    if (controls) controls.hidden = true;
  }

  function value(selector) {
    const node = document.querySelector(selector);
    return node ? String(node.value || '').trim() : '';
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  function firstName(name) {
    const clean = String(name || 'faculty colleague').trim();
    const first = clean.split(/\s+/)[0];
    return first || 'faculty colleague';
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }
})();
