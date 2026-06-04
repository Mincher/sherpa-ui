/**
 * Pattern Schema v1.0
 *
 * Defines behavior-driven patterns with presentation-interaction-resolution paradigm.
 *
 * A pattern is not static layout — it is a prescribed presentation-interaction-resolution
 * paradigm that enables AI generation, testing, and validation.
 */

/**
 * Component definition within a pattern
 */
export interface ComponentDefinition {
  /** Component type (e.g., 'sherpa-dialog', 'sherpa-input-text') */
  type: string;

  /** Unique identifier within the pattern */
  id: string;

  /** Component attributes */
  attributes?: Record<string, string | boolean | number>;

  /** Child components */
  children?: ComponentDefinition[];

  /** Text content */
  content?: string;

  /** Whether component is required for pattern to function */
  required?: boolean;
}

/**
 * Trigger definition for interaction events
 */
export interface TriggerDefinition {
  /** Event name (e.g., 'click', 'submit', 'change') */
  event: string;

  /** Target component ID */
  target: string;

  /** Action to execute (function name or identifier) */
  action: string;

  /** Optional condition (expression or function) */
  condition?: string;

  /** Optional debounce delay in milliseconds */
  debounce?: number;
}

/**
 * Validation rule for form inputs
 */
export interface ValidationRule {
  /** Field component ID */
  field: string;

  /** Validation rule (e.g., 'required', 'minLength:3', 'email') */
  rule: string;

  /** Error message to display */
  message: string;

  /** When to validate (blur, change, submit) */
  trigger?: 'blur' | 'change' | 'submit';
}

/**
 * Navigation map for pattern flow
 */
export interface NavigationMap {
  /** Steps for successful flow */
  next: string[];

  /** Steps for cancel flow */
  cancel?: string[];

  /** Steps for error flow */
  error?: string[];

  /** Optional back/previous flow */
  back?: string[];
}

/**
 * State definition for pattern
 */
export interface StateDefinition {
  /** Initial state */
  initial: Record<string, any>;

  /** State transitions */
  transitions?: {
    from: string;
    to: string;
    trigger: string;
  }[];
}

/**
 * Feedback configuration for resolution outcomes
 */
export interface FeedbackConfig {
  /** Feedback type (toast, callout, banner, dialog) */
  type: 'toast' | 'callout' | 'banner' | 'dialog';

  /** Feedback message */
  message: string;

  /** Status variant (success, warning, critical, info) */
  status?: 'success' | 'warning' | 'critical' | 'info';

  /** Auto-dismiss duration in milliseconds */
  duration?: number;

  /** Action buttons */
  actions?: {
    label: string;
    action: string;
  }[];
}

/**
 * Resolution outcome configuration
 */
export interface ResolutionOutcome {
  /** Action to take (close_dialog, navigate, refresh, etc.) */
  action: string;

  /** Events to dispatch */
  events: string[];

  /** User feedback configuration */
  feedback?: FeedbackConfig;

  /** Navigation target (URL, route, or action) */
  navigation?: string;

  /** Data to pass to next step */
  data?: Record<string, any>;
}

/**
 * Presentation configuration
 */
export interface PresentationConfig {
  /** Layout type */
  layout: 'dialog' | 'page' | 'panel' | 'inline' | 'wizard' | 'drawer';

  /** Component tree */
  components: ComponentDefinition[];

  /** Path to HTML template file */
  template: string;

  /** Optional CSS styles (path or inline) */
  styles?: string;

  /** Layout-specific configuration */
  layoutConfig?: Record<string, any>;
}

/**
 * Interaction configuration
 */
export interface InteractionConfig {
  /** Event triggers */
  triggers: TriggerDefinition[];

  /** Validation rules */
  validations?: ValidationRule[];

  /** Navigation flow */
  navigation: NavigationMap;

  /** State management */
  state?: StateDefinition;

  /** Keyboard shortcuts */
  shortcuts?: {
    key: string;
    action: string;
    description?: string;
  }[];
}

/**
 * Resolution configuration
 */
export interface ResolutionConfig {
  /** Success outcome */
  success: ResolutionOutcome;

  /** Cancel outcome */
  cancel?: ResolutionOutcome;

  /** Error outcome */
  error: ResolutionOutcome;

  /** Custom outcomes */
  custom?: Record<string, ResolutionOutcome>;
}

/**
 * Pattern metadata
 */
export interface PatternMetadata {
  /** Pattern status */
  status: 'draft' | 'stable' | 'deprecated';

  /** Version string (semver) */
  version: string;

  /** MCP compatibility flag */
  mcp_compatible: boolean;

  /** Agent skill file path */
  agent_skill?: string;

  /** Pattern author */
  author?: string;

  /** Last updated timestamp */
  updated?: string;

  /** Tags for categorization */
  tags?: string[];
}

/**
 * Complete pattern definition
 */
export interface Pattern {
  /** Unique pattern identifier (kebab-case) */
  id: string;

  /** Human-readable pattern name */
  name: string;

  /** Pattern category */
  category: 'layouts' | 'flows' | 'feedback' | 'data' | 'forms' | 'navigation';

  /** Pattern description */
  description: string;

  /** Presentation: Visual layout and components */
  presentation: PresentationConfig;

  /** Interaction: User actions and behaviors */
  interaction: InteractionConfig;

  /** Resolution: Expected outcomes */
  resolution: ResolutionConfig;

  /** Metadata */
  metadata: PatternMetadata;

  /** Optional examples */
  examples?: {
    title: string;
    description: string;
    data?: Record<string, any>;
  }[];
}

/**
 * Pattern validation result
 */
export interface PatternValidationResult {
  /** Whether pattern is valid */
  valid: boolean;

  /** Validation errors */
  errors: {
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }[];

  /** Validation warnings */
  warnings?: {
    field: string;
    message: string;
  }[];
}

/**
 * Pattern generation context
 */
export interface PatternGenerationContext {
  /** Pattern ID to generate */
  patternId: string;

  /** Data to populate pattern */
  data: Record<string, any>;

  /** Target element or selector */
  target?: string | HTMLElement;

  /** Generation options */
  options?: {
    /** Include interaction logic */
    includeInteraction?: boolean;

    /** Include validation */
    includeValidation?: boolean;

    /** Include feedback */
    includeFeedback?: boolean;

    /** Custom event handlers */
    handlers?: Record<string, (event: Event) => void>;
  };
}

/**
 * Pattern generation result
 */
export interface PatternGenerationResult {
  /** Generated HTML */
  html: string;

  /** Generated JavaScript for interaction */
  js?: string;

  /** Event listeners to attach */
  listeners?: {
    element: string;
    event: string;
    handler: (event: Event) => void;
  }[];

  /** Validation functions */
  validators?: {
    field: string;
    validate: (value: unknown) => string | null;
  }[];

  /** Resolution handlers */
  resolutions?: {
    outcome: string;
    handler: (data?: unknown) => void | Promise<void>;
  }[];
}

/**
 * Pattern registry for loading and caching patterns
 */
export interface PatternRegistry {
  /** Load pattern by ID */
  load(patternId: string): Promise<Pattern>;

  /** Validate pattern definition */
  validate(pattern: Pattern): PatternValidationResult;

  /** Generate pattern implementation */
  generate(context: PatternGenerationContext): Promise<PatternGenerationResult>;

  /** List available patterns */
  list(filters?: {
    category?: string;
    status?: string;
    tags?: string[];
  }): Promise<Pattern[]>;

  /** Register new pattern */
  register(pattern: Pattern): Promise<void>;
}
