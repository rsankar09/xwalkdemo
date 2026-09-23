/*
 * Form (cmp-p10) — a generic, definition-driven form block.
 *
 * The source component is a 62KB AEM Adaptive Form (lead capture: name, email,
 * phone, address, date of birth, marketing opt-in). Rather than port that
 * field list into code, this block renders whatever a JSON *form definition*
 * describes. The authored block holds only the path to that definition, so the
 * same block serves every form on the site and a field change is a content
 * change, not a deploy.
 *
 * ---------------------------------------------------------------------------
 * UNRESOLVED — REQUIRES HUMAN SIGN-OFF BEFORE THIS HANDLES A REAL LEAD
 * ---------------------------------------------------------------------------
 * 1. SUBMIT ENDPOINT. There is no approved destination for this data. The
 *    sample definition at /forms/group-term-life.json ships with an EMPTY
 *    `action` and therefore POSTS NOWHERE: the form validates, announces, and
 *    stops. Do not invent a URL — the original posted into the AEM Adaptive
 *    Forms servlet, which does not exist on Edge Delivery.
 * 2. PII HANDLING. Every field here is personal data (name, email, phone,
 *    postal address, date of birth). Retention, encryption in transit and at
 *    rest, the processor agreement, and CCPA/GDPR subject-access all need an
 *    owner. This block deliberately never logs a value, never places one in a
 *    URL, and refuses any non-POST method (see submitDefinition).
 * 3. CONSENT CAPTURE. The opt-in checkbox is transmitted as an explicit
 *    true/false, but nothing here records consent *version*, timestamp, or
 *    source — which is what an audit actually asks for.
 * 4. SPAM PROTECTION. None. No honeypot, no timing check, no CAPTCHA. Adding
 *    one changes the accessibility and privacy posture, so it is a decision,
 *    not a default.
 * 5. ADDRESS AUTOCOMPLETE. The source pulled in Google Places. Not integrated
 *    here — see the extension point marked GOOGLE PLACES below.
 *
 * ---------------------------------------------------------------------------
 * Markup contract — simple block, so the surfaces differ:
 *
 *   Universal Editor                   Document
 *   block > div > div  (copy)          block > div > div (copy)
 *   block > div > div  (definition)                > div (definition)
 *         2 rows x 1 cell                    1 row x 2 cells
 *
 * Cells are classified by content, never by position: the definition cell is
 * the one holding a path (`/forms/group-term-life.json`) or a link to one. Any
 * other non-empty cell is the intro copy.
 *
 * The fetched definition is treated as UNTRUSTED INPUT. Every string it
 * supplies reaches the DOM through textContent or a property assignment, never
 * through innerHTML. If a future definition genuinely needs rich text, route it
 * through the vendored scripts/dompurify.min.js — do not relax this.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

/* Field types this block knows how to render. Anything else is ignored. */
const NATIVE_INPUT_TYPES = ['text', 'email', 'tel', 'number', 'date', 'url', 'search'];

/* Layout widths a definition may request. Unknown values fall back to full. */
const WIDTHS = ['full', 'half', 'third', 'quarter'];

/*
 * ValidityState flags, in the order we report them. The first one that trips
 * wins, so a missing value is reported as missing rather than as a pattern
 * mismatch.
 */
const VALIDITY_KEYS = [
  'valueMissing',
  'typeMismatch',
  'patternMismatch',
  'tooShort',
  'tooLong',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
  'badInput',
];

const DEFAULTS = {
  submitLabel: 'Submit',
  requiredNote: '*Required',
  requiredIndicator: '*',
  errorSummaryTitle: 'Please correct the following before continuing.',
  submittingMessage: 'Submitting…',
  successMessage: 'Thank you. We have received your details.',
  errorMessage: 'Something went wrong. Please try again.',
  unconfiguredMessage: 'This form is not connected to a destination yet.',
};

let instanceCount = 0;

/**
 * Coerces an untrusted value to a trimmed string.
 * Definitions are fetched JSON, so any field may be a number, object or null.
 * @param {*} value Value from the definition
 * @returns {string} the value as a trimmed string, or '' if it was not a string
 */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Turns an arbitrary definition-supplied name into a safe id fragment.
 * @param {string} value Raw name
 * @param {number} index Position, used when the name is unusable
 * @returns {string} an id fragment matching [a-z0-9-]
 */
function toIdPart(value, index) {
  const slug = text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `field-${index}`;
}

