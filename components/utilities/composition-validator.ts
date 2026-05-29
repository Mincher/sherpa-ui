/**
 * composition-validator.js
 *
 * Runtime composition validator for Sherpa UI components.
 * Enforces tier hierarchy, data-accepts constraints, and required slots.
 *
 * Usage:
 *   import { CompositionValidator } from './composition-validator.js';
 *
 *   // Enable strict mode (rejects invalid compositions)
 *   CompositionValidator.enable({ strict: true });
 *
 *   // Disable validation
 *   CompositionValidator.disable();
 *
 *   // Validate a specific component instance
 *   CompositionValidator.validate(componentElement);
 */

import { getCategory, getTier, ROLE_TIERS } from './component-categories.js';

// ─── Configuration ───────────────────────────────────────────────────

let _enabled = false;
let _strictMode = false;
let _devModeOnly = true;

const _warnedViolations = new Set();

// ─── Validation Rules ────────────────────────────────────────────────

/**
 * Tier hierarchy rule: A tier-N component can only host children
 * whose tier is N or deeper (tier number >= N).
 *
 * @param {number} hostTier
 * @param {number} childTier
 * @returns {boolean}
 */
function isTierValid(hostTier, childTier) {
  if (hostTier == null || childTier == null) return true;
  return childTier >= hostTier;
}

/**
 * Role allowlist rule: Child's category must be in the slot's
 * data-accepts list (if present).
 *
 * @param {string[]} acceptedRoles
 * @param {string} childCategory
 * @param {boolean} allowHtml
 * @param {boolean} isSherpaComponent
 * @returns {boolean}
 */
function isRoleAccepted(acceptedRoles, childCategory, allowHtml, isSherpaComponent) {
  if (!acceptedRoles) return true;

  if (isSherpaComponent) {
    return childCategory && acceptedRoles.includes(childCategory);
  }

  return allowHtml;
}

// ─── Error Messages ──────────────────────────────────────────────────

/**
 * Generate a helpful error message with fix suggestions.
 *
 * @param {string} type - 'tier' | 'role' | 'required-slot'
 * @param {Object} context
 * @returns {string}
 */
function getErrorMessage(type, context) {
  const { hostTag, slotName, childTag, childCategory, childTier, hostTier, acceptedRoles } = context;

  if (type === 'tier') {
    const tierName = (tier) => {
      if (tier === 1) return 'Shell/Nav';
      if (tier === 2) return 'Container/Overlay';
      if (tier === 3) return 'Content';
      if (tier === 4) return 'Control/Input/Display';
      if (tier === 5) return 'Utility';
      return `Tier ${tier}`;
    };

    return [
      `[sherpa] Invalid composition: <${childTag}> (${tierName(childTier)}) cannot be slotted into <${hostTag}> (${tierName(hostTier)}) slot="${slotName}".`,
      ``,
      `  Tier rule: A tier-${hostTier} component can only contain tier-${hostTier}+ components.`,
      `  `,
      `  Fix: `,
      `    • Move <${childTag}> to a tier-${childTier} or lower container`,
      `    • Or wrap it in an appropriate tier-${hostTier}+ component`,
      ``,
    ].join('\n');
  }

  if (type === 'role') {
    const allowed = acceptedRoles.join(', ');
    const isSherpa = childTag.startsWith('sherpa-');

    if (!isSherpa) {
      return [
        `[sherpa] Invalid composition: <${childTag}> (non-sherpa element) not allowed in <${hostTag}> slot="${slotName}".`,
        ``,
        `  Slot accepts: ${allowed}`,
        `  `,
        `  Fix: `,
        `    • Add "html" to the slot's data-accepts: data-accepts="${allowed},html"`,
        `    • Or replace <${childTag}> with a Sherpa component`,
        ``,
      ].join('\n');
    }

    return [
      `[sherpa] Invalid composition: <${childTag}> (role: ${childCategory || 'unknown'}) not allowed in <${hostTag}> slot="${slotName}".`,
      ``,
      `  Slot accepts: ${allowed}`,
      `  Component role: ${childCategory || 'unknown'}`,
      `  `,
      `  Fix: `,
      `    • Use a component with one of these roles: ${allowed}`,
      `    • Or remove the data-accepts constraint if <${childTag}> should be allowed`,
      ``,
    ].join('\n');
  }

  if (type === 'required-slot') {
    const { requiredSlots } = context;
    const missing = requiredSlots.filter(name => !context[`has_${name}`]);

    return [
      `[sherpa] Invalid composition: <${hostTag}> is missing required slot content.`,
      ``,
      `  Required slots: ${missing.join(', ')}`,
      `  `,
      `  Fix: `,
      `    • Add content to the required slot(s)`,
      ...missing.map(name => `    • <${hostTag}><span slot="${name}">...</span></${hostTag}>`),
      ``,
    ].join('\n');
  }

  return `[sherpa] Composition validation failed for <${hostTag}>`;
}

// ─── Validation Logic ────────────────────────────────────────────────

/**
 * Validate a slot's assigned children against tier and role rules.
 *
 * @param {HTMLSlotElement} slotEl
 * @param {HTMLElement} hostEl
 * @returns {Object[]} Array of violations
 */
