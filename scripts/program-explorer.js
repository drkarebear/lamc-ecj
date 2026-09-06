(function () {
      const button = document.getElementById('load-program-finder');
      const consent = document.getElementById('program-finder-consent');
      const container = document.getElementById('program-finder-container');

      if (!button || !consent || !container) return;

      button.addEventListener('click', function () {
        const frame = document.createElement('iframe');
        frame.className = 'explorer-frame';
        frame.src = 'https://www.playlab.ai/embedded/cmtezps40124lov0w08d7ssil';
        frame.title = 'Interactive program finder for ECJ degrees and certificates at Los Angeles Mission College';
        frame.referrerPolicy = 'no-referrer';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

        consent.hidden = true;
        container.appendChild(frame);
        frame.focus();
      }, { once: true });
    }());
