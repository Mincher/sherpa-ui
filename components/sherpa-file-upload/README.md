# sherpa-file-upload

> **Category:** form · **Base class:** SherpaElement

File upload drop zone with drag-and-drop, file list, and per-file progress/status tracking. Consumer handles actual upload; call setFileState/setFileProgress to update UI.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Label text above the drop zone | — | — |
| `data-accept` | string | Accepted file types (e.g. ".jpg,.png,image/*") | — | — |
| `data-multiple` | boolean | Allow multiple file selection | — | — |
| `data-max-size` | string | Maximum file size in bytes | — | — |
| `data-max-files` | string | Maximum number of files | — | — |
| `data-helper` | string | Constraint / helper text | — | — |
| `disabled` | boolean | Disabled state | — | — |

## Events

### `file-add`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  files: File[],
};
```

```js
element.addEventListener("file-add", (e) => {
  console.log(e.detail.files);
});
```

### `file-remove`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  file: File,
  index: number,
};
```

```js
element.addEventListener("file-remove", (e) => {
  console.log(e.detail.file);
});
```

### `file-clear`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("file-clear", (e) => {
  // handle event
});
```

### `file-upload-start`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  files: File[],
};
```

```js
element.addEventListener("file-upload-start", (e) => {
  console.log(e.detail.files);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setFileState(index, state, statusText)` | Update file item state |
| `setFileProgress(index, percent)` | Update file upload progress |

### `setFileState(index, state, statusText)`

Update file item state

**Parameters:**

- `index` (`any`) — 
- `state` (`any`) — 
- `statusText` (`any`) — 

### `setFileProgress(index, percent)`

Update file upload progress

**Parameters:**

- `index` (`any`) — 
- `percent` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `files` | `File[]` | Current list of selected files (getter-only) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_file-progress`
- `--_status-border`
- `--_status-surface-strong`
- `--_status-text`

## Usage

### Basic

```html
<sherpa-file-upload data-label="Example Label" data-accept="value" data-max-size="value"></sherpa-file-upload>
```

### Disabled

```html
<sherpa-file-upload data-label="Disabled" disabled></sherpa-file-upload>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-file-upload/sherpa-file-upload.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-file-upload.js`](sherpa-file-upload.js) | Component class, lifecycle, events |
| [`sherpa-file-upload.css`](sherpa-file-upload.css) | Styles, variants, states |
| [`sherpa-file-upload.html`](sherpa-file-upload.html) | Shadow DOM template(s) |
