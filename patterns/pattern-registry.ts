/**
 * Pattern Registry
 *
 * Centralized registry for loading, caching, and managing pattern definitions.
 */

import type {
  Pattern,
  PatternRegistry,
  PatternValidationResult,
  PatternGenerationContext,
  PatternGenerationResult,
} from './pattern-schema.js';
import { patternValidator } from './pattern-validator.js';
import { patternGenerator } from './pattern-generator.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pattern registry implementation
 */
export class PatternRegistryImpl implements PatternRegistry {
  private patterns: Map<string, Pattern> = new Map();
  private patternIndex: Map<string, string> = new Map();

  /**
   * Initialize registry by loading pattern index
   */
  async initialize(): Promise<void> {
    const indexPath = join(__dirname, 'index.json');

    try {
      const indexData = await readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexData);

      // Load pattern file paths
      if (index.patterns && Array.isArray(index.patterns)) {
        for (const entry of index.patterns) {
          if (entry.id && entry.file) {
            this.patternIndex.set(entry.id, entry.file);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load pattern index:', error);
      // Continue without index - patterns can still be loaded directly
    }
  }

  /**
   * Load pattern by ID
   */
  async load(patternId: string): Promise<Pattern> {
    // Check cache first
    const cachedPattern = this.patterns.get(patternId);
    if (cachedPattern) {
      return cachedPattern;
    }

    // Get file path from index
    let filePath = this.patternIndex.get(patternId);

    if (!filePath) {
      // Try to infer file path from pattern ID
      const category = this.inferCategory(patternId);
      filePath = join(__dirname, category, `${patternId}.json`);
    } else {
      filePath = join(__dirname, '..', filePath);
    }

    try {
      const patternData = await readFile(filePath, 'utf-8');
      const pattern = JSON.parse(patternData) as Pattern;

      // Validate pattern
      const validation = this.validate(pattern);
      if (!validation.valid) {
        throw new Error(
          `Invalid pattern ${patternId}: ${validation.errors.map((e) => e.message).join(', ')}`
        );
      }

      // Cache and return
      this.patterns.set(patternId, pattern);
      return pattern;
    } catch (error) {
      throw new Error(`Failed to load pattern ${patternId}: ${error}`);
    }
  }

  /**
   * Validate pattern definition
   */
  validate(pattern: Pattern): PatternValidationResult {
    return patternValidator.validate(pattern);
  }

  /**
   * Generate pattern implementation
   */
  async generate(context: PatternGenerationContext): Promise<PatternGenerationResult> {
    const pattern = await this.load(context.patternId);
    return patternGenerator.generate({ ...context, pattern } as any);
  }

  /**
   * List available patterns
   */
  async list(filters?: {
    category?: string;
    status?: string;
    tags?: string[];
  }): Promise<Pattern[]> {
    // Load all patterns from index
    const patterns: Pattern[] = [];

    for (const patternId of this.patternIndex.keys()) {
      try {
        const pattern = await this.load(patternId);
        patterns.push(pattern);
      } catch (error) {
        console.warn(`Failed to load pattern ${patternId}:`, error);
      }
    }

    // Apply filters
    let filtered = patterns;

    if (filters?.category) {
      filtered = filtered.filter((p) => p.category === filters.category);
    }

    if (filters?.status) {
      filtered = filtered.filter((p) => p.metadata.status === filters.status);
    }

    if (filters?.tags && filters.tags.length > 0) {
      const filterTags = filters.tags;
      filtered = filtered.filter((p) =>
        filterTags.some((tag) => p.metadata.tags?.includes(tag))
      );
    }

    return filtered;
  }

  /**
   * Register new pattern
   */
  async register(pattern: Pattern): Promise<void> {
    // Validate first
    const validation = this.validate(pattern);
    if (!validation.valid) {
      throw new Error(
        `Cannot register invalid pattern: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Add to cache
    this.patterns.set(pattern.id, pattern);

    // Add to index
    const filePath = join(pattern.category, `${pattern.id}.json`);
    this.patternIndex.set(pattern.id, filePath);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.patterns.clear();
  }

  /**
   * Get pattern count
   */
  getCount(): number {
    return this.patternIndex.size;
  }

  /**
   * Check if pattern exists
   */
  has(patternId: string): boolean {
    return this.patternIndex.has(patternId) || this.patterns.has(patternId);
  }

  /**
   * Infer category from pattern ID
   */
  private inferCategory(patternId: string): string {
    if (patternId.includes('-flow')) return 'flows';
    if (patternId.includes('-dialog')) return 'feedback';
    if (patternId.includes('-state')) return 'feedback';
    if (patternId.includes('-view')) return 'layouts';
    if (patternId.includes('-shell')) return 'layouts';
    if (patternId.includes('-grid')) return 'layouts';
    if (patternId.includes('-form')) return 'forms';
    if (patternId.includes('-nav')) return 'navigation';
    return 'flows'; // default
  }
}

/**
 * Singleton registry instance
 */
export const patternRegistry = new PatternRegistryImpl();

// Auto-initialize on import
patternRegistry.initialize().catch((error) => {
  console.warn('Pattern registry auto-initialization failed:', error);
});
