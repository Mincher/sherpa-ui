# sherpa-stepper

> **Category:** form · **Base class:** SherpaElement

Horizontal/vertical step progress indicator. Steps populated from data; CSS handles all visual states.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-current-step` | number | Active step (1-based) | `1` | — |
| `data-linear` | enum | true \| false — steps must complete in order | — | `true`, `false` |
| `data-show-step-numbers` | enum | true \| false (default: true) | — | `true`, `false` |
| `data-src` | string | URL to load steps JSON | — | — |

## Events

### `step-change`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  currentStep: number,
  previousStep: number,
  label: string,
};
```

```js
element.addEventListener("step-change", (e) => {
  console.log(e.detail.currentStep);
});
```

### `step-click`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  step: number,
  label: string,
};
```

```js
element.addEventListener("step-click", (e) => {
  console.log(e.detail.step);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setSteps(steps)` | Set steps array: [{ label, description? }] |
| `nextStep()` | Advance to next step |
| `previousStep()` | Go back to previous step |
| `goToStep(num)` | Jump to specific step number |
| `completeStep(num)` | Mark a step as completed |
| `setStepError(num, bool)` | Mark/unmark a step as errored |

### `setSteps(steps)`

Set steps array: [{ label, description? }]

**Parameters:**

- `steps` (`any`) — 

### `goToStep(num)`

Jump to specific step number

**Parameters:**

- `num` (`any`) — 

### `completeStep(num)`

Mark a step as completed

**Parameters:**

- `num` (`any`) — 

### `setStepError(num, bool)`

Mark/unmark a step as errored

**Parameters:**

- `num` (`any`) — 
- `bool` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `currentStep` | `number` | Getter/setter for data-current-step | read/write |
| `linear` | `boolean` | Getter/setter for data-linear | read/write |
| `showStepNumbers` | `boolean` | Getter/setter for data-show-step-numbers | read/write |
| `dataSrc` | `string` | Getter/setter for data-src | read/write |
| `steps` | `Array` | Current steps array (getter-only) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_connector-color`
- `--_connector-offset`
- `--_duration`
- `--_easing`
- `--_indicator-bg`
- `--_indicator-border-color`
- `--_indicator-color`
- `--_indicator-font-size`
- `--_indicator-size`
- `--_label-color`
- `--_label-font-size`
- `--_label-weight`
- `--_sublabel-font-size`

## Usage

### Basic

```html
<sherpa-stepper data-linear="true" data-show-step-numbers="true" data-src="value"></sherpa-stepper>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-stepper/sherpa-stepper.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-stepper.js`](sherpa-stepper.js) | Component class, lifecycle, events |
| [`sherpa-stepper.css`](sherpa-stepper.css) | Styles, variants, states |
| [`sherpa-stepper.html`](sherpa-stepper.html) | Shadow DOM template(s) |
