/* ============================================================
   SCAVENGER HUNT — Runtime Logic
   Uses Web Crypto API for SHA-256 hashing + AES-GCM decryption.
   Constants CODE_HASH, ENCRYPTED_MESSAGE, CODE_LENGTH, IV, SALT
   are injected into index.html at build time.
   ============================================================ */

(function () {
  'use strict';

  // ---- DOM refs ----
  const codeInputContainer = document.getElementById('code-input');
  const statusEl = document.getElementById('status');
  const revealPanel = document.getElementById('reveal-panel');

  let boxes = [];
  let isVerifying = false;

  // ---- Initialize input boxes ----
  function createBoxes() {
    codeInputContainer.innerHTML = '';
    boxes = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'code-box';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'characters');
      input.setAttribute('aria-label', `Character ${i + 1} of ${CODE_LENGTH}`);
      input.dataset.index = i;
      codeInputContainer.appendChild(input);
      boxes.push(input);
    }
    attachEvents();
  }

  // ---- Event handlers ----
  function attachEvents() {
    boxes.forEach((box, i) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length === 1) {
          box.classList.add('filled');
          if (i < boxes.length - 1) {
            boxes[i + 1].focus();
          } else {
            // Last box filled, try verify
            checkAutoVerify();
          }
        } else {
          box.classList.remove('filled');
        }
        clearError();
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          boxes[i - 1].focus();
          boxes[i - 1].value = '';
          boxes[i - 1].classList.remove('filled');
          clearError();
        }
      });

      // Handle paste
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
        for (let j = 0; j < pasted.length && i + j < boxes.length; j++) {
          boxes[i + j].value = pasted[j];
          boxes[i + j].classList.add('filled');
        }
        const nextIndex = Math.min(i + pasted.length, boxes.length - 1);
        boxes[nextIndex].focus();
        checkAutoVerify();
      });
    });
  }

  // ---- Get entered code ----
  function getCode() {
    return boxes.map((b) => b.value).join('');
  }

  // ---- Auto Verify Check ----
  function checkAutoVerify() {
    const code = getCode();
    if (code.length === CODE_LENGTH) {
      verify();
    }
  }

  // ---- Crypto helpers ----



  /**
   * Converts a Base64 string to a Uint8Array.
   * @param {string} b64 - The Base64 string.
   * @returns {Uint8Array} The byte array.
   */
  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function decryptMessage(code) {
    try {
      const salt = base64ToBytes(SALT);
      const iv = base64ToBytes(IV);
      const ciphertext = base64ToBytes(ENCRYPTED_MESSAGE);
      const key = await deriveKey(code, salt);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  // ---- Verify code ----
  async function verify() {
    if (isVerifying) return;
    const code = getCode();

    // Double check length just in case
    if (code.length !== CODE_LENGTH) return;

    isVerifying = true;
    statusEl.textContent = 'DECRYPTING...';
    statusEl.className = 'status';

    // Small delay for dramatic effect
    await new Promise((r) => setTimeout(r, 800));

    const hash = await sha256(code);

    if (hash === CODE_HASH) {
      const message = await decryptMessage(code);
      if (message) {
        showSuccess(message);
      } else {
        showError('DECRYPTION FAILURE');
        triggerShake();
        isVerifying = false;
      }
    } else {
      showError('INVALID SIGNAL');
      triggerShake();
      isVerifying = false;
    }
  }

  // ---- Error handling ----
  function showError(msg) {
    statusEl.textContent = msg;
    statusEl.className = 'status error';
  }

  function clearError() {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }

  function triggerShake() {
    boxes.forEach((b) => {
      b.classList.add('error');
      b.classList.remove('filled');
    });
    setTimeout(() => {
      boxes.forEach((b) => {
        b.classList.remove('error');
        b.value = '';
      });
      boxes[0].focus();
    }, 500);
  }

  // ---- Success handling ----
  function showSuccess(message) {
    // 1. Hide inputs immediately
    codeInputContainer.style.display = 'none';
    statusEl.style.display = 'none';
    const logo = document.querySelector('.brand-logo');
    if (logo) logo.style.display = 'none';

    // 2. Prepare reveal panel
    revealPanel.classList.remove('hidden');
    revealPanel.classList.add('visible');

    // Clear previous content and set up focused terminal
    const contentDiv = revealPanel.querySelector('.reveal-content');
    contentDiv.innerHTML = '';
    contentDiv.className = 'focused-terminal';

    // 3. Run focused sequence
    runFocusedSequence(contentDiv, message);
  }

  /**
   * Orchestrates the focused "hacker" reveal sequence.
   * @param {HTMLElement} container - The container to render lines in.
   * @param {string} finalMessage - The decrypted secret message to reveal.
   */
  async function runFocusedSequence(container, finalMessage) {
    // Sequence of operations
    await processStep(container, 'INITIALIZING UPLINK');
    await processStep(container, 'VERIFYING SECURITY_TOKEN');
    await processStep(container, 'BYPASSING FIREWALL');
    await processStep(container, 'DECRYPTING SECURE_PACKET');
    await processStep(container, 'ACCESS GRANTED', 'success', false); // No delete on last one

    // Clear for final message
    container.innerHTML = '';

    // Final Reveal
    const msgElement = document.createElement('div');
    msgElement.className = 'secret-message-reveal';
    container.appendChild(msgElement);

    await typeText(msgElement, finalMessage, 50);
  }

  /**
   * Processes a single step of the terminal sequence: Type -> Status -> Delete.
   * @param {HTMLElement} container - The container element.
   * @param {string} text - The main text to type.
   * @param {string} type - CSS class for style (e.g., 'normal', 'success').
   * @param {boolean} shouldDelete - Whether to delete the line after completion.
   */
  async function processStep(container, text, type = 'normal', shouldDelete = true) {
    container.innerHTML = '';
    const line = document.createElement('div');
    line.className = `term-line active ${type}`;
    container.appendChild(line);

    // 1. Type out text
    await typeText(line, '> ' + text, 30);

    // 2. Wait a beat
    await wait(400);

    // 3. Append status
    line.innerHTML += ' <span class="status-ok">[OK]</span>';
    await wait(600);

    // 4. Delete if needed
    if (shouldDelete) {
      await deleteText(line, 15);
      await wait(200);
    }
  }

  /**
   * Simulates typing text character by character.
   * @param {HTMLElement} element - The element to type into.
   * @param {string} text - The text to type.
   * @param {number} speed - Milliseconds per character.
   * @returns {Promise<void>}
   */
  function typeText(element, text, speed) {
    return new Promise((resolve) => {
      let i = 0;
      element.textContent = '';

      function type() {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          setTimeout(type, speed);
        } else {
          resolve();
        }
      }
      type();
    });
  }

  /**
   * Simulates deleting text character by character (backspace effect).
   * @param {HTMLElement} element - The element to delete text from.
   * @param {number} speed - Milliseconds per character delete.
   * @returns {Promise<void>}
   */
  function deleteText(element, speed) {
    return new Promise((resolve) => {
      let text = element.textContent;
      function erase() {
        if (text.length > 0) {
          text = text.substring(0, text.length - 1);
          element.textContent = text;
          setTimeout(erase, speed);
        } else {
          resolve();
        }
      }
      erase();
    });
  }

  /**
   * Utility to wait for a specified duration.
   * @param {number} ms - Check milliseconds to wait.
   * @returns {Promise<void>}
   */
  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---- Init ----
  createBoxes();
  if (boxes.length > 0) boxes[0].focus();
})();