export function validateSlot(slotEl, hostEl) {
  const violations = [];
  const hostTag = hostEl.localName;
  const hostTier = getTier(hostTag);
  const slotName = slotEl.name || '(default)';
  const acceptsAttr = slotEl.getAttribute('data-accepts');

  // No validation rules apply
  if (!acceptsAttr && hostTier == null) {
    return violations;
  }

  const acceptedRoles = acceptsAttr
    ? acceptsAttr.split(',').map(s => s.trim()).filter(Boolean)
    : null;
  const allowHtml = acceptedRoles ? acceptedRoles.includes('html') : true;

  for (const child of slotEl.assignedElements()) {
    const childTag = child.localName;
    const isSherpa = childTag.startsWith('sherpa-');
    const childCategory = isSherpa ? getCategory(childTag) : null;
    const childTier = isSherpa ? getTier(childTag) : null;

    // Tier validation
    if (isSherpa && !isTierValid(hostTier, childTier)) {
      violations.push({
        type: 'tier',
        slotName,
        childElement: child,
        message: getErrorMessage('tier', {
          hostTag,
          slotName,
          childTag,
          childCategory,
          childTier,
          hostTier,
        }),
      });
      continue;
    }

    // Role validation (data-accepts)
    if (acceptedRoles && !isRoleAccepted(acceptedRoles, childCategory, allowHtml, isSherpa)) {
      violations.push({
        type: 'role',
        slotName,
        childElement: child,
        message: getErrorMessage('role', {
          hostTag,
          slotName,
          childTag,
          childCategory,
          acceptedRoles,
        }),
      });
    }
  }

  return violations;
}

/**
 * Validate required slots have content.
 *
 * @param {ShadowRoot} shadowRoot
 * @param {HTMLElement} hostEl
 * @param {string[]} requiredSlots - Array of slot names that must have content
 * @returns {Object|null} Violation object or null
 */
export function validateRequiredSlots(shadowRoot, hostEl, requiredSlots) {
  if (!requiredSlots || requiredSlots.length === 0) return null;

  const hostTag = hostEl.localName;
  const slotStatus = {};

  for (const slotName of requiredSlots) {
    const slotEl = slotName === 'default'
      ? shadowRoot.querySelector('slot:not([name])')
      : shadowRoot.querySelector(`slot[name="${slotName}"]`);

    if (!slotEl) {
      console.warn(`[sherpa] Required slot "${slotName}" not found in <${hostTag}> template`);
      continue;
    }

    const assigned = slotEl.assignedNodes();
    const hasContent = assigned.some(node =>
      (node.nodeType === Node.ELEMENT_NODE && node.localName !== 'template') ||
      (node.nodeType === Node.TEXT_NODE && node.textContent.trim())
    );

    slotStatus[`has_${slotName}`] = hasContent;
  }

  const missingSlots = requiredSlots.filter(name => !slotStatus[`has_${name}`]);

  if (missingSlots.length > 0) {
    return {
      type: 'required-slot',
      message: getErrorMessage('required-slot', {
        hostTag,
        requiredSlots: missingSlots,
        ...slotStatus,
      }),
    };
  }

  return null;
}

/**
 * Validate an entire component's composition.
 *
 * @param {HTMLElement} componentEl
 * @param {Object} options
 * @param {string[]} options.requiredSlots - Slot names that must have content
 * @returns {Object[]} Array of all violations
 */
export function validateComponent(componentEl, options = {}) {
  const violations = [];

  if (!componentEl || !componentEl.shadowRoot) {
    return violations;
  }

  const shadowRoot = componentEl.shadowRoot;

  // Validate each slot
  const slots = shadowRoot.querySelectorAll('slot');
  for (const slot of slots) {
    const slotViolations = validateSlot(slot, componentEl);
    violations.push(...slotViolations);
  }

  // Validate required slots
  if (options.requiredSlots && options.requiredSlots.length > 0) {
    const requiredViolation = validateRequiredSlots(shadowRoot, componentEl, options.requiredSlots);
    if (requiredViolation) {
      violations.push(requiredViolation);
    }
  }

  return violations;
}

// ─── Public API ──────────────────────────────────────────────────────

export const CompositionValidator = {
  /**
   * Enable composition validation.
   *
   * @param {Object} options
   * @param {boolean} options.strict - Reject invalid compositions (add data-slot-rejected attribute)
   * @param {boolean} options.devModeOnly - Only enable in development (check NODE_ENV)
   */
  enable({ strict = false, devModeOnly = true } = {}) {
    // Check if we're in dev mode
    if (devModeOnly) {
      const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
      const isLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (!isDev && !isLocalhost) {
        console.info('[sherpa] Composition validator disabled (not in dev mode)');
        return;
      }
    }

    _enabled = true;
    _strictMode = strict;
    _devModeOnly = devModeOnly;

    console.info('[sherpa] Composition validator enabled', { strict: _strictMode });
  },

  /**
   * Disable composition validation.
   */
  disable() {
    _enabled = false;
    console.info('[sherpa] Composition validator disabled');
  },

  /**
   * Check if validation is enabled.
   * @returns {boolean}
   */
  get enabled() {
    return _enabled;
  },

  /**
   * Check if strict mode is enabled.
   * @returns {boolean}
   */
  get strictMode() {
    return _strictMode;
  },

  /**
   * Validate a component and log/flag violations.
   *
   * @param {HTMLElement} componentEl
   * @param {Object} options
   * @returns {Object[]} Array of violations
   */
  validate(componentEl, options = {}) {
    if (!_enabled) return [];

    const violations = validateComponent(componentEl, options);

    // Log and flag violations
    for (const violation of violations) {
      const warnKey = `${violation.type}|${componentEl.localName}|${violation.slotName || ''}|${violation.childElement?.localName || ''}`;

      // Only log once per unique violation
      if (!_warnedViolations.has(warnKey)) {
        _warnedViolations.add(warnKey);
        console.warn(violation.message);
      }

      // Flag element if strict mode enabled
      if (_strictMode && violation.childElement) {
        violation.childElement.setAttribute('data-slot-rejected', 'true');
      }
    }

    return violations;
  },

  /**
   * Clear warning cache (useful for tests).
   */
  clearWarnings() {
    _warnedViolations.clear();
  },
};
