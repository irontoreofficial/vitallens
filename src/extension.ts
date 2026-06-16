import * as vscode from 'vscode';
import { VitalLensEngine } from './core/engine';
import { DiagnosticsManager } from './core/diagnostics';
import { VitalLensPanel } from './webview/panel';
import { BundleCodeLensProvider } from './providers/codeLensProvider';
import { VitalLensCodeActionProvider } from './providers/codeActionProvider';
import { VitalIssue } from './core/types';

let diagnosticsManager: DiagnosticsManager;
let engine: VitalLensEngine;
let panel: VitalLensPanel;
let codeLensProvider: BundleCodeLensProvider;

const issueStore = new Map<string, VitalIssue[]>();
let debounceTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('[VitalLens] Extension activating...');

  // ── Core services ─────────────────────────────────────────
  diagnosticsManager = new DiagnosticsManager();
  engine = new VitalLensEngine(context);
  panel = new VitalLensPanel(context.extensionUri);
  codeLensProvider = new BundleCodeLensProvider(context);

  // ── Register Sidebar Panel ────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VitalLensPanel.viewType, panel, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ── Register CodeLens Provider (package.json) ─────────────
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'json', pattern: '**/package.json' },
      codeLensProvider
    )
  );

  // ── Register Code Action Provider ─────────────────────────
  const codeActionProvider = new VitalLensCodeActionProvider(issueStore);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'json' },
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' },
        { language: 'html' },
      ],
      codeActionProvider,
      { providedCodeActionKinds: VitalLensCodeActionProvider.providedCodeActionKinds }
    )
  );

  // ── Commands ──────────────────────────────────────────────

  // Full workspace analysis
  context.subscriptions.push(
    vscode.commands.registerCommand('vitallens.analyze', async () => {
      panel.showLoading();
      try {
        const result = await engine.analyzeWorkspace();
        diagnosticsManager.updateAll(result.issues);
        // Update code action issue store
        for (const issue of result.issues) {
          const key = issue.fileUri.toString();
          if (!issueStore.has(key)) {
            issueStore.set(key, []);
          }
          issueStore.get(key)!.push(issue);
        }
        panel.updateWithResult(result);
        codeLensProvider.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        panel.showError(`Analysis failed: ${message}`);
        vscode.window.showErrorMessage(`[VitalLens] Analysis error: ${message}`);
      }
    })
  );

  // Clear diagnostics
  context.subscriptions.push(
    vscode.commands.registerCommand('vitallens.clearDiagnostics', () => {
      diagnosticsManager.clear();
      issueStore.clear();
      vscode.window.showInformationMessage('[VitalLens] Diagnostics cleared.');
    })
  );

  // Show panel
  context.subscriptions.push(
    vscode.commands.registerCommand('vitallens.showPanel', () => {
      vscode.commands.executeCommand('vitallens.panel.focus');
    })
  );

  // Bundle detail (called from CodeLens click)
  context.subscriptions.push(
    vscode.commands.registerCommand('vitallens.showBundleDetail', (rule) => {
      const altText = rule.alternatives.length > 0
        ? `\n\n💡 Alternatives:\n${rule.alternatives.map((a: { name: string; sizeKB: number; description: string }) => `  • ${a.name} (${a.sizeKB}KB) — ${a.description}`).join('\n')}`
        : '';
      vscode.window.showInformationMessage(
        `📦 ${rule.name}: ~${rule.sizeKB}KB bundle (+${rule.ttImpactMs}ms TTI)\n\n${rule.reason}${altText}`,
        { modal: true }
      );
    })
  );

  // Replace package (called from CodeLens click)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vitallens.replacePackage',
      async (uri: vscode.Uri, lineIndex: number, oldPkg: string, newPkg: string) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const line = doc.lineAt(lineIndex);
        const newText = line.text.replace(`"${oldPkg}"`, `"${newPkg}"`);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, line.range, newText);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(
          `[VitalLens] Replaced '${oldPkg}' with '${newPkg}' in package.json. Run 'npm install' to update dependencies.`
        );
      }
    )
  );

  // ── File Watchers (Analyze on Save) ───────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const config = vscode.workspace.getConfiguration('vitallens');
      if (!config.get('analyzeOnSave', true)) {
        return;
      }

      // Debounce: wait 400ms after save before re-analyzing
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(async () => {
        const issues = await engine.analyzeDocument(document);
        diagnosticsManager.update(document.uri, issues);
        issueStore.set(document.uri.toString(), issues);

        // Trigger full workspace result update for the panel
        const result = await engine.analyzeWorkspace();
        panel.updateWithResult(result);
        codeLensProvider.refresh();
      }, 400);
    })
  );

  // Also analyze when a relevant document is first opened
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      const fileName = document.fileName.toLowerCase();
      if (
        (fileName.endsWith('package.json') ||
          /next\.config\.(js|ts|mjs)$/.test(fileName) ||
          /\.(tsx|jsx)$/.test(fileName)) &&
        !fileName.includes('node_modules')
      ) {
        const issues = await engine.analyzeDocument(document);
        diagnosticsManager.update(document.uri, issues);
        issueStore.set(document.uri.toString(), issues);
      }
    })
  );

  // ── Auto-run on activation ────────────────────────────────
  // Slight delay to let VS Code finish loading
  setTimeout(() => {
    vscode.commands.executeCommand('vitallens.analyze');
  }, 1500);

  context.subscriptions.push(diagnosticsManager);

  vscode.window.showInformationMessage('⚡ VitalLens activated! Analyzing your project...');
  console.log('[VitalLens] Extension activated.');
}

export function deactivate(): void {
  diagnosticsManager?.dispose();
  console.log('[VitalLens] Extension deactivated.');
}
