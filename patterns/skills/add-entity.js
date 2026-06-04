/**
 * Agent Skill: add-entity
 *
 * Generates a complete add-entity flow with dialog, validation, and feedback.
 * Uses the add-entity-flow pattern with intelligent field mapping.
 */

/**
 * Generate an add-entity flow for a specific entity type
 *
 * @param {Object} params - Skill parameters
 * @param {string} params.entityType - Entity type (e.g., "User", "Device", "Task")
 * @param {Array} params.fields - Field definitions
 * @param {Object} [params.options] - Optional configuration
 * @returns {Promise<Object>} Generated pattern implementation
 */
export async function generateAddEntity(params) {
  const { entityType, fields, options = {} } = params;

  // Validate inputs
  if (!entityType) {
    throw new Error('entityType is required');
  }

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    throw new Error('fields array is required and must not be empty');
  }

  // Map fields to pattern format
  const patternFields = fields.map((field, index) => {
    const fieldId = field.id || `${field.name}-input`;
    const fieldType = inferFieldType(field);

    return {
      id: fieldId,
      type: fieldType,
      label: field.label || capitalizeFirst(field.name),
      name: field.name,
      required: field.required !== false, // default to true
      placeholder: field.placeholder || `Enter ${field.label || field.name}`,
      validations: buildValidations(field),
    };
  });

  // Prepare pattern data
  const entityName = entityType.toLowerCase().replace(/\s+/g, '-');
  const patternData = {
    entityType,
    entityName,
    dialogTitle: options.dialogTitle || `Add ${entityType}`,
    triggerLabel: options.triggerLabel || `Add ${entityType}`,
    fields: patternFields,
    successMessage: options.successMessage || `${entityType} created successfully`,
    errorMessage: options.errorMessage || `Failed to create ${entityType}`,
  };

  // Return MCP tool call format
  return {
    tool: 'generate_pattern',
    arguments: {
      patternId: 'add-entity-flow',
      entityType,
      entityName,
      fields: patternFields,
      customData: patternData,
    },
  };
}

/**
 * Infer Sherpa component type from field definition
 */
function inferFieldType(field) {
  if (field.type) {
    // Map common types to Sherpa components
    const typeMap = {
      'text': 'sherpa-input-text',
      'email': 'sherpa-input-text',
      'password': 'sherpa-input-text',
      'number': 'sherpa-input-text',
      'tel': 'sherpa-input-text',
      'url': 'sherpa-input-text',
      'textarea': 'sherpa-input-textarea',
      'select': 'sherpa-input-select',
      'date': 'sherpa-input-date',
      'datetime': 'sherpa-input-datetime',
      'time': 'sherpa-input-time',
      'checkbox': 'sherpa-input-checkbox',
      'radio': 'sherpa-input-radio',
      'switch': 'sherpa-switch',
    };

    return typeMap[field.type.toLowerCase()] || 'sherpa-input-text';
  }

  // Infer from field name
  const name = field.name.toLowerCase();
  if (name.includes('email')) return 'sherpa-input-text';
  if (name.includes('password')) return 'sherpa-input-text';
  if (name.includes('phone') || name.includes('tel')) return 'sherpa-input-text';
  if (name.includes('url') || name.includes('website')) return 'sherpa-input-text';
  if (name.includes('description') || name.includes('notes') || name.includes('comment')) {
    return 'sherpa-input-textarea';
  }
  if (name.includes('date')) return 'sherpa-input-date';
  if (name.includes('time')) return 'sherpa-input-time';
  if (name.includes('select') || name.includes('type') || name.includes('status')) {
    return 'sherpa-input-select';
  }

  // Default
  return 'sherpa-input-text';
}

/**
 * Build validation rules from field definition
 */
