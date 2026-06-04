/**
 * Pattern Generator
 *
 * Generates complete pattern implementations from pattern definitions.
 * Includes HTML markup, JavaScript interaction logic, validation, and event handling.
 */

import type {
  Pattern,
  PatternGenerationContext,
  PatternGenerationResult,
  ComponentDefinition,
  TriggerDefinition,
  ValidationRule,
} from './pattern-schema';

export class PatternGenerator {
  /**
   * Generate complete pattern implementation
   */
  async generate(context: PatternGenerationContext): Promise<PatternGenerationResult> {
    const pattern = await this.loadPattern(context.patternId);

    const html = this.generateHTML(pattern, context.data);
    const js = this.generateJavaScript(pattern, context.data);
    const listeners = this.generateListeners(pattern, context.data);
    const validators = this.generateValidators(pattern);
    const resolutions = this.generateResolutions(pattern);

    return {
      html,
      js,
      listeners,
      validators,
      resolutions,
    };
  }

  /**
   * Load pattern definition (stub — implement loading logic)
   */
  private async loadPattern(patternId: string): Promise<Pattern> {
    // TODO: Implement actual pattern loading from filesystem or registry
    throw new Error(`Pattern loading not implemented: ${patternId}`);
  }

  /**
   * Generate HTML markup from presentation config
   */
  private generateHTML(pattern: Pattern, data: Record<string, any>): string {
    const components = pattern.presentation.components;
    const html = components.map((component) => this.renderComponent(component, data)).join('\n');
    return html;
  }

  /**
   * Render a single component to HTML
   */
  private renderComponent(component: ComponentDefinition, data: Record<string, any>): string {
    const attrs = this.renderAttributes(component.attributes || {}, data);
    const tag = component.type;
    const id = component.id ? ` id="${component.id}"` : '';

    // Self-closing for components without children
    if (!component.children && !component.content) {
      return `<${tag}${id}${attrs}></${tag}>`;
    }

    // Render children recursively
    const children = component.children
      ? component.children.map((child) => this.renderComponent(child, data)).join('\n  ')
      : '';

    const content = component.content || '';
    const inner = children || content;

    return `<${tag}${id}${attrs}>\n  ${inner}\n</${tag}>`;
  }

  /**
   * Render component attributes
   */
  private renderAttributes(
    attributes: Record<string, string | boolean | number>,
    data: Record<string, any>
  ): string {
    return Object.entries(attributes)
      .map(([key, value]) => {
        // Boolean attributes
        if (typeof value === 'boolean') {
          return value ? ` ${key}` : '';
        }

        // Interpolate data placeholders
        const interpolated = this.interpolate(String(value), data);
        return ` ${key}="${interpolated}"`;
      })
      .join('');
  }

