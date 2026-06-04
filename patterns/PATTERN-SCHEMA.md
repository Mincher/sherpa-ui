# Sherpa Patterns v2.0 Schema

**Behavior-Driven Pattern System**

Sherpa patterns are not static layouts — they are prescribed **presentation-interaction-resolution** paradigms that enable AI generation, testing, and validation.

---

## Pattern Philosophy

A pattern consists of three interconnected parts:

1. **Presentation** — Visual layout and component composition
2. **Interaction** — User actions, validations, and navigation flows
3. **Resolution** — Expected outcomes with feedback and events

This structure enables:
- ✅ AI-generated complete implementations (not just HTML)
- ✅ Testable and validatable patterns
- ✅ Consistent event handling and outcomes
- ✅ MCP server integration
- ✅ Agent skill support

---

## Pattern Schema

### TypeScript Interfaces

See [pattern-schema.ts](./pattern-schema.ts) for complete type definitions.

```typescript
interface Pattern {
  id: string;
  name: string;
  category: 'layouts' | 'flows' | 'feedback' | 'data' | 'forms' | 'navigation';
  description: string;
  presentation: PresentationConfig;
  interaction: InteractionConfig;
  resolution: ResolutionConfig;
  metadata: PatternMetadata;
}
```

---

## Example Pattern: Add Entity Flow

### Complete Definition

```json
{
  "id": "add-entity-flow",
  "name": "Add Entity Flow",
  "category": "flows",
  "description": "Complete flow for adding a new entity with validation and feedback",
  
  "presentation": {
    "layout": "dialog",
    "components": [
      {
        "type": "sherpa-dialog",
        "id": "add-dialog",
        "attributes": {
          "data-size": "medium",
          "data-open": true
        },
        "children": [
          {
            "type": "sherpa-input-text",
            "id": "name-input",
            "attributes": {
              "data-label": "Name",
              "data-required": true,
              "data-placeholder": "Enter name"
            },
            "required": true
          },
          {
            "type": "sherpa-input-text",
            "id": "description-input",
            "attributes": {
              "data-label": "Description",
              "data-placeholder": "Optional description"
            }
          },
          {
            "type": "sherpa-container-footer",
            "id": "dialog-footer",
            "children": [
              {
                "type": "sherpa-button",
                "id": "cancel-btn",
                "attributes": {
                  "data-variant": "secondary",
                  "data-label": "Cancel"
                }
              },
              {
                "type": "sherpa-button",
                "id": "submit-btn",
                "attributes": {
                  "data-variant": "primary",
                  "data-label": "Create"
                }
              }
            ]
          }
        ]
      }
    ],
    "template": "patterns/flows/add.html"
  },
  
  "interaction": {
    "triggers": [
      {
        "event": "click",
        "target": "submit-btn",
        "action": "validate_and_submit"
      },
      {
        "event": "click",
        "target": "cancel-btn",
        "action": "cancel_flow"
      },
      {
        "event": "dialog-close",
        "target": "add-dialog",
        "action": "cancel_flow"
      },
      {
        "event": "keydown",
        "target": "add-dialog",
        "action": "handle_keyboard",
        "condition": "event.key === 'Enter'"
      }
    ],
    
    "validations": [
      {
        "field": "name-input",
        "rule": "required",
        "message": "Name is required",
        "trigger": "blur"
      },
      {
        "field": "name-input",
        "rule": "minLength:3",
        "message": "Name must be at least 3 characters",
        "trigger": "blur"
      },
      {
        "field": "name-input",
        "rule": "maxLength:100",
        "message": "Name must be less than 100 characters",
        "trigger": "blur"
      }
    ],
    
    "navigation": {
      "next": ["validate", "submit", "close_dialog"],
      "cancel": ["close_dialog"],
      "error": ["show_message", "focus_invalid_field"]
    },
    
    "shortcuts": [
      {
        "key": "Enter",
        "action": "validate_and_submit",
        "description": "Submit form"
      },
      {
        "key": "Escape",
        "action": "cancel_flow",
        "description": "Cancel and close"
      }
    ]
  },
  
  "resolution": {
    "success": {
      "action": "close_dialog",
      "events": ["entity:created"],
      "feedback": {
        "type": "toast",
        "message": "Entity created successfully",
        "status": "success",
        "duration": 3000
      },
      "navigation": "refresh_list"
    },
    
    "cancel": {
      "action": "close_dialog",
      "events": ["flow:cancelled"]
    },
    
    "error": {
      "action": "show_message",
      "events": ["validation:failed", "api:error"],
      "feedback": {
        "type": "callout",
        "message": "Failed to create entity. Please check the form and try again.",
        "status": "critical"
      }
    }
  },
  
  "metadata": {
    "status": "stable",
    "version": "1.0.0",
    "mcp_compatible": true,
    "agent_skill": "patterns/skills/add-entity.js",
    "author": "Sherpa Team",
    "updated": "2026-06-04",
    "tags": ["form", "dialog", "crud", "create"]
  },
  
  "examples": [
    {
      "title": "Add User",
      "description": "Create a new user account",
      "data": {
        "entityType": "User",
        "fields": {
          "name": { "label": "Username", "required": true },
          "email": { "label": "Email Address", "required": true }
        }
      }
    },
    {
      "title": "Add Device",
      "description": "Register a new device",
      "data": {
        "entityType": "Device",
        "fields": {
          "name": { "label": "Device Name", "required": true },
          "type": { "label": "Device Type", "required": true }
        }
      }
    }
  ]
}
```

