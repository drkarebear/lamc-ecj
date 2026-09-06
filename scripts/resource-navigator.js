(function () {
      const button = document.getElementById('load-support-guide');
      const consent = document.getElementById('support-guide-consent');
      const container = document.getElementById('support-guide-container');

      if (!button || !consent || !container) return;

      button.addEventListener('click', function () {
        const frame = document.createElement('iframe');
        frame.className = 'navigator-frame';
        frame.src = 'https://www.playlab.ai/embedded/cmtev8j2m0y0ckn0w3zzazmw5';
        frame.title = 'Interactive support guide for finding Los Angeles Mission College student resources';
        frame.referrerPolicy = 'no-referrer';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

        consent.hidden = true;
        container.appendChild(frame);
        frame.focus();
      }, { once: true });
    }());
