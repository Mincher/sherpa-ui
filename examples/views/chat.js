/**
 * examples/views/chat.js — the AI-chat view's logic.
 *
 * Exported as init(root): wires the composer/thread that live inside `root`,
 * appending user messages + canned assistant replies with a typing indicator.
 * The shared nav/header live once in index.html; chat wants a full-height
 * content region, so it sets the shell's data-no-header and clears it on the
 * cleanup returned to the router. Behaviour is identical to the old chat.html.
 */
export async function init(root) {
  await Promise.all([
    customElements.whenDefined('sherpa-app-header'),
    customElements.whenDefined('sherpa-chat-message'),
    customElements.whenDefined('sherpa-code-block'),
    customElements.whenDefined('sherpa-loader'),
    customElements.whenDefined('sherpa-prompt-composer'),
  ]);

  // Chat is a full-height view — hide the shared app-header row for it.
  const shell = document.querySelector('sherpa-app-shell');
  shell?.setAttribute('data-no-header', '');

  // ── Shared header (populate for when the user leaves chat + comes back) ──
  const header = document.querySelector('sherpa-app-shell sherpa-app-header');
  header?.populate({
    breadcrumb: [
      { label: 'Workspace', href: '#' },
      { label: 'Assistant' },
    ],
  });
  header?.setAttribute('data-heading', 'Assistant');
  header?.setAttribute('data-icon', 'fa-solid fa-comments');

  // ── Chat wiring ───────────────────────────────────────────
  const thread = root.querySelector('#thread');
  const typing = root.querySelector('#typing');
  const composer = root.querySelector('#composer');

  const scrollToBottom = () => { thread.scrollTop = thread.scrollHeight; };

  const now = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Insert a message before the typing indicator so it always trails.
  const addMessage = ({ type, name, message }) => {
    const el = document.createElement('sherpa-chat-message');
    el.dataset.type = type;
    if (name) el.dataset.name = name;
    el.dataset.timestamp = now();
    el.dataset.message = message;
    thread.insertBefore(el, typing);
    scrollToBottom();
    return el;
  };

  const CANNED_REPLIES = [
    'Good question. In short: keep the debounce and add an AbortController — cancel the previous fetch before starting the next.',
    'Here’s the idea: store the latest controller, abort it on each new keystroke, and ignore any AbortError you catch.',
    'You could also guard against stale responses by tagging each request with a sequence number and dropping older ones.',
    'For accessibility, announce result counts in an aria-live region so screen-reader users hear updates as you type.',
  ];
  let replyIndex = 0;

  composer.addEventListener('prompt-submit', (e) => {
    const text = (e.detail && e.detail.text || '').trim();
    if (!text) return;

    addMessage({ type: 'user', name: 'Will', message: text });

    // Show the "typing…" indicator briefly, then append a canned reply.
    typing.hidden = false;
    scrollToBottom();

    setTimeout(() => {
      typing.hidden = true;
      const reply = CANNED_REPLIES[replyIndex % CANNED_REPLIES.length];
      replyIndex += 1;
      addMessage({ type: 'assistant', name: 'Assistant', message: reply });
    }, 1100);
  });

  // Attach / lab buttons — demo stubs.
  composer.addEventListener('composer-attach', () => console.log('composer-attach'));
  composer.addEventListener('composer-lab', () => console.log('composer-lab'));

  // Start pinned to the newest message.
  scrollToBottom();

  // Cleanup: restore the app-header row when leaving chat.
  return () => { shell?.removeAttribute('data-no-header'); };
}
