document.querySelectorAll('.copy-button').forEach(function (button) {
      button.addEventListener('click', async function () {
        const number = button.getAttribute('data-class-number');
        const status = document.getElementById(button.getAttribute('aria-describedby'));
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(number);
          } else {
            const input = document.createElement('textarea');
            input.value = number;
            input.setAttribute('readonly', '');
            input.className = 'clipboard-fallback-input';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
          }
          status.textContent = 'Class number ' + number + ' copied.';
        } catch (error) {
          status.textContent = 'Copy did not work. Select and copy ' + number + ' manually.';
        }
      });
    });