  /**
   * Interpolate data placeholders in strings
   */
  private interpolate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });
  }

  /**
   * Generate JavaScript for interaction logic
   */
  private generateJavaScript(pattern: Pattern, data: Record<string, any>): string {
    const { interaction, resolution } = pattern;

    const lines: string[] = [];

    lines.push(`// Generated pattern: ${pattern.id}`);
    lines.push(`// ${pattern.description}`);
    lines.push('');

    // Import utilities if needed
    lines.push(`import { FlowManager } from 'sherpa-ui/components/utilities/flow-manager.js';`);
    lines.push(`import { FormManager } from 'sherpa-ui/components/utilities/form-manager.js';`);
    lines.push(`import { SherpaToast } from 'sherpa-ui/components/sherpa-toast/sherpa-toast.js';`);
    lines.push('');

    // Get DOM references
    lines.push('// Get component references');
    const componentIds = this.collectComponentIds(pattern.presentation.components);
    componentIds.forEach((id) => {
      lines.push(`const ${this.toCamelCase(id)} = document.getElementById('${id}');`);
    });
    lines.push('');

    // Initialize form manager
    lines.push('// Initialize form manager');
    lines.push(`const form = new FormManager(${this.toCamelCase(this.findDialogId(pattern))});`);
    lines.push('');

    // Generate trigger handlers
    lines.push('// Event handlers');
    interaction.triggers.forEach((trigger) => {
      lines.push(this.generateTriggerHandler(trigger, pattern, data));
    });

    // Generate validation logic
    if (interaction.validations && interaction.validations.length > 0) {
      lines.push('');
      lines.push('// Validation');
      lines.push('function validateForm() {');
      lines.push('  const errors = [];');
      interaction.validations.forEach((validation) => {
        lines.push(this.generateValidationCheck(validation));
      });
      lines.push('  return errors;');
      lines.push('}');
    }

    // Generate resolution handlers
    lines.push('');
    lines.push('// Resolution handlers');
    lines.push(this.generateResolutionHandlers(resolution, pattern));

    return lines.join('\n');
  }

  /**
   * Collect all component IDs from component tree
   */
  private collectComponentIds(components: ComponentDefinition[]): string[] {
    const ids: string[] = [];
    const collect = (components: ComponentDefinition[]) => {
      components.forEach((component) => {
        if (component.id) {
          ids.push(component.id);
        }
        if (component.children) {
          collect(component.children);
        }
      });
    };
    collect(components);
    return ids;
  }

  /**
   * Find dialog component ID
   */
  private findDialogId(pattern: Pattern): string {
    const findDialog = (components: ComponentDefinition[]): string | null => {
      for (const component of components) {
        if (component.type === 'sherpa-dialog' && component.id) {
          return component.id;
        }
        if (component.children) {
          const found = findDialog(component.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findDialog(pattern.presentation.components) || 'dialog';
  }

  /**
   * Generate trigger handler code
   */
  private generateTriggerHandler(
    trigger: TriggerDefinition,
    pattern: Pattern,
    data: Record<string, any>
  ): string {
    const targetVar = this.toCamelCase(trigger.target);
    const eventName = trigger.event;
    const action = trigger.action;

    let handler = `${targetVar}.addEventListener('${eventName}', (event) => {`;

    if (trigger.condition) {
      handler += `\n  if (!(${trigger.condition})) return;`;
    }

    if (trigger.debounce) {
      handler += `\n  // TODO: Implement debounce (${trigger.debounce}ms)`;
    }

    handler += `\n  ${this.generateActionCall(action, pattern)};`;
    handler += '\n});';

    return handler;
  }

  /**
   * Generate action function call
   */
  private generateActionCall(action: string, pattern: Pattern): string {
    switch (action) {
      case 'open_dialog': {
        const dialogId = this.findDialogId(pattern);
        return `${this.toCamelCase(dialogId)}.showModal()`;
      }

      case 'cancel_flow':
        return 'handleCancel()';

      case 'validate_and_submit':
        return 'handleSubmit()';

      case 'handle_keyboard':
        return 'handleKeyboard(event)';

      default:
        return `${action}(event)`;
    }
  }

  /**
   * Generate validation check code
   */
  private generateValidationCheck(validation: ValidationRule): string {
    const fieldVar = this.toCamelCase(validation.field);
    const rule = validation.rule;
    const message = validation.message;

    if (rule === 'required') {
      return `  if (!${fieldVar}.value || ${fieldVar}.value.trim() === '') {
    errors.push({ field: '${validation.field}', message: '${message}' });
  }`;
    }

    if (rule.startsWith('minLength:')) {
      const length = rule.split(':')[1];
      return `  if (${fieldVar}.value.length < ${length}) {
    errors.push({ field: '${validation.field}', message: '${message}' });
  }`;
    }

    if (rule.startsWith('maxLength:')) {
      const length = rule.split(':')[1];
      return `  if (${fieldVar}.value.length > ${length}) {
    errors.push({ field: '${validation.field}', message: '${message}' });
  }`;
    }

    if (rule === 'email') {
      return `  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(${fieldVar}.value)) {
    errors.push({ field: '${validation.field}', message: '${message}' });
  }`;
    }

    if (rule.startsWith('pattern:')) {
      const pattern = rule.split(':')[1];
      return `  if (!new RegExp('${pattern}').test(${fieldVar}.value)) {
    errors.push({ field: '${validation.field}', message: '${message}' });
  }`;
    }

    return `  // TODO: Implement validation rule: ${rule}`;
  }

  /**
   * Generate resolution handler functions
   */
  private generateResolutionHandlers(resolution: Pattern['resolution'], pattern: Pattern): string {
    const lines: string[] = [];

    // Success handler
    lines.push('async function handleSubmit() {');
    lines.push('  const errors = validateForm();');
    lines.push('  if (errors.length > 0) {');
    lines.push('    handleError({ message: errors[0].message });');
    lines.push('    return;');
    lines.push('  }');
    lines.push('');
    lines.push('  try {');
    lines.push('    const values = form.read();');
    lines.push('    // TODO: Call API to save data');
    lines.push('    // const result = await saveEntity(values);');
    lines.push('');
    lines.push('    // Success resolution');
    resolution.success.events.forEach((event) => {
      lines.push(`    document.dispatchEvent(new CustomEvent('${event}', { detail: { data: values } }));`);
    });
    if (resolution.success.feedback) {
      const feedback = resolution.success.feedback;
      lines.push(
        `    SherpaToast.${feedback.status}('${feedback.message}', ${feedback.duration || 3000});`
      );
    }
    if (resolution.success.action === 'close_dialog') {
      const dialogId = this.findDialogId(pattern);
      lines.push(`    ${this.toCamelCase(dialogId)}.close();`);
    }
    lines.push('  } catch (error) {');
    lines.push('    handleError(error);');
    lines.push('  }');
    lines.push('}');
    lines.push('');

    // Cancel handler
    lines.push('function handleCancel() {');
    if (resolution.cancel) {
      resolution.cancel.events?.forEach((event) => {
        lines.push(`  document.dispatchEvent(new CustomEvent('${event}'));`);
      });
      if (resolution.cancel.action === 'close_dialog') {
        const dialogId = this.findDialogId(pattern);
        lines.push(`  ${this.toCamelCase(dialogId)}.close();`);
      }
    }
    lines.push('}');
    lines.push('');

    // Error handler
    lines.push('function handleError(error) {');
    resolution.error.events.forEach((event) => {
      lines.push(`  document.dispatchEvent(new CustomEvent('${event}', { detail: { error } }));`);
    });
    if (resolution.error.feedback) {
      const feedback = resolution.error.feedback;
      const message = feedback.message || 'error.message';
      lines.push(`  SherpaToast.${feedback.status}(${message}, ${feedback.duration || 5000});`);
    }
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate event listeners array
   */
  private generateListeners(
    pattern: Pattern,
    data: Record<string, any>
  ): PatternGenerationResult['listeners'] {
    const listeners: PatternGenerationResult['listeners'] = [];

    pattern.interaction.triggers.forEach((trigger) => {
      listeners.push({
        element: `#${trigger.target}`,
        event: trigger.event,
        handler: this.createHandlerFunction(trigger, pattern),
      });
    });

    return listeners;
  }

  /**
   * Create handler function
   */
  private createHandlerFunction(trigger: TriggerDefinition, pattern: Pattern): (event: Event) => void {
    return (event: Event) => {
      if (trigger.condition) {
        // Evaluate condition (simplified)
        // TODO: Implement safe condition evaluation
      }

      // Execute action
      switch (trigger.action) {
        case 'open_dialog': {
          const dialogId = this.findDialogId(pattern);
          const dialog = document.getElementById(dialogId) as HTMLDialogElement;
          dialog?.showModal();
          break;
        }

        case 'cancel_flow':
          // TODO: Implement cancel logic
          break;

        case 'validate_and_submit':
          // TODO: Implement submit logic
          break;

        default:
          console.warn(`Unknown action: ${trigger.action}`);
      }
    };
  }

  /**
   * Generate validators array
   */
  private generateValidators(pattern: Pattern): PatternGenerationResult['validators'] {
    if (!pattern.interaction.validations) {
      return [];
    }

    return pattern.interaction.validations.map((validation) => ({
      field: validation.field,
      validate: this.createValidatorFunction(validation),
    }));
  }

  /**
   * Create validator function
   */
  private createValidatorFunction(validation: ValidationRule): (value: unknown) => string | null {
    return (value: unknown) => {
      const rule = validation.rule;

      if (rule === 'required') {
        return value && String(value).trim() !== '' ? null : validation.message;
      }

      if (rule.startsWith('minLength:')) {
        const length = parseInt(rule.split(':')[1]);
        return String(value).length >= length ? null : validation.message;
      }

      if (rule.startsWith('maxLength:')) {
        const length = parseInt(rule.split(':')[1]);
        return String(value).length <= length ? null : validation.message;
      }

      if (rule === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(value)) ? null : validation.message;
      }

      if (rule.startsWith('pattern:')) {
        const pattern = rule.split(':')[1];
        const regex = new RegExp(pattern);
        return regex.test(String(value)) ? null : validation.message;
      }

      return null;
    };
  }

  /**
   * Generate resolutions handlers
   */
  private generateResolutions(pattern: Pattern): PatternGenerationResult['resolutions'] {
    const resolutions: PatternGenerationResult['resolutions'] = [];

    // Success resolution
    resolutions.push({
      outcome: 'success',
      handler: async (data: any) => {
        const outcome = pattern.resolution.success;

        // Dispatch events
        outcome.events.forEach((event) => {
          document.dispatchEvent(
            new CustomEvent(event, {
              bubbles: true,
              composed: true,
              detail: { data },
            })
          );
        });

        // Show feedback
        if (outcome.feedback) {
          // TODO: Implement feedback display
          console.log(`[${outcome.feedback.status}] ${outcome.feedback.message}`);
        }

        // Execute action
        if (outcome.action === 'close_dialog') {
          const dialogId = this.findDialogId(pattern);
          const dialog = document.getElementById(dialogId) as HTMLDialogElement;
          dialog?.close();
        }

        // Navigation
        if (outcome.navigation) {
          // TODO: Implement navigation
        }
      },
    });

    // Cancel resolution
    if (pattern.resolution.cancel) {
      const cancelOutcome = pattern.resolution.cancel;
      resolutions.push({
        outcome: 'cancel',
        handler: () => {
          const outcome = cancelOutcome;

          outcome.events?.forEach((event) => {
            document.dispatchEvent(
              new CustomEvent(event, {
                bubbles: true,
                composed: true,
              })
            );
          });

          if (outcome.action === 'close_dialog') {
            const dialogId = this.findDialogId(pattern);
            const dialog = document.getElementById(dialogId) as HTMLDialogElement;
            dialog?.close();
          }
        },
      });
    }

    // Error resolution
    resolutions.push({
      outcome: 'error',
      handler: (error: any) => {
        const outcome = pattern.resolution.error;

        outcome.events.forEach((event) => {
          document.dispatchEvent(
            new CustomEvent(event, {
              bubbles: true,
              composed: true,
              detail: { error },
            })
          );
        });

        if (outcome.feedback) {
          // TODO: Implement feedback display
          console.error(`[${outcome.feedback.status}] ${outcome.feedback.message}`);
        }
      },
    });

    return resolutions;
  }

  /**
   * Convert kebab-case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}

/**
 * Singleton generator instance
 */
export const patternGenerator = new PatternGenerator();
