// @ts-nocheck
/**
 * sherpa-panel.examples.js — Setup callbacks for the live docs examples.
 *
 * Keys here match `data-setup="…"` on <template> elements in
 * sherpa-panel.examples.html. The docs router calls each fn with the
 * preview wrapper after components have rendered.
 */

export default {
  "overlay-trigger"(root) {
    const trigger = root.querySelector(".overlay-trigger");
    const panel = root.querySelector('sherpa-panel[data-variant="overlay"]');
    if (!trigger || !panel) return;

    // sherpa-button emits its own custom event and stops the native click.
    trigger.addEventListener("button-click", () => {
      panel.setAttribute("data-expanded", "");
    });

    // Hide the trigger while the panel is open so the demo doesn't look noisy.
    const syncTrigger = () => {
      trigger.style.visibility = panel.hasAttribute("data-expanded")
        ? "hidden"
        : "visible";
    };
    syncTrigger();
    panel.addEventListener("panel-toggle", syncTrigger);
    panel.addEventListener("panel-close", syncTrigger);
  },

  "ai-trigger"(root) {
    const trigger = root.querySelector(".ai-trigger");
    const panel = root.querySelector(".ai-panel");
    if (!trigger || !panel) return;

    trigger.addEventListener("button-click", () => {
      panel.setAttribute("data-expanded", "");
    });

    const syncTrigger = () => {
      trigger.style.visibility = panel.hasAttribute("data-expanded")
        ? "hidden"
        : "visible";
    };
    syncTrigger();
    panel.addEventListener("panel-toggle", syncTrigger);
    panel.addEventListener("panel-close", syncTrigger);
  },

  "ai-trigger"(root) {
    const trigger = root.querySelector(".ai-trigger");
    const panel = root.querySelector(".ai-panel");
    if (!trigger || !panel) return;

    trigger.addEventListener("button-click", () => {
      panel.setAttribute("data-expanded", "");
    });

    const syncTrigger = () => {
      trigger.style.visibility = panel.hasAttribute("data-expanded")
        ? "hidden"
        : "visible";
    };
    syncTrigger();
    panel.addEventListener("panel-toggle", syncTrigger);
    panel.addEventListener("panel-close", syncTrigger);
  },
};