---

## Using Patterns

### 1. Manual Implementation

Read the pattern definition and implement according to the schema:

```html
<sherpa-dialog id="add-dialog" data-size="medium" data-open>
  <sherpa-input-text
    id="name-input"
    data-label="Name"
    data-required
    data-placeholder="Enter name">
  </sherpa-input-text>
  
  <sherpa-container-footer>
    <sherpa-button id="cancel-btn" data-variant="secondary" data-label="Cancel"></sherpa-button>
    <sherpa-button id="submit-btn" data-variant="primary" data-label="Create"></sherpa-button>
  </sherpa-container-footer>
</sherpa-dialog>

<script>
  const dialog = document.getElementById('add-dialog');
  const nameInput = document.getElementById('name-input');
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  
  // Interaction logic
  submitBtn.addEventListener('click', async () => {
    // Validate
    if (!nameInput.value || nameInput.value.length < 3) {
      // Show error feedback
      return;
    }
    
    // Submit
    try {
      await createEntity({ name: nameInput.value });
      
      // Success resolution
      dialog.close();
      dispatchEvent(new CustomEvent('entity:created'));
      showToast('Entity created successfully', 'success');
    } catch (error) {
      // Error resolution
      showCallout('Failed to create entity', 'critical');
      dispatchEvent(new CustomEvent('api:error'));
    }
  });
  
  cancelBtn.addEventListener('click', () => {
    // Cancel resolution
    dialog.close();
    dispatchEvent(new CustomEvent('flow:cancelled'));
  });
</script>
```

---

### 2. AI-Generated Implementation

Use the MCP server or agent skill to generate the complete implementation:

```typescript
// Via MCP
const result = await generatePattern({
  patternId: 'add-entity-flow',
  data: {
    entityType: 'User',
    fields: {
      name: { "label": 'Username', required: true },
      email: { label: 'Email Address', required: true },
    },
  },
});

// result.html contains generated markup
// result.js contains interaction logic
// result.listeners contains event handlers
```

---

### 3. Pattern Generator (Planned)

```typescript
import { PatternGenerator } from '@sherpa-ui/patterns';

const generator = new PatternGenerator();
const implementation = await generator.generate({
  patternId: 'add-entity-flow',
  data: { /* ... */ },
  target: document.getElementById('app'),
  options: {
    includeInteraction: true,
    includeValidation: true,
    includeFeedback: true,
  },
});

// Auto-attaches to target with all event handlers
```

---

## Pattern Validation

Validate patterns before using them:

```typescript
import { patternValidator } from './pattern-validator';
import pattern from './flows/add-entity.json';

const result = patternValidator.validate(pattern);

if (!result.valid) {
  console.error('Pattern validation failed:', result.errors);
} else {
  console.log('Pattern is valid!');
  if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
  }
}
```

---

## Pattern Categories

### Flows (CRUD Operations)
- `add-entity-flow` — Create new entity with validation
- `edit-entity-flow` — Update existing entity
- `delete-entity-flow` — Delete entity with confirmation

### Feedback (User Communication)
- `confirmation-dialog` — Confirm destructive action
- `empty-state` — No data placeholder
- `loading-state` — Loading indicator

### Layouts (Page Structures)
- `app-shell` — Full application frame
- `list-view` — Filterable list with pagination
- `detail-view` — Single item detail page
- `dashboard-grid` — Metric cards + visualizations
- `settings-form` — Grouped form sections
- `view-with-rails` — Content with side panels

### Forms (Data Entry)
- `inline-edit-form` — Edit in place
- `multi-step-form` — Wizard-style form
- `search-filter-form` — Search with filters

### Navigation (Movement)
- `breadcrumb-nav` — Hierarchical navigation
- `tab-navigation` — Tabbed interface
- `stepper-nav` — Multi-step progress

---

## Creating New Patterns

### 1. Define Pattern Schema

Create a JSON file following the pattern schema:

```json
{
  "id": "my-new-pattern",
  "name": "My New Pattern",
  "category": "flows",
  "description": "Description of what this pattern does",
  "presentation": { /* ... */ },
  "interaction": { /* ... */ },
  "resolution": { /* ... */ },
  "metadata": { /* ... */ }
}
```

