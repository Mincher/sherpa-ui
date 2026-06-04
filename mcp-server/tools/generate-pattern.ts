/**
 * MCP Tool: generate_pattern
 *
 * Generates complete pattern implementation from pattern definition.
 * Returns HTML markup, JavaScript interaction logic, and event handlers.
 */

import { patternRegistry } from '../../patterns/pattern-registry.js';
import type { PatternGenerationContext } from '../../patterns/pattern-schema.js';

export const generatePattern = {
  name: 'generate_pattern',
  description: `Generate a complete pattern implementation with HTML, JavaScript, validation, and event handling.

Behavior-driven patterns follow the presentation-interaction-resolution paradigm:
- Presentation: Visual layout and component composition
- Interaction: User actions, validations, navigation flows
- Resolution: Expected outcomes (success, cancel, error) with feedback

Use this tool to generate complete interactive flows, not just static HTML.`,

  inputSchema: {
    type: 'object',
    properties: {
      patternId: {
        type: 'string',
        description: 'Pattern ID to generate (e.g., "add-entity-flow", "edit-entity-flow", "delete-entity-flow")',
      },
      data: {
        type: 'object',
        description: 'Data to populate the pattern (entity type, field definitions, labels, etc.)',
        properties: {
          entityType: {
            type: 'string',
            description: 'Type of entity (e.g., "User", "Device", "Task")',
          },
          entityName: {
            type: 'string',
            description: 'Entity name for variable naming (e.g., "user", "device")',
          },
          dialogTitle: {
            type: 'string',
            description: 'Dialog title (e.g., "Add User", "Edit Device")',
          },
          triggerLabel: {
            type: 'string',
            description: 'Trigger button label',
          },
          fields: {
            type: 'array',
            description: 'Form fields configuration',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                label: { type: 'string' },
                name: { type: 'string' },
                required: { type: 'boolean' },
                placeholder: { type: 'string' },
                value: { type: 'string' },
              },
            },
          },
          successMessage: {
            type: 'string',
            description: 'Success feedback message',
          },
          errorMessage: {
            type: 'string',
            description: 'Error feedback message',
          },
        },
      },
      options: {
        type: 'object',
        description: 'Generation options',
        properties: {
          includeInteraction: {
            type: 'boolean',
            description: 'Include interaction logic (default: true)',
            default: true,
          },
          includeValidation: {
            type: 'boolean',
            description: 'Include validation (default: true)',
            default: true,
          },
          includeFeedback: {
            type: 'boolean',
            description: 'Include user feedback (default: true)',
            default: true,
          },
        },
      },
    },
    required: ['patternId', 'data'],
  },

  async execute(args: {
    patternId: string;
    data: Record<string, any>;
    options?: {
      includeInteraction?: boolean;
      includeValidation?: boolean;
      includeFeedback?: boolean;
    };
  }) {
    try {
      // Load pattern
      const pattern = await patternRegistry.load(args.patternId);

      // Generate implementation
      const context: PatternGenerationContext = {
        patternId: args.patternId,
        data: args.data,
        options: {
          includeInteraction: args.options?.includeInteraction !== false,
          includeValidation: args.options?.includeValidation !== false,
          includeFeedback: args.options?.includeFeedback !== false,
        },
      };

      const result = await patternRegistry.generate(context);

      return {
        content: [
          {
            type: 'text',
            text: `# Generated Pattern: ${pattern.name}

## Pattern Information
- **ID:** ${pattern.id}
- **Category:** ${pattern.category}
- **Version:** ${pattern.metadata.version}
- **Status:** ${pattern.metadata.status}

## Description
${pattern.description}

---

## Generated HTML

\`\`\`html
${result.html}
\`\`\`

---

## Generated JavaScript

\`\`\`javascript
${result.js}
\`\`\`

---

## Usage Instructions

### 1. Add HTML to your page
Copy the generated HTML above into your application.

### 2. Add JavaScript logic
Copy the generated JavaScript to handle interaction and events.

### 3. Implement API calls
Replace the \`// TODO: Call API\` comments with actual API calls:

\`\`\`javascript
// Example for ${args.data.entityType || 'entity'}
async function save${args.data.entityType || 'Entity'}(data) {
  const response = await fetch('/api/${(args.data.entityName || 'entity').toLowerCase()}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}
\`\`\`

### 4. Listen for events
The pattern dispatches these events:
${pattern.resolution.success.events.map((e) => `- \`${e}\``).join('\n')}

### 5. Customize feedback
Feedback messages can be customized:
- Success: "${pattern.resolution.success.feedback?.message || 'Operation successful'}"
- Error: "${pattern.resolution.error.feedback?.message || 'Operation failed'}"

---

## Pattern Features

### Presentation
- Layout: ${pattern.presentation.layout}
- Components: ${pattern.presentation.components.length} components

### Interaction
- Triggers: ${pattern.interaction.triggers.length} event handlers
- Validations: ${pattern.interaction.validations?.length || 0} validation rules
- Keyboard shortcuts: ${pattern.interaction.shortcuts?.length || 0} shortcuts

### Resolution
- Success outcome: ${pattern.resolution.success.action}
- Cancel outcome: ${pattern.resolution.cancel?.action || 'N/A'}
- Error outcome: ${pattern.resolution.error.action}

---

## Next Steps

1. Copy the HTML and JavaScript to your application
2. Implement API integration
3. Test the complete flow
4. Customize styling if needed

**Generated with Sherpa Pattern System v2.0**
`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating pattern: ${error instanceof Error ? error.message : String(error)}

Available patterns:
- add-entity-flow
- edit-entity-flow
- delete-entity-flow

Use list_patterns tool to see all available patterns.`,
          },
        ],
        isError: true,
      };
    }
  },
};
