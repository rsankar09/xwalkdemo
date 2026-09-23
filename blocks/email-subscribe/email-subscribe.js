/**
 * Email subscribe (cmp-011): eyebrow, description, a real <form> with an
 * email field, client-side validation and an optional consent checkbox.
 *
 * Markup contract — simple block, so the surfaces differ:
 *
 *   Universal Editor                   Document
 *   block > div > div  (copy)          block > div > div (copy)
 *   block > div > div  (form)                      > div (form)
 *   block > div > div  (consent)                   > div (consent)
 *         3 rows x 1 cell                    1 row x 3 cells
 *
 * Cells are classified by content: the form cell is the one carrying the
 * endpoint link. Of the remaining cells the first is the copy and the second,
 * if present, is the consent label.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let instanceCount = 0;

/**
 * Builds the visually hidden label + email input + submit button.
 * @param {string} placeholder Placeholder text for the input
 * @param {string} buttonLabel Accessible name for the submit button
 * @param {string} id Unique id fragment for label/input association
 * @returns {{field: Element, input: HTMLInputElement}} the field wrapper and input
 */
function createField(placeholder, buttonLabel, id) {
  const field = document.createElement('div');
  field.className = 'email-subscribe-field';

  const label = document.createElement('label');
  label.className = 'email-subscribe-label';
  label.setAttribute('for', id);
  label.textContent = placeholder;

  const input = document.createElement('input');
  input.type = 'email';
  input.id = id;
  input.name = 'email';
  input.required = true;
  input.autocomplete = 'email';
  input.placeholder = placeholder;
  input.setAttribute('aria-describedby', `${id}-status`);

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'email-subscribe-submit';
  button.setAttribute('aria-label', buttonLabel);
  // the source marks the submit affordance with a bare chevron, not an arrow
  button.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M6.5 3 13 9l-6.5 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  field.append(label, input, button);
  return { field, input };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  instanceCount += 1;
  const id = `email-subscribe-${instanceCount}`;

  const cells = [...block.querySelectorAll(':scope > div > div')];
  let endpoint = '';
  let buttonLabel = 'Subscribe';
  let placeholder = 'Email address';
  const contentCells = [];
  let formCell = null;

  cells.forEach((cell) => {
    const anchor = cell.querySelector('a[href]');
    const text = cell.textContent.trim();
    if (anchor) {
      // the form cell: the link carries the endpoint and the button label,
      // any remaining text in the cell is the input placeholder
      formCell = cell;
      endpoint = anchor.getAttribute('href');
      if (anchor.textContent.trim()) buttonLabel = anchor.textContent.trim();
      const rest = text.replace(anchor.textContent, '').trim();
      if (rest) placeholder = rest;
    } else if (text) {
      contentCells.push(cell);
    }
  });

  const [copyCell, consentCell] = contentCells;

  const form = document.createElement('form');
  form.className = 'email-subscribe-form';
  form.noValidate = true;

  if (copyCell) {
    copyCell.classList.add('email-subscribe-copy');
    // the opening line is the eyebrow
    const first = copyCell.firstElementChild;
    if (first && copyCell.children.length > 1) {
      first.classList.add('email-subscribe-eyebrow');
    }
  }

  const { field, input } = createField(placeholder, buttonLabel, id);
  // the form cell is consumed into the generated field (its link supplied the
  // endpoint and button label) and never re-appended, so carry its
  // instrumentation across or the endpoint field stops being editable
  if (formCell) moveInstrumentation(formCell, field);

  let consentInput = null;
  if (consentCell) {
    const consent = document.createElement('div');
    consent.className = 'email-subscribe-consent';
    consentInput = document.createElement('input');
    consentInput.type = 'checkbox';
    consentInput.id = `${id}-consent`;
    consentInput.required = true;
    consentInput.setAttribute('aria-describedby', `${id}-status`);
    const consentLabel = document.createElement('label');
    consentLabel.setAttribute('for', `${id}-consent`);
    moveInstrumentation(consentCell, consentLabel);
    /*
     * The authored cell wraps its text in a <p>. <label> takes phrasing
     * content only, so unwrap it — flow content here makes both the clickable
     * region and the accessible-name computation UA-dependent.
     */
    [...consentCell.childNodes].forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'P') {
        consentLabel.append(...node.childNodes);
      } else {
        consentLabel.append(node);
      }
    });
    consent.append(consentInput, consentLabel);
    form.append(consent);
    consentCell.remove();
  }

  const status = document.createElement('p');
  status.className = 'email-subscribe-status';
  status.id = `${id}-status`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  form.prepend(field);
  form.append(status);

  /**
   * Shows a validation or submission message.
   * @param {string} message Text to announce
   * @param {boolean} invalid Whether this represents an error
   */
  const setStatus = (message, invalid, control = input) => {
    status.textContent = message;
    status.classList.toggle('email-subscribe-status-error', invalid);
    /*
     * Mark only the control that actually failed. Flagging the email field on
     * a consent error tells the user the wrong input is broken.
     */
    [input, consentInput].forEach((el) => {
      if (el) el.setAttribute('aria-invalid', invalid && el === control ? 'true' : 'false');
    });
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = input.value.trim();

    if (!EMAIL_PATTERN.test(value)) {
      setStatus('Enter a valid email address.', true);
      input.focus();
      return;
    }
    if (consentInput && !consentInput.checked) {
      setStatus('Please accept the terms to continue.', true, consentInput);
      consentInput.focus();
      return;
    }

    if (!endpoint) {
      // Deliberately not guessing a URL — the subscription endpoint is an
      // open question for the NYL team. Until it is configured the form
      // validates and announces, but does not transmit.
      setStatus('Subscription is not configured yet.', true);
      return;
    }

    setStatus('Submitting…', false);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: value,
          consent: consentInput ? consentInput.checked : undefined,
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      setStatus('Thanks — please check your inbox to confirm.', false);
      form.reset();
    } catch (error) {
      setStatus('Something went wrong. Please try again.', true);
    }
  });

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') setStatus('', false);
  });

  block.replaceChildren(...(copyCell ? [copyCell] : []), form);
}