/**
 * Validates a definition path before fetching it.
 *
 * Same-origin, absolute-from-root paths only. A definition is allowed to build
 * a form that collects a date of birth, so it is not something an author should
 * be able to pull off an arbitrary third-party host.
 * @param {string} path Authored path
 * @returns {string} the path, or '' if it is not acceptable
 */
function safeDefinitionPath(path) {
  const value = text(path);
  if (!value.startsWith('/') || value.startsWith('//')) return '';
  return value;
}

/**
 * Validates a navigation target supplied by the definition.
 * Blocks `javascript:` and off-site redirects, and refuses anything carrying a
 * query string so submitted values can never be appended to a thank-you URL.
 * @param {string} target Redirect path from the definition
 * @returns {string} the path, or '' if it is not acceptable
 */
function safeRedirect(target) {
  const value = text(target);
  if (!value.startsWith('/') || value.startsWith('//')) return '';
  if (value.includes('?')) return '';
  return value;
}

/**
 * Reads the authored cells: the definition path and the optional intro copy.
 * @param {Element} block The block element
 * @returns {{path: string, pathCell: Element|null, copyCell: Element|null}} the parts
 */
function readBlock(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  let path = '';
  let pathCell = null;
  let copyCell = null;

  cells.forEach((cell) => {
    const anchor = cell.querySelector('a[href]');
    const value = anchor ? anchor.getAttribute('href') : cell.textContent.trim();
    if (!pathCell && value.startsWith('/')) {
      pathCell = cell;
      path = value;
    } else if (!copyCell && cell.textContent.trim()) {
      copyCell = cell;
    }
  });

  return { path, pathCell, copyCell };
}

/**
 * Fetches and parses a form definition.
 * @param {string} path Same-origin path to the definition JSON
 * @returns {Promise<object|null>} the parsed definition, or null on any failure
 */
async function loadDefinition(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' ? json : null;
  } catch (error) {
    // Swallowed on purpose: a broken definition must not take the page down,
    // and the failure is surfaced in the UI rather than in the console.
    return null;
  }
}

/**
 * Picks the message for the first constraint a control violates.
 * Native constraint validation does the checking; the definition only supplies
 * friendlier wording. No hand-rolled validation logic lives here.
 * @param {HTMLElement} control The invalid control
 * @param {object} messages Per-constraint overrides from the definition
 * @returns {string} the message to display
 */
function messageFor(control, messages) {
  const key = VALIDITY_KEYS.find((name) => control.validity[name]);
  const override = key && messages ? text(messages[key]) : '';
  return override || control.validationMessage || 'This field is not valid.';
}

/**
 * Applies the native constraint attributes a definition may declare.
 * `required`, `type` and `pattern` are the whole validation engine.
 * @param {HTMLElement} control The control to constrain
 * @param {object} field The field definition
 */
function applyConstraints(control, field) {
  if (field.required === true) control.required = true;
  const pattern = text(field.pattern);
  if (pattern && 'pattern' in control) control.pattern = pattern;
  if (Number.isFinite(field.minLength)) control.minLength = field.minLength;
  if (Number.isFinite(field.maxLength)) control.maxLength = field.maxLength;
  if (typeof field.min === 'number' || text(field.min)) control.min = field.min;
  if (typeof field.max === 'number' || text(field.max)) control.max = field.max;
  if (text(field.step)) control.step = field.step;
}

/**
 * Builds the control element for one field definition.
 * @param {object} field The field definition
 * @param {string} id The id to assign
 * @returns {HTMLElement|null} the control, or null for an unsupported type
 */
function createControl(field, id) {
  const type = text(field.type) || 'text';
  let control;

  if (type === 'select') {
    control = document.createElement('select');
    const options = Array.isArray(field.options) ? field.options : [];
    if (text(field.placeholder)) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = text(field.placeholder);
      control.append(empty);
    }
    options.forEach((option) => {
      const element = document.createElement('option');
      // option shape is { label, value }; a bare string is both
      element.value = typeof option === 'string' ? option : text(option.value);
      element.textContent = typeof option === 'string' ? option : text(option.label) || element.value;
      control.append(element);
    });
  } else if (type === 'textarea') {
    control = document.createElement('textarea');
    if (Number.isFinite(field.rows)) control.rows = field.rows;
    if (text(field.placeholder)) control.placeholder = text(field.placeholder);
  } else if (type === 'checkbox') {
    control = document.createElement('input');
    control.type = 'checkbox';
    // an explicit "true" so the receiving system never has to infer consent
    // from the absence of a key
    control.value = 'true';
  } else if (NATIVE_INPUT_TYPES.includes(type)) {
    control = document.createElement('input');
    control.type = type;
    if (text(field.placeholder)) control.placeholder = text(field.placeholder);
  } else {
    return null;
  }

  control.id = id;
  control.name = text(field.name) || id;
  if (text(field.autocomplete)) control.autocomplete = text(field.autocomplete);
  if (text(field.inputMode)) control.inputMode = text(field.inputMode);
  applyConstraints(control, field);
  return control;
}

