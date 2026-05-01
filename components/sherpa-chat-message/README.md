# sherpa-chat-message

Single chat bubble. Two roles — `user` (right-aligned, accent fill)
and `ai` (left-aligned with a gradient avatar mark, neutral bubble).

## Usage

```html
<sherpa-chat-message data-role="user">
  Where does the cat sit?
</sherpa-chat-message>

<sherpa-chat-message
  data-role="ai"
  data-avatar-icon="fa-solid fa-wand-magic-sparkles">
  On the mat.
</sherpa-chat-message>
```

## Attributes

| Attribute          | Values         | Default | Description                            |
| ------------------ | -------------- | ------- | -------------------------------------- |
| `data-role`        | `user` \| `ai` | `ai`    | Drives layout side and bubble colours. |
| `data-avatar-icon` | FA class       | —       | Default avatar glyph (ai role only).   |

## Slots

| Slot      | Notes                                       |
| --------- | ------------------------------------------- |
| (default) | Bubble body content.                        |
| `avatar`  | Custom avatar (image / element). Suppresses the default icon. |

## Parts

`message`, `avatar`, `bubble`.
