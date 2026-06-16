"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const engine_1 = require("./core/engine");
const diagnostics_1 = require("./core/diagnostics");
const panel_1 = require("./webview/panel");
const codeLensProvider_1 = require("./providers/codeLensProvider");
const codeActionProvider_1 = require("./providers/codeActionProvider");
let diagnosticsManager;
let engine;
let panel;
let codeLensProvider;
const issueStore = new Map();
let debounceTimer;
function activate(context) {
    console.log('[VitalLens] Extension activating...');
    // ── Core services ─────────────────────────────────────────
    diagnosticsManager = new diagnostics_1.DiagnosticsManager();
    engine = new engine_1.VitalLensEngine(context);
    panel = new panel_1.VitalLensPanel(context.extensionUri);
    codeLensProvider = new codeLensProvider_1.BundleCodeLensProvider(context);
    // ── Register Sidebar Panel ────────────────────────────────
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(panel_1.VitalLensPanel.viewType, panel, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    // ── Register CodeLens Provider (package.json) ─────────────
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'json', pattern: '**/package.json' }, codeLensProvider));
    // ── Register Code Action Provider ─────────────────────────
    const codeActionProvider = new codeActionProvider_1.VitalLensCodeActionProvider(issueStore);
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider([
        { language: 'json' },
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' },
        { language: 'html' },
    ], codeActionProvider, { providedCodeActionKinds: codeActionProvider_1.VitalLensCodeActionProvider.providedCodeActionKinds }));
    // ── Commands ──────────────────────────────────────────────
    // Full workspace analysis
    context.subscriptions.push(vscode.commands.registerCommand('vitallens.analyze', async () => {
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
                issueStore.get(key).push(issue);
            }
            panel.updateWithResult(result);
            codeLensProvider.refresh();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            panel.showError(`Analysis failed: ${message}`);
            vscode.window.showErrorMessage(`[VitalLens] Analysis error: ${message}`);
        }
    }));
    // Clear diagnostics
    context.subscriptions.push(vscode.commands.registerCommand('vitallens.clearDiagnostics', () => {
        diagnosticsManager.clear();
        issueStore.clear();
        vscode.window.showInformationMessage('[VitalLens] Diagnostics cleared.');
    }));
    // Show panel
    context.subscriptions.push(vscode.commands.registerCommand('vitallens.showPanel', () => {
        vscode.commands.executeCommand('vitallens.panel.focus');
    }));
    // Bundle detail (called from CodeLens click)
    context.subscriptions.push(vscode.commands.registerCommand('vitallens.showBundleDetail', (rule) => {
        const altText = rule.alternatives.length > 0
            ? `\n\n💡 Alternatives:\n${rule.alternatives.map((a) => `  • ${a.name} (${a.sizeKB}KB) — ${a.description}`).join('\n')}`
            : '';
        vscode.window.showInformationMessage(`📦 ${rule.name}: ~${rule.sizeKB}KB bundle (+${rule.ttImpactMs}ms TTI)\n\n${rule.reason}${altText}`, { modal: true });
    }));
    // Replace package (called from CodeLens click)
    context.subscriptions.push(vscode.commands.registerCommand('vitallens.replacePackage', async (uri, lineIndex, oldPkg, newPkg) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const line = doc.lineAt(lineIndex);
        const newText = line.text.replace(`"${oldPkg}"`, `"${newPkg}"`);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, line.range, newText);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(`[VitalLens] Replaced '${oldPkg}' with '${newPkg}' in package.json. Run 'npm install' to update dependencies.`);
    }));
    // ── File Watchers (Analyze on Save) ───────────────────────
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
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
    }));
    // Also analyze when a relevant document is first opened
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(async (document) => {
        const fileName = document.fileName.toLowerCase();
        if ((fileName.endsWith('package.json') ||
            /next\.config\.(js|ts|mjs)$/.test(fileName) ||
            /\.(tsx|jsx)$/.test(fileName)) &&
            !fileName.includes('node_modules')) {
            const issues = await engine.analyzeDocument(document);
            diagnosticsManager.update(document.uri, issues);
            issueStore.set(document.uri.toString(), issues);
        }
    }));
    // ── Auto-run on activation ────────────────────────────────
    // Slight delay to let VS Code finish loading
    setTimeout(() => {
        vscode.commands.executeCommand('vitallens.analyze');
    }, 1500);
    context.subscriptions.push(diagnosticsManager);
    vscode.window.showInformationMessage('⚡ VitalLens activated! Analyzing your project...');
    console.log('[VitalLens] Extension activated.');
}
function deactivate() {
    diagnosticsManager?.dispose();
    console.log('[VitalLens] Extension deactivated.');
}
//# sourceMappingURL=extension.js.map