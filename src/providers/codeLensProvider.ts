import * as vscode from 'vscode';
import { BundleAnalyzer } from '../analyzers/nextjs/bundleAnalyzer';
import { HeavyPackageRule } from '../core/types';

/**
 * Provides inline CodeLens above heavy package entries in package.json.
 * Shows bundle size and TTI impact directly in the editor.
 */
export class BundleCodeLensProvider implements vscode.CodeLensProvider {
  private bundleAnalyzer: BundleAnalyzer;
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(context: vscode.ExtensionContext) {
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

    // Only for package.json files
    if (!document.fileName.endsWith('package.json') || document.fileName.includes('node_modules')) {
      return [];
    }

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
