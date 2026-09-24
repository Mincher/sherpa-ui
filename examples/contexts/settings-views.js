/**
 * examples/contexts/settings-views.js — the Views of each Settings Context,
 * picked from the header's View chip. Same `SavedView` shape as the dashboard's.
 *
 * The FIRST View of each is the template's own markup, so it has no `content`.
 * `content` is parsed through the allow-list, which drops `checked`, so a
 * switch's starting state is in the snapshot instead.
 */
const snapshot = (id, elements = {}) =>
  ({ v: 1, elements: { header: { values: { view: [id] } }, ...elements } });

const header = (heading, description) => `
  <sherpa-container-header slot="header" data-heading="${heading}"
    data-description="${description}"></sherpa-container-header>`;

const toggle = (id, label, description) => `
  <sherpa-list-item data-label="${label}" data-description="${description}">
    <sherpa-switch slot="trailing" id="${id}" name="${id}"></sherpa-switch>
  </sherpa-list-item>`;

export const SETTINGS_VIEWS = {
  profile: {
    details: { label: 'Details', snapshot: snapshot('details') },
    notifications: {
      label: 'Notifications',
      content: header('Notifications', 'What we send you, and where.') + `
        <sherpa-list>
          ${toggle('notify-email', 'Email notifications', 'Weekly digest and mentions.')}
          ${toggle('notify-browser', 'Browser notifications', 'Alerts while the app is open.')}
        </sherpa-list>`,
      snapshot: snapshot('notifications', { 'notify-email': { checked: true } }),
    },
  },

  accessibility: {
    display: { label: 'Display', snapshot: snapshot('display') },
    interaction: {
      label: 'Interaction',
      content: header('Interaction', 'Make the app easier to use.') + `
        <sherpa-list>
          ${toggle('reduce-motion', 'Reduce motion', 'Turn off animation and moving effects.')}
          ${toggle('shortcuts', 'Keyboard shortcuts', 'Single-key shortcuts for common actions.')}
        </sherpa-list>`,
      snapshot: snapshot('interaction', { shortcuts: { checked: true } }),
    },
  },

  appearance: {
    theme: { label: 'Theme', snapshot: snapshot('theme') },
    layout: {
      label: 'Layout',
      content: header('Layout', 'Spacing and page size.') + `
        <sherpa-stack data-gap="xl">
          <sherpa-select-group id="density" data-label="Density"></sherpa-select-group>
          <sherpa-select-group id="page-size" data-label="Items per page"></sherpa-select-group>
        </sherpa-stack>`,
      snapshot: snapshot('layout'),
    },
  },
};
