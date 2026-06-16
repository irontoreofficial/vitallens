import * as vscode from 'vscode';

/**
 * Represents a single analysis issue found in a file.
 */
export interface VitalIssue {
  /** Unique identifier for the rule that triggered this issue */
  ruleId: string;
  /** Human-readable title */
  title: string;
  /** Detailed message shown on hover */
  message: string;
  /** Severity level */
  severity: IssueSeverity;
  /** Category for sidebar grouping */
  category: IssueCategory;
  /** File URI where the issue was found */
  fileUri: vscode.Uri;
  /** Range in the document */
  range: vscode.Range;
  /** Optional quick-fix actions */
  fixes?: QuickFix[];
  /** Optional metadata (e.g. package size, alternative name) */
  meta?: Record<string, unknown>;
}

export enum IssueSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

export enum IssueCategory {
  Image = 'image',
  Bundle = 'bundle',
  Redirect = 'redirect',
  SEO = 'seo',
}

export interface QuickFix {
  /** Label shown in the Quick Fix menu */
  label: string;
  /** The VS Code WorkspaceEdit to apply */
  edit?: vscode.WorkspaceEdit;
  /** Optional command to run instead of an edit */
  command?: vscode.Command;
}

/**
 * Aggregated analysis result for the entire workspace.
 */
export interface AnalysisResult {
  issues: VitalIssue[];
  analyzedAt: Date;
  /** Whether this is a Next.js project */
  isNextJs: boolean;
  /** Computed overall score 0-100 */
  score: number;
  /** Score breakdown by category */
  categoryScores: CategoryScores;
}

export interface CategoryScores {
  image: number;
  bundle: number;
  redirect: number;
  seo: number;
}

/**
 * A single entry from heavyPackages.json
 */
export interface HeavyPackageRule {
  name: string;
  sizeKB: number;
  ttImpactMs: number;
  alternatives: PackageAlternative[];
  reason: string;
}

export interface PackageAlternative {
  name: string;
  sizeKB: number;
  description: string;
}
