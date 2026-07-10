import * as vscode from 'vscode';
import { BundleAnalyzer } from '../analyzers/nextjs/bundleAnalyzer';
import { HeavyPackageRule, VitalIssue } from '../core/types';

/**
 * Provides inline CodeLens above package.json dependencies (for bundle weight)
 * and above code lines containing SEO/PageSpeed issues (for framework audits).
 */
export class VitalLensCodeLensProvider implements vscode.CodeLensProvider {
  private bundleAnalyzer: BundleAnalyzer;
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    context: vscode.ExtensionContext,
    private readonly issueStore: Map<string, VitalIssue[]>
  ) {
    this.bundleAnalyzer = new BundleAnalyzer(context);
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration('vitallens');
    if (!config.get('showCodeLens', true)) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const fileName = document.fileName.toLowerCase();

    // ─── 1. Package.json Bundle Weight CodeLenses ───────────────────────────
    if (fileName.endsWith('package.json') && !fileName.includes('node_modules')) {
      return this.provideBundleCodeLenses(document, token);
    }

    // ─── 2. Multi-Language SEO / PageSpeed CodeLenses ───────────────────────
    const fileIssues = this.issueStore.get(document.uri.toString());
    if (fileIssues && fileIssues.length > 0) {
      for (const issue of fileIssues) {
        if (token.isCancellationRequested) {
          break;
        }

        // Place CodeLens at the start of the line where the issue was found
        const line = document.lineAt(issue.range.start.line);
        const range = line.range;

        // CodeLens 1: Rationale & Explanations (Click opens info box)
        const titleText = `⚡ VitalLens: Use '${issue.meta?.goodCode || ''}' instead of '${issue.meta?.badCode || ''}' (Click to see why)`;
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: titleText,
            command: 'vitallens.showSeoDetail',
            arguments: [issue],
            tooltip: `Why: ${issue.meta?.why || ''}`
          })
        );

        // CodeLens 2: Quick Fix (if edit/fixes are available)
        if (issue.fixes && issue.fixes.length > 0) {
          const fix = issue.fixes[0];
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `💡 Quick Fix: ${fix.label}`,
              command: 'vitallens.applySeoFix',
              arguments: [document.uri, issue]
            })
          );
        }
      }
    }

    return codeLenses;
  }

  private async provideBundleCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const rules = this.bundleAnalyzer.getRules();
    const text = document.getText();

    let pkgData: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      pkgData = JSON.parse(text);
    } catch {
      return [];
    }

    const allDeps = { ...pkgData.dependencies, ...pkgData.devDependencies };

    for (const [pkgName] of Object.entries(allDeps)) {
      if (token.isCancellationRequested) {
        break;
      }

      const rule = rules.find((r) => r.name === pkgName);
      if (!rule) {
        continue;
      }

      const lineIndex = this.findPackageLine(text, pkgName);
      if (lineIndex === -1) {
        continue;
      }

      const range = document.lineAt(lineIndex).range;

      // Primary lens: show size and TTI impact
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `$(alert) ~${rule.sizeKB}KB bundle | +${rule.ttImpactMs}ms TTI`,
          command: 'vitallens.showBundleDetail',
          arguments: [rule],
          tooltip: rule.reason,
        })
      );

      // Secondary lens: show best alternative if available
      if (rule.alternatives.length > 0) {
        const best = rule.alternatives[0];
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `$(lightbulb) Try '${best.name}' instead (${best.sizeKB}KB)`,
            command: 'vitallens.replacePackage',
            arguments: [document.uri, lineIndex, pkgName, best.name],
            tooltip: best.description,
          })
        );
      }
    }

    return codeLenses;
  }

  private findPackageLine(text: string, pkgName: string): number {
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
}