/**
 * Builds the label for a field, with a visible required indicator.
 *
 * The indicator is a real character in the accessible name, not a CSS
 * ::after — generated content is not reliably announced, and `required` alone
 * gives a sighted user nothing to scan for.
 * @param {object} field The field definition
 * @param {string} id The control id to associate with
 * @param {string} indicator The required marker, e.g. '*'
 * @returns {HTMLLabelElement} the label
 */
function createLabel(field, id, indicator) {
  const label = document.createElement('label');
  label.className = 'form-label';
  label.setAttribute('for', id);
  label.textContent = text(field.label) || text(field.name);
  if (field.required === true && indicator) {
    const mark = document.createElement('span');
    mark.className = 'form-required';
    mark.textContent = indicator;
    label.append(mark);
  }
  return label;
}

/**
 * Builds one field: wrapper, label, control, help text and error slot.
 * @param {object} field The field definition
 * @param {string} idBase Unique prefix for this block instance
 * @param {number} index Position, used for id fallback
 * @param {string} indicator The required marker
 * @returns {{wrapper: Element, control: HTMLElement, field: object}|null} the entry
 */
function createField(field, idBase, index, indicator) {
  const id = `${idBase}-${toIdPart(field.name, index)}`;
  const control = createControl(field, id);
  if (!control) return null;

  const type = text(field.type) || 'text';
  const wrapper = document.createElement('div');
  const width = WIDTHS.includes(text(field.width)) ? text(field.width) : 'full';
  wrapper.className = `form-field form-field-${type} form-field-${width}`;

  const label = createLabel(field, id, indicator);
  const describedBy = [];

  let help = null;
  const helpText = text(field.help);
  if (helpText) {
    help = document.createElement('p');
    help.className = 'form-help';
    help.id = `${id}-help`;
    help.textContent = helpText;
    describedBy.push(help.id);
  }

  const error = document.createElement('p');
  error.className = 'form-error';
  error.id = `${id}-error`;
  error.hidden = true;
  describedBy.push(error.id);

  control.setAttribute('aria-describedby', describedBy.join(' '));

  if (type === 'checkbox') {
    // control before label so the box sits to the left of its text
    wrapper.append(control, label);
  } else {
    wrapper.append(label, control);
  }
  if (help) wrapper.append(help);
  wrapper.append(error);

  return { wrapper, control, field };
}

/**
 * Builds a fieldset and recurses into its child fields.
 * @param {object} group The fieldset definition
 * @param {string} idBase Unique prefix for this block instance
 * @param {number} index Position, used for id fallback
 * @param {string} indicator The required marker
 * @param {Array} entries Accumulator the child entries are pushed onto
 * @returns {Element} the fieldset element
 */
function createFieldset(group, idBase, index, indicator, entries) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'form-fieldset';

  /* a fieldset with an empty legend is an unnamed grouping — omit it instead */
  const legendText = text(group.legend) || text(group.label);
  if (legendText) {
    const legend = document.createElement('legend');
    legend.className = 'form-legend';
    legend.textContent = legendText;
    if (group.legendHidden === true) legend.classList.add('form-visually-hidden');
    fieldset.append(legend);
  }

  const grid = document.createElement('div');
  grid.className = 'form-grid';
  const children = Array.isArray(group.fields) ? group.fields : [];
  children.forEach((child, childIndex) => {
    const entry = createField(child, `${idBase}-${toIdPart(group.name, index)}`, childIndex, indicator);
    if (entry) {
      entries.push(entry);
      grid.append(entry.wrapper);
    }
  });
  fieldset.append(grid);
  return fieldset;
}

/**
 * Renders every field in a definition into a grid.
 * @param {Array} fields The field list
 * @param {string} idBase Unique prefix for this block instance
 * @param {string} indicator The required marker
 * @returns {{grid: Element, entries: Array, hidden: Array}} the rendered parts
 */