### 2. Validate Pattern

```bash
npm run validate-pattern patterns/flows/my-new-pattern.json
```

### 3. Create HTML Template

Create the HTML template file referenced in `presentation.template`:

```html
<!-- patterns/flows/my-new-pattern.html -->
<template id="my-new-pattern">
  <!-- Component markup -->
</template>
```

### 4. Test Pattern

Write tests for the pattern:

```typescript
describe('My New Pattern', () => {
  it('should generate valid HTML', async () => {
    const result = await generatePattern({
      patternId: 'my-new-pattern',
      data: { /* test data */ },
    });
    
    expect(result.html).toContain('expected-element');
  });
  
  it('should handle success outcome', async () => {
    // Test success flow
  });
  
  it('should handle error outcome', async () => {
    // Test error flow
  });
});
```

### 5. Register Pattern

Add pattern to `patterns/index.json`:

```json
{
  "patterns": [
    {
      "id": "my-new-pattern",
      "file": "patterns/flows/my-new-pattern.json"
    }
  ]
}
```

---

## Pattern Best Practices

### Presentation
- ✅ Use semantic component types
- ✅ Provide unique IDs for all interactive components
- ✅ Mark required components with `required: true`
- ✅ Use consistent attribute naming (data-* prefix)
- ❌ Don't hardcode dimensions (use responsive sizing)
- ❌ Don't inline styles (reference CSS classes)

### Interaction
- ✅ Define all user actions as triggers
- ✅ Include validation rules for inputs
- ✅ Provide clear navigation flows
- ✅ Add keyboard shortcuts for accessibility
- ❌ Don't forget error handling
- ❌ Don't skip validation triggers

### Resolution
- ✅ Define success, cancel, and error outcomes
- ✅ Specify events to dispatch
- ✅ Provide user feedback for all outcomes
- ✅ Include navigation targets
- ❌ Don't leave outcomes undefined
- ❌ Don't forget to close dialogs/modals

### Metadata
- ✅ Use semantic versioning (1.0.0)
- ✅ Mark status accurately (draft/stable/deprecated)
- ✅ Enable MCP compatibility when possible
- ✅ Add descriptive tags
- ❌ Don't forget to update version on changes
- ❌ Don't skip documentation

---

## Migration from v1.0

### Old Pattern (Static HTML)

```html
<!-- patterns/flows/add.html -->
<template id="add-flow">
  <sherpa-dialog>
    <sherpa-input-text data-label="Name"></sherpa-input-text>
    <sherpa-button data-label="Submit"></sherpa-button>
  </sherpa-dialog>
</template>
```

### New Pattern (Behavior-Driven)

```json
{
  "id": "add-entity-flow",
  "presentation": { /* HTML structure */ },
  "interaction": { /* Event handling */ },
  "resolution": { /* Outcomes */ },
  "metadata": { /* Status, version */ }
}
```

### Migration Steps

1. Keep HTML template file (referenced in `presentation.template`)
2. Create JSON pattern definition
3. Add interaction logic (triggers, validations, navigation)
4. Define resolution outcomes (success, cancel, error)
5. Add metadata (status, version, MCP compatibility)
6. Validate new pattern
7. Test generation

---

## Roadmap

### Phase 1: Schema & Validation ✅ COMPLETE
- [x] TypeScript pattern schema
- [x] Pattern validator
- [x] Documentation with examples

### Phase 2: Proof-of-Concept (Next)
- [ ] Convert add-flow to new schema
- [ ] Implement pattern generator
- [ ] Test MCP generation

### Phase 3: Migration (Planned)
- [ ] Convert all 13 existing patterns
- [ ] Add interaction logic
- [ ] Test each pattern

### Phase 4: MCP Integration (Planned)
- [ ] Enhanced MCP tools
- [ ] Pattern simulation
- [ ] Pattern testing utilities

### Phase 5: Agent Skills (Planned)
- [ ] Agent skill framework
- [ ] Skill definitions for patterns
- [ ] AI generation testing

### Phase 6: Tooling (Planned)
- [ ] Pattern playground (visual builder)
- [ ] Pattern documentation site
- [ ] VS Code extension

---

## Resources

- **Schema:** [pattern-schema.ts](./pattern-schema.ts)
- **Validator:** [pattern-validator.ts](./pattern-validator.ts)
- **Examples:** [flows/](./flows/), [layouts/](./layouts/), [feedback/](./feedback/)
- **Original v1.0 README:** [README.md](./README.md)

---

**Status:** v2.0 Schema Definition Complete (Phase 1)  
**Next:** Proof-of-Concept Implementation (Phase 2)  
**Updated:** June 4, 2026
