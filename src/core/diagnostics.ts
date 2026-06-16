import * as vscode from 'vscode';
import { IssueSeverity, VitalIssue } from './types';

const COLLECTION_NAME = 'vitallens';

/**
 * Manages the VS Code DiagnosticCollection for VitalLens.
 * Maps VitalIssue[] → vscode.Diagnostic[] and keeps the collection in sync.
 */
export class DiagnosticsManager {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  }

  /**
   * Update diagnostics for a single file URI.
   */
  public update(uri: vscode.Uri, issues: VitalIssue[]): void {
    const diagnostics = issues
      .filter((i) => i.fileUri.toString() === uri.toString())
      .map((i) => this.toDiagnostic(i));

    this.collection.set(uri, diagnostics);
  }

  /**
   * Update diagnostics for multiple files at once.
   */
  public updateAll(issues: VitalIssue[]): void {
    // Group issues by file URI
    const byFile = new Map<string, VitalIssue[]>();
    for (const issue of issues) {
      const key = issue.fileUri.toString();
      if (!byFile.has(key)) {
        byFile.set(key, []);
      }
      byFile.get(key)!.push(issue);
    }

    // Apply per-file
    this.collection.clear();
    for (const [uriStr, fileIssues] of byFile) {
      const uri = vscode.Uri.parse(uriStr);
      const diagnostics = fileIssues.map((i) => this.toDiagnostic(i));
      this.collection.set(uri, diagnostics);
    }
  }

  /** Clear diagnostics for a specific file. */
  public clear(uri?: vscode.Uri): void {
    if (uri) {
      this.collection.delete(uri);
    } else {
      this.collection.clear();
    }
  }

  /** Dispose the collection when the extension is deactivated. */
  public dispose(): void {
    this.collection.dispose();
  }

  private toDiagnostic(issue: VitalIssue): vscode.Diagnostic {
    const severity = this.mapSeverity(issue.severity);
    const diagnostic = new vscode.Diagnostic(issue.range, issue.message, severity);
    diagnostic.source = 'VitalLens';
    diagnostic.code = issue.ruleId;

    // Tag as unnecessary for info-level issues (renders as faded text)
    if (issue.severity === IssueSeverity.Info) {
      diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    }

    return diagnostic;
  }

  private mapSeverity(severity: IssueSeverity): vscode.DiagnosticSeverity {
    switch (severity) {
      case IssueSeverity.Error:
        return vscode.DiagnosticSeverity.Error;
      case IssueSeverity.Warning:
        return vscode.DiagnosticSeverity.Warning;
      case IssueSeverity.Info:
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }
}
