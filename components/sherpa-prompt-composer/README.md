# sherpa-prompt-composer

Auto-growing prompt textarea with a circular send button and a
gradient border. Designed for AI / chat surfaces.

- `Enter` submits.
- `Shift+Enter` inserts a newline.
- The component does **not** clear itself on submit — the host calls
  `clear()` once the prompt is accepted, so a slow consumer can keep
  the prompt visible while it streams a response.

## Usage

```html
<sherpa-prompt-composer
  data-placeholder="Ask anything…"
  data-max-height="180"></sherpa-prompt-composer>
```

```js
const composer = document.querySelector("sherpa-prompt-composer");
composer.addEventListener("prompt-submit", async (e) => {
  composer.setBusy(true);
  await runPrompt(e.detail.value);
  composer.clear();
  composer.setBusy(false);
});
```

## Attributes

| Attribute          | Type    | Default | Description                       |
| ------------------ | ------- | ------- | --------------------------------- |
| `data-placeholder` | string  | —       | Placeholder text.                 |
| `data-disabled`    | flag    | —       | Disables input + send.            |
| `data-max-height`  | number  | `160`   | Max textarea height in px.        |

## Events

| Event           | Detail        | Description                                   |
| --------------- | ------------- | --------------------------------------------- |
| `prompt-submit` | `{ value }`   | Fired with trimmed value when non-empty.      |

## Methods

`focus()`, `clear()`, `setBusy(boolean)` plus the `value` property.

## Parts

`composer`, `input`, `send`.
