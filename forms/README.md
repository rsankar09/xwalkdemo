# Form definitions

The `form` block (`blocks/form/`) renders nothing of its own. An author points
the block at one of the JSON files in this folder and the block fetches it at
runtime and builds the fields from it. Changing a form is therefore a content
change, and one block serves every form on the site.

```
blocks/form/form.js   →  fetch('/forms/group-term-life.json')  →  <form>
```

## Where the path comes from

The block's model has a single `definition` field holding a same-origin path,
e.g. `/forms/group-term-life.json`. Paths that do not start with `/`, or that
start with `//`, are rejected — a definition can build a form that collects a
date of birth, so it may not be loaded from a third-party host.

## Status of the sample

`group-term-life.json` reproduces the field list of the AEM Adaptive Form that
was captured on the Group Term Life page (`cmp-p10`). **Its `action` is
deliberately empty, so it posts nowhere.** The form validates, announces and
stops. See the UNRESOLVED block at the top of `blocks/form/form.js` for the
decisions that have to be made before it can transmit anything.

## Top-level schema

| Key                   | Type   | Default | Notes |
| --------------------- | ------ | ------- | ----- |
| `id`                  | string | –       | Informational. |
| `name`                | string | –       | Applied as the `<form name>`. |
| `title`               | string | –       | Informational; the visible heading is authored on the block. |
| `action`              | string | `""`    | Endpoint. **Empty means do not transmit.** |
| `method`              | string | `POST`  | POST only. Anything else is refused — a GET would put PII in a URL. |
| `encoding`            | string | `json`  | `json` sends `application/json`; `form` sends a `FormData` body. |
| `redirect`            | string | –       | Optional path to navigate to on success. Must start with `/` and carry no query string. |
| `submitLabel`         | string | `Submit` | Overridden by a `submit` field's `label` if present. |
| `requiredNote`        | string | `*Required` | Rendered under the button. |
| `requiredIndicator`   | string | `*`     | Appended to the label of every required field. |
| `errorSummaryTitle`   | string | see JS  | Heading of the focus-managed error summary. |
| `submittingMessage`   | string | `Submitting…` | |
| `successMessage`      | string | see JS  | |
| `errorMessage`        | string | see JS  | |
| `unconfiguredMessage` | string | see JS  | Shown when `action` is empty. |
| `fields`              | array  | `[]`    | See below. |

## Field schema

| Key            | Type    | Applies to | Notes |
| -------------- | ------- | ---------- | ----- |
| `type`         | string  | all        | `text`, `email`, `tel`, `number`, `date`, `url`, `search`, `select`, `checkbox`, `textarea`, `hidden`, `submit`, `fieldset`. Unknown types are skipped. |
| `name`         | string  | all        | Submitted key. Also seeds the element id. |
| `label`        | string  | all visible | Rendered as a real `<label>`. Never a placeholder substitute. |
| `required`     | boolean | all visible | Sets the native `required` attribute *and* the visible indicator. |
| `width`        | string  | all visible | `full` \| `half` \| `third` \| `quarter`. Full width below 900px regardless. |
| `placeholder`  | string  | inputs, textarea, select | On a `select` it becomes the empty first option. |
| `pattern`      | string  | text-like inputs | Native `pattern` attribute. |
| `minLength` / `maxLength` | number | text-like inputs | |
| `min` / `max` / `step` | number/string | `number`, `date` | |
| `inputMode`    | string  | inputs     | e.g. `numeric`, `tel`. |
| `autocomplete` | string  | inputs, select | Use the WHATWG tokens (`given-name`, `postal-code`, `bday`, …). |
| `help`         | string  | all visible | Plain text, wired to the control via `aria-describedby`. |
| `messages`     | object  | all visible | Per-constraint overrides, keyed by `ValidityState` flag. |
| `options`      | array   | `select`   | `{ "label": "...", "value": "..." }`, or a bare string. |
| `rows`         | number  | `textarea` | |
| `value`        | string  | `hidden`   | Campaign/source metadata only — never PII. |
| `legend` / `legendHidden` / `fields` | – | `fieldset` | See below. |

### Validation messages

Validation is the browser's. The block sets `required`, `type`, `pattern`,
`minlength`/`maxlength` and `min`/`max`, calls `checkValidity()`, then reads
`ValidityState` to pick a message. `messages` only supplies friendlier wording;
there is no custom matching engine. Recognised keys, in report order:

```
valueMissing, typeMismatch, patternMismatch, tooShort, tooLong,
rangeUnderflow, rangeOverflow, stepMismatch, badInput
```

Anything not overridden falls back to the browser's own
`control.validationMessage`.

### Grouping with a fieldset

```json
{
  "type": "fieldset",
  "name": "address",
  "legend": "Mailing address",
  "legendHidden": false,
  "fields": [
    { "type": "text", "name": "address", "label": "Address", "required": true, "width": "half" },
    { "type": "text", "name": "city", "label": "City", "required": true, "width": "quarter" }
  ]
}
```

A fieldset always occupies a full row; its children lay out on their own
12-column grid inside it. `legendHidden: true` keeps the legend for screen
readers and hides it visually. The sample definition is intentionally flat,
because the captured design shows no group headings.

## Treat definitions as untrusted

The block injects every definition string with `textContent` or a property
assignment — never `innerHTML`. If a definition ever needs real markup (a
privacy-policy link inside a consent label is the likely first ask), route it
through the vendored `scripts/dompurify.min.js`; do not relax the rule.

## Not included

Google Places address autocomplete, which the source component loaded, is **not**
integrated. There is a commented extension point in `blocks/form/form.js`
describing what an integration would need (billing owner, referrer-restricted
key, privacy-notice entry, keyboard-accessible dropdown).
