/**
 * @fileoverview Tests for element-cache.ts utility
 */

import { expect } from '@open-wc/testing';
import { cached, defineCachedElements, clearElementCache } from './element-cache.js';

describe('element-cache', () => {
  // Mock component with $() and $$() methods
  class MockComponent {
    shadowRoot = document.createElement('div');

    constructor() {
      // Set up some test elements
      this.shadowRoot.innerHTML = `
        <div class="container">
          <h1 class="heading">Title</h1>
          <button class="trigger">Click</button>
          <span class="icon icon-1">Icon 1</span>
          <span class="icon icon-2">Icon 2</span>
          <input class="text-input" type="text" />
        </div>
      `;
    }

    $(selector: string): Element | null {
      return this.shadowRoot.querySelector(selector);
    }

    $$(selector: string): NodeListOf<Element> {
      return this.shadowRoot.querySelectorAll(selector);
    }
  }

  describe('@cached decorator', () => {
    it('should cache element on first access', () => {
      class TestComponent extends MockComponent {
        @cached('.heading')
        get headingEl(): HTMLElement | null {
          return null;
        }
      }

      const component = new TestComponent();
      const firstCall = component.headingEl;
      const secondCall = component.headingEl;

      expect(firstCall).to.equal(component.$('.heading'));
      expect(secondCall).to.equal(firstCall); // Same reference
    });

    it('should return null for non-existent elements', () => {
      class TestComponent extends MockComponent {
        @cached('.does-not-exist')
        get missingEl(): Element | null {
          return null;
        }
      }

      const component = new TestComponent();
      expect(component.missingEl).to.be.null;
    });

    it('should support all=true for querySelectorAll', () => {
      class TestComponent extends MockComponent {
        @cached('.icon', Element, true)
        get iconEls(): NodeListOf<Element> {
          return null as any;
        }
      }

      const component = new TestComponent();
      const icons = component.iconEls;

      expect(icons).to.be.instanceOf(NodeList);
      expect(icons.length).to.equal(2);
    });

    it('should cache multiple different elements independently', () => {
      class TestComponent extends MockComponent {
        @cached('.heading')
        get headingEl(): Element | null {
          return null;
        }

        @cached('.trigger')
        get triggerEl(): Element | null {
          return null;
        }
      }

      const component = new TestComponent();
      const heading = component.headingEl;
      const trigger = component.triggerEl;

      expect(heading?.className).to.equal('heading');
      expect(trigger?.className).to.equal('trigger');
      expect(heading).to.not.equal(trigger);
    });
  });

  describe('defineCachedElements', () => {
    it('should create frozen object with cached getters', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        heading: '.heading',
        trigger: '.trigger',
      });

      expect(Object.isFrozen(els)).to.be.true;
      expect(els.heading).to.equal(component.$('.heading'));
      expect(els.trigger).to.equal(component.$('.trigger'));
    });

    it('should support config objects with selector', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        heading: { selector: '.heading' },
        trigger: { selector: '.trigger' },
      });

      expect(els.heading?.className).to.equal('heading');
      expect(els.trigger?.className).to.equal('trigger');
    });

    it('should support all=true in config', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        icons: { selector: '.icon', all: true },
      });

      expect(els.icons).to.be.instanceOf(NodeList);
      expect(els.icons.length).to.equal(2);
    });

    it('should cache results across multiple accesses', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        heading: '.heading',
      });

      const first = els.heading;
      const second = els.heading;

      expect(first).to.equal(second); // Same reference
    });

    it('should support required=true and throw if element missing', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        missing: { selector: '.does-not-exist', required: true },
      });

      expect(() => els.missing).to.throw(/Required element not found/);
    });

    it('should not throw for required=false when element missing', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        missing: { selector: '.does-not-exist', required: false },
      });

      expect(els.missing).to.be.null;
    });

    it('should support mixed string and config entries', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        heading: '.heading', // string shorthand
        trigger: { selector: '.trigger' }, // config object
        icons: { selector: '.icon', all: true }, // config with all
      });

      expect(els.heading?.className).to.equal('heading');
      expect(els.trigger?.className).to.equal('trigger');
      expect(els.icons.length).to.equal(2);
    });
  });

  describe('clearElementCache', () => {
    it('should clear cache for @cached decorators', () => {
      class TestComponent extends MockComponent {
        callCount = 0;

        @cached('.heading')
        get headingEl(): Element | null {
          return null;
        }

        $(selector: string): Element | null {
          this.callCount++;
          return super.$(selector);
        }
      }

      const component = new TestComponent();

      // First access - cache miss
      component.headingEl;
      expect(component.callCount).to.equal(1);

      // Second access - cache hit
      component.headingEl;
      expect(component.callCount).to.equal(1); // Still 1

      // Clear cache
      clearElementCache(component);

      // Third access - cache miss again
      component.headingEl;
      expect(component.callCount).to.equal(2);
    });

    it('should clear cache for defineCachedElements', () => {
      const component = new MockComponent();
      let callCount = 0;

      const originalQuery = component.$;
      component.$ = function (selector: string) {
        callCount++;
        return originalQuery.call(this, selector);
      };

      const els = defineCachedElements(component, {
        heading: '.heading',
      });

      // First access
      els.heading;
      expect(callCount).to.equal(1);

      // Second access (cached)
      els.heading;
      expect(callCount).to.equal(1);

      // Clear cache
      clearElementCache(component);

      // Third access (re-query)
      els.heading;
      expect(callCount).to.equal(2);
    });

    it('should handle clearing cache when no cache exists', () => {
      const component = new MockComponent();
      expect(() => clearElementCache(component)).to.not.throw();
    });

    it('should handle multiple clear calls', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        heading: '.heading',
      });

      els.heading; // Cache it
      clearElementCache(component);
      clearElementCache(component); // Clear again

      expect(() => els.heading).to.not.throw();
    });
  });

  describe('TypeScript type safety (manual verification)', () => {
    it('should provide correct types for single elements', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        heading: '.heading',
      });

      // TypeScript should infer: Element | null
      const el: Element | null = els.heading;
      expect(el).to.be.instanceOf(HTMLHeadingElement);
    });

    it('should provide correct types for NodeLists', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        icons: { selector: '.icon', all: true },
      });

      // TypeScript should infer: NodeListOf<Element>
      const list: NodeListOf<Element> = els.icons;
      expect(list.length).to.equal(2);
    });
  });

  describe('Integration with template changes', () => {
    it('should work correctly after shadow DOM update', () => {
      class TestComponent extends MockComponent {
        @cached('.heading')
        get headingEl(): Element | null {
          return null;
        }

        updateTemplate() {
          this.shadowRoot.innerHTML = `<h1 class="heading">New Title</h1>`;
        }
      }

      const component = new TestComponent();

      // Access before template change
      const oldHeading = component.headingEl;
      expect(oldHeading?.textContent).to.equal('Title');

      // Change template
      component.updateTemplate();

      // Clear cache (as SherpaElement would do)
      clearElementCache(component);

      // Access after template change
      const newHeading = component.headingEl;
      expect(newHeading?.textContent).to.equal('New Title');
      expect(newHeading).to.not.equal(oldHeading); // Different element
    });
  });

  describe('Edge cases', () => {
    it('should handle empty selector results', () => {
      const component = new MockComponent();
      const els = defineCachedElements(component, {
        empty: { selector: '.empty', all: true },
      });

      expect(els.empty).to.be.instanceOf(NodeList);
      expect(els.empty.length).to.equal(0);
    });

    it('should handle special characters in selectors', () => {
      const component = new MockComponent();
      component.shadowRoot.innerHTML = `<div class="my-class-name">Test</div>`;

      const els = defineCachedElements(component, {
        special: '.my-class-name',
      });

      expect(els.special?.textContent).to.equal('Test');
    });

    it('should handle deeply nested elements', () => {
      const component = new MockComponent();
      component.shadowRoot.innerHTML = `
        <div><div><div><span class="deep">Deep</span></div></div></div>
      `;

      const els = defineCachedElements(component, {
        deep: '.deep',
      });

      expect(els.deep?.textContent).to.equal('Deep');
    });
  });
});