function buildValidations(field) {
  const validations = [];

  // Required validation
  if (field.required) {
    validations.push({
      rule: 'required',
      message: `${field.label || field.name} is required`,
      trigger: 'submit',
    });
  }

  // Type-specific validations
  if (field.type === 'email' || field.name.toLowerCase().includes('email')) {
    validations.push({
      rule: 'email',
      message: 'Must be a valid email address',
      trigger: 'blur',
    });
  }

  if (field.type === 'url' || field.name.toLowerCase().includes('url')) {
    validations.push({
      rule: 'pattern:^https?://.+',
      message: 'Must be a valid URL',
      trigger: 'blur',
    });
  }

  // Min/max length
  if (field.minLength) {
    validations.push({
      rule: `minLength:${field.minLength}`,
      message: `Must be at least ${field.minLength} characters`,
      trigger: 'blur',
    });
  }

  if (field.maxLength) {
    validations.push({
      rule: `maxLength:${field.maxLength}`,
      message: `Must be less than ${field.maxLength} characters`,
      trigger: 'blur',
    });
  }

  // Custom pattern
  if (field.pattern) {
    validations.push({
      rule: `pattern:${field.pattern}`,
      message: field.patternMessage || 'Invalid format',
      trigger: 'blur',
    });
  }

  // Custom validations
  if (field.validations && Array.isArray(field.validations)) {
    validations.push(...field.validations);
  }

  return validations;
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Skill metadata
 */
export const addEntitySkill = {
  name: 'add-entity',
  description: 'Generate a complete add-entity flow with dialog, form fields, validation, and feedback',
  pattern: 'add-entity-flow',
  version: '1.0.0',
  author: 'Sherpa Team',

  /**
   * Skill entry point
   */
  async execute(params) {
    return await generateAddEntity(params);
  },

  /**
   * Skill schema for validation
   */
  schema: {
    entityType: {
      type: 'string',
      required: true,
      description: 'Type of entity (e.g., "User", "Device", "Task")',
    },
    fields: {
      type: 'array',
      required: true,
      description: 'Field definitions',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          label: { type: 'string' },
          type: { type: 'string' },
          required: { type: 'boolean', default: true },
          placeholder: { type: 'string' },
          minLength: { type: 'number' },
          maxLength: { type: 'number' },
          pattern: { type: 'string' },
          patternMessage: { type: 'string' },
          validations: { type: 'array' },
        },
      },
    },
    options: {
      type: 'object',
      properties: {
        dialogTitle: { type: 'string' },
        triggerLabel: { type: 'string' },
        successMessage: { type: 'string' },
        errorMessage: { type: 'string' },
      },
    },
  },

  /**
   * Example usage
   */
  examples: [
    {
      title: 'Add User',
      params: {
        entityType: 'User',
        fields: [
          {
            name: 'username',
            label: 'Username',
            required: true,
            minLength: 3,
            maxLength: 50,
            pattern: '^[a-zA-Z0-9_]+$',
            patternMessage: 'Username can only contain letters, numbers, and underscores',
          },
          {
            name: 'email',
            label: 'Email Address',
            type: 'email',
            required: true,
          },
          {
            name: 'role',
            label: 'Role',
            type: 'select',
            required: true,
          },
        ],
      },
    },
    {
      title: 'Add Device',
      params: {
        entityType: 'Device',
        fields: [
          {
            name: 'deviceName',
            label: 'Device Name',
            required: true,
          },
          {
            name: 'deviceType',
            label: 'Device Type',
            type: 'select',
            required: true,
          },
          {
            name: 'ipAddress',
            label: 'IP Address',
            pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',
            patternMessage: 'Must be a valid IP address',
          },
        ],
        options: {
          dialogTitle: 'Register Device',
          triggerLabel: 'Add Device',
        },
      },
    },
    {
      title: 'Add Task',
      params: {
        entityType: 'Task',
        fields: [
          {
            name: 'title',
            label: 'Task Title',
            required: true,
            maxLength: 200,
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
          },
          {
            name: 'priority',
            label: 'Priority',
            type: 'select',
            required: true,
          },
          {
            name: 'dueDate',
            label: 'Due Date',
            type: 'date',
          },
        ],
      },
    },
  ],
};

// Export both the skill definition and the generator function
export default addEntitySkill;
