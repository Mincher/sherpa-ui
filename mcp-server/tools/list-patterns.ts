/**
 * MCP Tool: list_patterns
 *
 * Lists available patterns with optional filtering.
 */

import { patternRegistry } from '../../patterns/pattern-registry.js';

export const listPatterns = {
  name: 'list_patterns',
  description: `List available Sherpa UI patterns with optional filtering.

Patterns are behavior-driven definitions that include:
- Presentation: Visual layout and components
- Interaction: Event handlers, validations, navigation
- Resolution: Success/cancel/error outcomes with feedback

Use this to discover what patterns are available before generating them.`,

  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category',
        enum: ['flows', 'layouts', 'feedback', 'forms', 'navigation', 'data'],
      },
      status: {
        type: 'string',
        description: 'Filter by status',
        enum: ['draft', 'stable', 'deprecated'],
      },
      tags: {
        type: 'array',
        description: 'Filter by tags',
        items: { type: 'string' },
      },
      mcpCompatibleOnly: {
        type: 'boolean',
        description: 'Show only MCP-compatible patterns (v2.0+)',
        default: false,
      },
    },
  },

  async execute(args: {
    category?: string;
    status?: string;
    tags?: string[];
    mcpCompatibleOnly?: boolean;
  }) {
    try {
      let patterns = await patternRegistry.list({
        category: args.category,
        status: args.status,
        tags: args.tags,
      });

      // Filter MCP-compatible if requested
      if (args.mcpCompatibleOnly) {
        patterns = patterns.filter((p) => p.metadata.mcp_compatible);
      }

      // Group by category
      const grouped: Record<string, typeof patterns> = {};
      for (const pattern of patterns) {
        if (!grouped[pattern.category]) {
          grouped[pattern.category] = [];
        }
        grouped[pattern.category].push(pattern);
      }

      // Format output
      let output = '# Available Sherpa UI Patterns\n\n';
      output += `**Total:** ${patterns.length} patterns\n`;
      output += `**MCP-Compatible:** ${patterns.filter((p) => p.metadata.mcp_compatible).length} patterns\n\n`;

      output += '---\n\n';

      for (const [category, categoryPatterns] of Object.entries(grouped)) {
        output += `## ${category.charAt(0).toUpperCase() + category.slice(1)} (${categoryPatterns.length})\n\n`;

        for (const pattern of categoryPatterns) {
          output += `### ${pattern.name}\n`;
          output += `- **ID:** \`${pattern.id}\`\n`;
          output += `- **Status:** ${pattern.metadata.status}`;
          if (pattern.metadata.mcp_compatible) {
            output += ' ✅ MCP-compatible';
          }
          output += '\n';
          output += `- **Version:** ${pattern.metadata.version}\n`;
          output += `- **Description:** ${pattern.description}\n`;

          if (pattern.metadata.tags && pattern.metadata.tags.length > 0) {
            output += `- **Tags:** ${pattern.metadata.tags.join(', ')}\n`;
          }

          // Show components
          const componentCount = this.countComponents(pattern.presentation.components);
          output += `- **Components:** ${componentCount} components\n`;

          // Show interaction summary
          output += `- **Interaction:** ${pattern.interaction.triggers.length} triggers, ${pattern.interaction.validations?.length || 0} validations\n`;

          // Show examples
          if (pattern.examples && pattern.examples.length > 0) {
            output += `- **Examples:** ${pattern.examples.length} (${pattern.examples.map((e) => e.title).join(', ')})\n`;
          }

          output += '\n';
        }
      }

      output += '---\n\n';
      output += '## Usage\n\n';
      output += 'Use the `generate_pattern` tool to generate a complete implementation:\n\n';
      output += '```\n';
      output += 'generate_pattern({\n';
      output += '  patternId: "add-entity-flow",\n';
      output += '  data: {\n';
      output += '    entityType: "User",\n';
      output += '    fields: [...]\n';
      output += '  }\n';
      output += '})\n';
      output += '```\n';

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing patterns: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },

  countComponents(components: any[]): number {
    return components.reduce((count, component) => {
      return count + 1 + (component.children ? this.countComponents(component.children) : 0);
    }, 0);
  },
};
