// @ts-nocheck
/**
 * sherpa-panel.examples.js — Setup callbacks for the live docs examples.
 *
 * Keys here match `data-setup="…"` on <template> elements in
 * sherpa-panel.examples.html. The docs router calls each fn with the
 * preview wrapper after components have rendered.
 */

function wirePanelTrigger(trigger, panel) {
  if (!trigger || !panel) return;
  trigger.addEventListener("button-click", () => {
    panel.setAttribute("data-expanded", "");
  });
  const syncTrigger = () => {
    trigger.style.visibility = panel.hasAttribute("data-expanded") ? "hidden" : "visible";
  };
  syncTrigger();
  panel.addEventListener("panel-toggle", syncTrigger);
  panel.addEventListener("panel-close", syncTrigger);
}

export default {
  "overlay-trigger"(root) {
    wirePanelTrigger(
      root.querySelector(".overlay-trigger"),
      root.querySelector('sherpa-panel[data-variant="overlay"]'),
    );
  },

  "ai-trigger"(root) {
    wirePanelTrigger(
      root.querySelector(".ai-trigger"),
      root.querySelector(".ai-panel"),
    );
  },
};
