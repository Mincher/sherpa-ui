# sherpa-ai-panel

Standalone chrome for AI / chat surfaces. Provides a header (title +
new-chat / archive / extra controls / close), a scrollable thread
region, and slots for suggested prompts, composer, and footer.

Sibling of `sherpa-panel` — same overlay / inline mental model, but
purpose-built for chat. Application logic (LLM calls, archive
persistence, message rendering) lives in the host; the component
emits the events the host needs.

## Usage

```html
<sherpa-ai-panel
  data-variant="overlay"
  data-position="right"
  data-heading="Ask AI"
  data-expanded
  data-can-archive>

  <!-- Default slot = chat thread -->
  <sherpa-chat-message data-role="user">Hi!</sherpa-chat-message>
  <sherpa-chat-message data-role="ai" data-avatar-icon="fa-solid fa-wand-magic-sparkles">
    Hello — how can I help?
  </sherpa-chat-message>

  <!-- Composer (only shown when slotted) -->
  <sherpa-prompt-composer
    slot="composer"
    data-placeholder="Ask anything…"></sherpa-prompt-composer>

  <!-- Suggestions (only shown when thread is empty) -->
  <div slot="suggestions">…</div>

  <!-- Footer disclaimer -->
  <span slot="footer">Ask AI is still learning.</span>
</sherpa-ai-panel>
```

## Attributes

| Attribute          | Values                | Default   | Description                                |
| ------------------ | --------------------- | --------- | ------------------------------------------ |
| `data-variant`     | `inline` \| `overlay` | `overlay` | Layout mode.                               |
| `data-position`    | `left` \| `right`     | `right`   | Edge to dock to / border side.             |
| `data-expanded`    | flag                  | —         | Visible state.                             |
| `data-heading`     | string                | `Ask AI`  | Header title.                              |
| `data-width`       | CSS length            | —         | Override panel width.                      |
| `data-can-archive` | flag                  | —         | Enables the archive button.                |
| `data-busy`        | flag                  | —         | Disables new-chat + archive.               |

## Events

| Event              | Detail                | Description                                |
| ------------------ | --------------------- | ------------------------------------------ |
| `ai-panel-new-chat`| —                     | New-chat button clicked.                   |
| `ai-panel-archive` | —                     | Archive button clicked (when enabled).     |
| `panel-close`      | —                     | Close button clicked.                      |
| `panel-toggle`     | `{ expanded }`        | `data-expanded` changed.                   |

## Slots

| Slot          | Notes                                                            |
| ------------- | ---------------------------------------------------------------- |
| (default)     | Chat thread (e.g. `<sherpa-chat-message>` nodes).                |
| `controls`    | Extra header buttons (rendered before the close button).         |
| `suggestions` | Suggestion cards. Auto-hidden when the thread has any children.  |
| `composer`    | Prompt composer (`<sherpa-prompt-composer>` or equivalent).      |
| `footer`      | Footer disclaimer text.                                          |

## Methods

`open()`, `close()`, `toggle()` plus the `expanded` boolean property.