function renderFields(fields, idBase, indicator) {
  const grid = document.createElement('div');
  grid.className = 'form-grid';
  const entries = [];
  const hidden = [];

  fields.forEach((field, index) => {
    const type = text(field.type);
    if (type === 'hidden') {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = text(field.name) || toIdPart(field.name, index);
      // hidden values are campaign/source metadata, never PII
      input.value = text(field.value);
      hidden.push(input);
      return;
    }
    if (type === 'fieldset') {
      const fieldset = createFieldset(field, idBase, index, indicator, entries);
      const cell = document.createElement('div');
      cell.className = 'form-field form-field-full';
      cell.append(fieldset);
      grid.append(cell);
      return;
    }
    if (type === 'submit') return; // the submit button is rendered separately
    const entry = createField(field, idBase, index, indicator);
    if (entry) {
      entries.push(entry);
      grid.append(entry.wrapper);
    }
  });

  return { grid, entries, hidden };
}

/**
 * Builds the focus-managed error summary.
 * @param {string} id The block instance id
 * @param {string} title The summary heading text
 * @returns {{summary: Element, list: Element}} the summary and its list
 */
function createErrorSummary(id, title) {
  const summary = document.createElement('div');
  summary.className = 'form-errors';
  summary.id = `${id}-errors`;
  summary.tabIndex = -1;
  summary.hidden = true;

  // role="alert" on the inner wrapper rather than a heading: the summary sits
  // between the block's authored heading and the fields, so injecting an
  // <h2>/<h3> here would fight whatever level the author chose.
  const alert = document.createElement('div');
  alert.setAttribute('role', 'alert');

  const heading = document.createElement('p');
  heading.className = 'form-errors-title';
  heading.textContent = title;

  const list = document.createElement('ul');
  list.className = 'form-errors-list';

  alert.append(heading, list);
  summary.append(alert);
  return { summary, list };
}

/**
 * Shows or clears the inline error for one control.
 * @param {object} entry The field entry
 * @param {string} message The message, or '' to clear
 */
function setFieldError(entry, message) {
  const error = entry.wrapper.querySelector('.form-error');
  error.textContent = message;
  error.hidden = !message;
  entry.wrapper.classList.toggle('form-field-invalid', !!message);
  entry.control.setAttribute('aria-invalid', message ? 'true' : 'false');
}

/**
 * Runs native constraint validation across the form and paints the results.
 * @param {Array} entries The field entries
 * @param {Element} summary The error summary container
 * @param {Element} list The error summary list
 * @returns {HTMLElement|null} the first invalid control, or null when valid
 */
