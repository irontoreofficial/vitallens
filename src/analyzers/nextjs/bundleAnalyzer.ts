import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IssueCategory, IssueSeverity, VitalIssue, HeavyPackageRule } from '../../core/types';

/**
 * Analyzes package.json for heavy npm packages and suggests lightweight alternatives.
 * Also provides CodeLens metrics directly above each offending dependency line.
 */
export class BundleAnalyzer {
  private rules: HeavyPackageRule[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.loadRules();
  }

  private loadRules(): void {
    try {
      const rulesPath = path.join(
        this.context.extensionPath,
        'resources',
        'rules',
        'heavyPackages.json'
      );
      const content = fs.readFileSync(rulesPath, 'utf8');
      const data = JSON.parse(content);
      this.rules = data.packages as HeavyPackageRule[];
    } catch (err) {
      console.error('[VitalLens] Failed to load heavyPackages.json:', err);
      this.rules = [];
    }
  }

  public getRules(): HeavyPackageRule[] {
    return this.rules;
  }

  public async analyze(document: vscode.TextDocument): Promise<VitalIssue[]> {
    const issues: VitalIssue[] = [];

    let pkgData: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      pkgData = JSON.parse(document.getText());
    } catch {
      return issues; // Invalid JSON
    }

    const allDeps = {
      ...pkgData.dependencies,
      ...pkgData.devDependencies,
    };

    const text = document.getText();

    for (const [pkgName] of Object.entries(allDeps)) {
      const rule = this.rules.find((r) => r.name === pkgName);
      if (!rule) {
        continue;
      }

      // Find the line where this package appears in the JSON
      const lineIndex = this.findPackageLine(text, document, pkgName);
      if (lineIndex === -1) {
        continue;
      }

      const line = document.lineAt(lineIndex);
      const range = line.range;

      // Build the message
      const altText =
        rule.alternatives.length > 0
          ? ` Consider: ${rule.alternatives.map((a) => `'${a.name}' (${a.sizeKB}KB)`).join(' or ')}.`
          : '';

      const message = `📦 "${pkgName}" adds ~${rule.sizeKB}KB to your bundle (+${rule.ttImpactMs}ms TTI). ${rule.reason}${altText}`;

      const fixes = this.buildFixes(document, lineIndex, rule);

      issues.push({
        ruleId: `NX-BUNDLE-${pkgName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`,
        title: `Heavy package: ${pkgName} (~${rule.sizeKB}KB)`,
        message,
        severity: rule.sizeKB > 100 ? IssueSeverity.Warning : IssueSeverity.Info,
        category: IssueCategory.Bundle,
        fileUri: document.uri,
        range,
        fixes,
        meta: {
          packageName: pkgName,
          sizeKB: rule.sizeKB,
          ttImpactMs: rule.ttImpactMs,
          alternatives: rule.alternatives,
        },
      });
    }

    return issues;
  }

  private findPackageLine(text: string, document: vscode.TextDocument, pkgName: string): number {
    // Escape special regex chars in pkg name
    const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`"${escaped}"\\s*:`);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        return i;
      }
    }
    return -1;
  }

  private buildFixes(
    document: vscode.TextDocument,
    lineIndex: number,
    rule: HeavyPackageRule
  ): VitalIssue['fixes'] {
    if (rule.alternatives.length === 0) {
      return [];
    }

    return rule.alternatives.map((alt) => ({
      label: `Replace with '${alt.name}' (${alt.sizeKB}KB) — ${alt.description}`,
      edit: this.buildReplaceEdit(document, lineIndex, rule.name, alt.name),
    }));
  }

  private buildReplaceEdit(
    document: vscode.TextDocument,
    lineIndex: number,
    oldPkg: string,
    newPkg: string
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(lineIndex);
    const lineText = line.text;

    // Escape for regex
    const escaped = oldPkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newText = lineText.replace(new RegExp(`"${escaped}"`), `"${newPkg}"`);

    edit.replace(document.uri, line.range, newText);
    return edit;
  }
}
