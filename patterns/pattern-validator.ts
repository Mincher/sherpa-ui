/**
 * Pattern Validator
 *
 * Validates pattern definitions against the pattern schema.
 */

import type {
  Pattern,
  PatternValidationResult,
  ComponentDefinition,
} from './pattern-schema';

export class PatternValidator {
  /**
   * Validate a complete pattern definition
   */
  validate(pattern: Pattern): PatternValidationResult {
    const errors: PatternValidationResult['errors'] = [];
    const warnings: PatternValidationResult['warnings'] = [];

    // Validate required fields
    if (!pattern.id || !pattern.id.match(/^[a-z0-9-]+$/)) {
      errors.push({
        field: 'id',
        message: 'Pattern ID must be kebab-case (lowercase, hyphens only)',
        severity: 'error',
      });
    }

    if (!pattern.name || pattern.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Pattern name is required',
        severity: 'error',
      });
    }

    if (!pattern.category) {
      errors.push({
        field: 'category',
        message: 'Pattern category is required',
        severity: 'error',
      });
    }

    // Validate presentation
    const presentationErrors = this.validatePresentation(pattern);
    errors.push(...presentationErrors);

    // Validate interaction
    const interactionErrors = this.validateInteraction(pattern);
    errors.push(...interactionErrors);

    // Validate resolution
    const resolutionErrors = this.validateResolution(pattern);
    errors.push(...resolutionErrors);

    // Validate cross-references
    const crossRefErrors = this.validateCrossReferences(pattern);
    errors.push(...crossRefErrors);

    // Validate metadata
    const metadataWarnings = this.validateMetadata(pattern);
    if (metadataWarnings) warnings.push(...metadataWarnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate presentation configuration
   */
  private validatePresentation(pattern: Pattern): PatternValidationResult['errors'] {
    const errors: PatternValidationResult['errors'] = [];

    if (!pattern.presentation) {
      errors.push({
        field: 'presentation',
        message: 'Presentation configuration is required',
        severity: 'error',
      });
      return errors;
    }

    if (!pattern.presentation.layout) {
      errors.push({
        field: 'presentation.layout',
        message: 'Layout type is required',
        severity: 'error',
      });
    }

    if (!pattern.presentation.components || pattern.presentation.components.length === 0) {
      errors.push({
        field: 'presentation.components',
        message: 'At least one component is required',
        severity: 'error',
      });
    } else {
      // Validate each component
      const componentIds = new Set<string>();
      const componentErrors = this.validateComponents(
        pattern.presentation.components,
        componentIds,
        'presentation.components'
      );
      errors.push(...componentErrors);
    }

    if (!pattern.presentation.template) {
      errors.push({
        field: 'presentation.template',
        message: 'Template path is required',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Validate component definitions recursively
   */
  private validateComponents(
    components: ComponentDefinition[],
    componentIds: Set<string>,
    path: string
  ): PatternValidationResult['errors'] {
    const errors: PatternValidationResult['errors'] = [];

    components.forEach((component, index) => {
      const componentPath = `${path}[${index}]`;

      if (!component.type) {
        errors.push({
          field: `${componentPath}.type`,
          message: 'Component type is required',
          severity: 'error',
        });
      }

      if (!component.id) {
        errors.push({
          field: `${componentPath}.id`,
          message: 'Component ID is required',
          severity: 'error',
        });
      } else if (componentIds.has(component.id)) {
        errors.push({
          field: `${componentPath}.id`,
          message: `Duplicate component ID: ${component.id}`,
          severity: 'error',
        });
      } else {
        componentIds.add(component.id);
      }

      // Validate children recursively
      if (component.children) {
        const childErrors = this.validateComponents(
          component.children,
          componentIds,
          `${componentPath}.children`
        );
        errors.push(...childErrors);
      }
    });

    return errors;
  }

  /**
   * Validate interaction configuration
   */
  private validateInteraction(pattern: Pattern): PatternValidationResult['errors'] {
    const errors: PatternValidationResult['errors'] = [];

    if (!pattern.interaction) {
      errors.push({
        field: 'interaction',
        message: 'Interaction configuration is required',
        severity: 'error',
      });
      return errors;
    }

    if (!pattern.interaction.triggers || pattern.interaction.triggers.length === 0) {
      errors.push({
        field: 'interaction.triggers',
        message: 'At least one trigger is required',
        severity: 'warning',
      });
    } else {
      // Validate each trigger
      pattern.interaction.triggers.forEach((trigger, index) => {
        const triggerPath = `interaction.triggers[${index}]`;

        if (!trigger.event) {
          errors.push({
            field: `${triggerPath}.event`,
            message: 'Trigger event is required',
            severity: 'error',
          });
        }

        if (!trigger.target) {
          errors.push({
            field: `${triggerPath}.target`,
            message: 'Trigger target is required',
            severity: 'error',
          });
        }

        if (!trigger.action) {
          errors.push({
            field: `${triggerPath}.action`,
            message: 'Trigger action is required',
            severity: 'error',
          });
        }
      });
    }

    if (!pattern.interaction.navigation) {
      errors.push({
        field: 'interaction.navigation',
        message: 'Navigation map is required',
        severity: 'error',
      });
    } else {
      if (!pattern.interaction.navigation.next || pattern.interaction.navigation.next.length === 0) {
        errors.push({
          field: 'interaction.navigation.next',
          message: 'Navigation "next" steps are required',
          severity: 'error',
        });
      }
    }

    // Validate validations if present
    if (pattern.interaction.validations) {
      pattern.interaction.validations.forEach((validation, index) => {
        const validationPath = `interaction.validations[${index}]`;

        if (!validation.field) {
          errors.push({
            field: `${validationPath}.field`,
            message: 'Validation field is required',
            severity: 'error',
          });
        }

        if (!validation.rule) {
          errors.push({
            field: `${validationPath}.rule`,
            message: 'Validation rule is required',
            severity: 'error',
          });
        }

        if (!validation.message) {
          errors.push({
            field: `${validationPath}.message`,
            message: 'Validation message is required',
            severity: 'error',
          });
        }
      });
    }

    return errors;
  }

  /**
   * Validate resolution configuration
   */
  private validateResolution(pattern: Pattern): PatternValidationResult['errors'] {
    const errors: PatternValidationResult['errors'] = [];

    if (!pattern.resolution) {
      errors.push({
        field: 'resolution',
        message: 'Resolution configuration is required',
        severity: 'error',
      });
      return errors;
    }

    // Validate success outcome
    if (!pattern.resolution.success) {
      errors.push({
        field: 'resolution.success',
        message: 'Success outcome is required',
        severity: 'error',
      });
    } else {
      const successErrors = this.validateOutcome(pattern.resolution.success, 'resolution.success');
      errors.push(...successErrors);
    }

    // Validate error outcome
    if (!pattern.resolution.error) {
      errors.push({
        field: 'resolution.error',
        message: 'Error outcome is required',
        severity: 'error',
      });
    } else {
      const errorErrors = this.validateOutcome(pattern.resolution.error, 'resolution.error');
      errors.push(...errorErrors);
    }

    // Validate cancel outcome if present
    if (pattern.resolution.cancel) {
      const cancelErrors = this.validateOutcome(pattern.resolution.cancel, 'resolution.cancel');
      errors.push(...cancelErrors);
    }

    return errors;
  }

  /**
   * Validate a resolution outcome
   */
  private validateOutcome(
    outcome: Pattern['resolution']['success'],
    path: string
  ): PatternValidationResult['errors'] {
    const errors: PatternValidationResult['errors'] = [];

    if (!outcome.action) {
      errors.push({
        field: `${path}.action`,
        message: 'Outcome action is required',
        severity: 'error',
      });
    }

    if (!outcome.events || outcome.events.length === 0) {
      errors.push({
        field: `${path}.events`,
        message: 'At least one event is required',
        severity: 'warning',
      });
    }

    // Validate feedback if present
    if (outcome.feedback) {
      if (!outcome.feedback.type) {
        errors.push({
          field: `${path}.feedback.type`,
          message: 'Feedback type is required',
          severity: 'error',
        });
      }

      if (!outcome.feedback.message) {
        errors.push({
          field: `${path}.feedback.message`,
          message: 'Feedback message is required',
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Validate cross-references between sections
   */
  private validateCrossReferences(pattern: Pattern): PatternValidationResult['errors'] {
    const errors: PatternValidationResult['errors'] = [];

    // Collect all component IDs
    const componentIds = new Set<string>();
    const collectIds = (components: ComponentDefinition[]) => {
      components.forEach((component) => {
        componentIds.add(component.id);
        if (component.children) {
          collectIds(component.children);
        }
      });
    };
    collectIds(pattern.presentation.components);

    // Validate trigger targets
    if (pattern.interaction.triggers) {
      pattern.interaction.triggers.forEach((trigger, index) => {
        if (trigger.target && !componentIds.has(trigger.target)) {
          errors.push({
            field: `interaction.triggers[${index}].target`,
            message: `Trigger target "${trigger.target}" does not reference a valid component ID`,
            severity: 'error',
          });
        }
      });
    }

    // Validate validation fields
    if (pattern.interaction.validations) {
      pattern.interaction.validations.forEach((validation, index) => {
        if (validation.field && !componentIds.has(validation.field)) {
          errors.push({
            field: `interaction.validations[${index}].field`,
            message: `Validation field "${validation.field}" does not reference a valid component ID`,
            severity: 'error',
          });
        }
      });
    }

    return errors;
  }

  /**
   * Validate metadata (warnings only)
   */
  private validateMetadata(pattern: Pattern): PatternValidationResult['warnings'] {
    const warnings: PatternValidationResult['warnings'] = [];

    if (!pattern.metadata) {
      warnings.push({
        field: 'metadata',
        message: 'Metadata is recommended',
      });
      return warnings;
    }

    if (!pattern.metadata.status) {
      warnings.push({
        field: 'metadata.status',
        message: 'Status is recommended (draft, stable, deprecated)',
      });
    }

    if (!pattern.metadata.version) {
      warnings.push({
        field: 'metadata.version',
        message: 'Version is recommended (use semver)',
      });
    }

    if (pattern.metadata.version && !pattern.metadata.version.match(/^\d+\.\d+\.\d+$/)) {
      warnings.push({
        field: 'metadata.version',
        message: 'Version should follow semver format (e.g., 1.0.0)',
      });
    }

    if (pattern.metadata.mcp_compatible === undefined) {
      warnings.push({
        field: 'metadata.mcp_compatible',
        message: 'MCP compatibility flag is recommended',
      });
    }

    return warnings;
  }
}

/**
 * Singleton validator instance
 */
export const patternValidator = new PatternValidator();