function validate(entries, summary, list) {
  list.replaceChildren();
  let first = null;

  entries.forEach((entry) => {
    if (entry.control.checkValidity()) {
      setFieldError(entry, '');
      return;
    }
    const message = messageFor(entry.control, entry.field.messages);
    setFieldError(entry, message);
    if (!first) first = entry.control;

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${entry.control.id}`;
    link.textContent = `${text(entry.field.label) || entry.control.name}: ${message}`;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      entry.control.focus();
    });
    item.append(link);
    list.append(item);
  });

  summary.hidden = !first;
  return first;
}

/**
 * Collects the submitted values.
 *
 * FormData omits unchecked checkboxes; consent must be an explicit false rather
 * than a missing key, so those are written back in.
 * @param {HTMLFormElement} form The form element
 * @param {Array} entries The field entries
 * @returns {FormData} the populated form data
 */
function collectValues(form, entries) {
  const data = new FormData(form);
  entries.forEach((entry) => {
    if (entry.control.type === 'checkbox' && !entry.control.checked) {
      data.set(entry.control.name, 'false');
    }
  });
  return data;
}

/**
 * Sends the collected values to the endpoint named by the definition.
 *
 * POST only, body only. A GET would put a date of birth in a URL, which lands
 * in access logs, the Referer header and browser history, so it is refused
 * outright rather than supported.
 * @param {object} definition The form definition
 * @param {FormData} data The collected values
 * @returns {Promise<Response>} the fetch response
 */
async function submitDefinition(definition, data) {
  const action = text(definition.action);
  const method = (text(definition.method) || 'POST').toUpperCase();
  if (method !== 'POST') throw new Error('unsupported method');

  if (text(definition.encoding) === 'form') {
    return fetch(action, { method, body: data });
  }
  return fetch(action, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(data.entries())),
  });
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  instanceCount += 1;
  const id = `form-${instanceCount}`;

  const { path, pathCell, copyCell } = readBlock(block);
  const definitionPath = safeDefinitionPath(path);
  const definition = definitionPath ? await loadDefinition(definitionPath) : null;

  if (!definition) {
    // Nothing renders without a definition — an empty <form> would be worse
    // than no form at all. The authored copy is kept so the section does not
    // collapse and the author can see where the block is.
    const notice = document.createElement('p');
    notice.className = 'form-notice';
    notice.textContent = 'This form is not available right now.';
    block.replaceChildren(...(copyCell ? [copyCell] : []), notice);
    return;
  }

  const settings = { ...DEFAULTS, ...definition };
  const fields = Array.isArray(definition.fields) ? definition.fields : [];

  const form = document.createElement('form');
  form.className = 'form-form';
  form.setAttribute('novalidate', '');
  if (text(definition.name)) form.name = text(definition.name);
  // the definition cell is consumed into the generated form and never
  // re-appended, so carry its instrumentation across or the path field stops
  // being editable in Universal Editor
  if (pathCell) moveInstrumentation(pathCell, form);

  const { summary, list } = createErrorSummary(id, text(settings.errorSummaryTitle));
  const { grid, entries, hidden } = renderFields(fields, id, text(settings.requiredIndicator));
  hidden.forEach((input) => form.append(input));

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'form-submit button primary';
  const submitField = fields.find((field) => text(field.type) === 'submit');
  button.textContent = (submitField && text(submitField.label)) || text(settings.submitLabel);
  actions.append(button);

  const status = document.createElement('p');
  status.className = 'form-status';
  status.id = `${id}-status`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const note = document.createElement('p');
  note.className = 'form-note';
  note.textContent = text(settings.requiredNote);

  form.append(summary, grid, actions, status);
  if (note.textContent) form.append(note);

  /**
   * Announces a submission or configuration message.
   * @param {string} message Text to announce
   * @param {boolean} invalid Whether this represents a failure
   */
  const setStatus = (message, invalid) => {
    status.textContent = message;
    status.classList.toggle('form-status-error', invalid);
  };

  entries.forEach((entry) => {
    const event = entry.control.tagName === 'SELECT' || entry.control.type === 'checkbox'
      ? 'change'
      : 'input';
    entry.control.addEventListener(event, () => {
      // only ever clear on edit — re-reporting mid-keystroke is hostile
      if (entry.control.getAttribute('aria-invalid') === 'true' && entry.control.checkValidity()) {
        setFieldError(entry, '');
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    /* aria-disabled does not block activation, so guard re-entry here */
    if (button.getAttribute('aria-disabled') === 'true') return;
    const invalid = validate(entries, summary, list);
    if (invalid) {
      setStatus('', false);
      summary.focus();
      return;
    }

    const action = text(definition.action);
    if (!action) {
      // Deliberately not guessing a URL. See the UNRESOLVED block at the top:
      // the destination for this lead data is an open decision.
      setStatus(text(settings.unconfiguredMessage), true);
      return;
    }

    /*
     * aria-disabled, not disabled: the button is the focused element at this
     * point, and disabling it would drop focus to <body> — sending the user
     * back to the top of the document just as the status message lands.
     */
    button.setAttribute('aria-disabled', 'true');
    setStatus(text(settings.submittingMessage), false);
    try {
      const response = await submitDefinition(definition, collectValues(form, entries));
      if (!response.ok) throw new Error(`status ${response.status}`);
      form.reset();
      entries.forEach((entry) => setFieldError(entry, ''));
      const redirect = safeRedirect(definition.redirect);
      if (redirect) {
        window.location.assign(redirect);
        return;
      }
      setStatus(text(settings.successMessage), false);
    } catch (error) {
      // No value from this form is ever logged, including on failure.
      setStatus(text(settings.errorMessage), true);
    } finally {
      button.removeAttribute('aria-disabled');
    }
  });

  /*
   * GOOGLE PLACES — EXTENSION POINT (not implemented, by design).
   *
   * The source component loaded maps.googleapis.com/maps/api/js with an API
   * key in the page source and bound Places autocomplete to the address input.
   * Reproducing that needs a billing owner, a referrer-restricted key, a
   * third-party-data entry in the privacy notice, and a keyboard-accessible
   * replacement for the Places dropdown. Until those exist, an integration
   * would attach here: find the control by name (e.g. `address`), load the
   * Places library lazily on first focus, and never let it overwrite a value
   * the user typed.
   */

  block.replaceChildren(...(copyCell ? [copyCell] : []), form);
}
