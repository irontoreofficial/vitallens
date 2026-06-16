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
exports.VitalLensPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const types_1 = require("../core/types");
/**
 * Manages the VitalLens sidebar WebviewView.
 * Listens for analysis results and updates the panel UI in real-time.
 */
class VitalLensPanel {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    /**
     * Called by VS Code when the view is first shown.
     */
    resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'ui'),
                vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'ui'),
            ],
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'runAnalysis':
                    vscode.commands.executeCommand('vitallens.analyze');
                    break;
                case 'openFile':
                    if (message.filePath) {
                        const uri = vscode.Uri.file(message.filePath);
                        vscode.window.showTextDocument(uri, { preview: true });
                    }
                    break;
            }
        });
        // Show loading state initially
        this.showLoading();
    }
    /** Push a new analysis result to the webview. */
    updateWithResult(result) {
        if (!this._view) {
            return;
        }
        const payload = this.buildPayload(result);
        this._view.webview.postMessage({ command: 'update', data: payload });
    }
    /** Show loading spinner in the webview. */
    showLoading() {
        this._view?.webview.postMessage({ command: 'loading' });
    }
    /** Show an error message in the webview. */
    showError(message) {
        this._view?.webview.postMessage({ command: 'error', message });
    }
    buildPayload(result) {
        return {
            score: result.score,
            categoryScores: result.categoryScores,
            isNextJs: result.isNextJs,
            analyzedAt: result.analyzedAt.toLocaleTimeString(),
            counts: {
                total: result.issues.length,
                errors: result.issues.filter((i) => i.severity === types_1.IssueSeverity.Error).length,
                warnings: result.issues.filter((i) => i.severity === types_1.IssueSeverity.Warning).length,
                info: result.issues.filter((i) => i.severity === types_1.IssueSeverity.Info).length,
            },
            imageIssues: this.formatIssues(result.issues, types_1.IssueCategory.Image),
            bundleIssues: this.formatIssues(result.issues, types_1.IssueCategory.Bundle),
            redirectIssues: this.formatIssues(result.issues, types_1.IssueCategory.Redirect),
            seoIssues: this.formatIssues(result.issues, types_1.IssueCategory.SEO),
        };
    }
    formatIssues(issues, category) {
        return issues
            .filter((i) => i.category === category)
            .map((i) => ({
            ruleId: i.ruleId,
            title: i.title,
            message: i.message,
            severity: i.severity,
            filePath: i.fileUri.fsPath,
            fileName: path.basename(i.fileUri.fsPath),
            line: i.range.start.line + 1,
            meta: i.meta,
        }));
    }
    getHtml(webview) {
        // Get URIs for local resources
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'ui', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'ui', 'style.css'));
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>VitalLens</title>
</head>
<body>
  <div id="app">
    <div class="header">
      <div class="header-top">
        <span class="brand">⚡ VitalLens</span>
        <button class="run-btn" id="runBtn" title="Run full analysis">
          <span class="icon">↻</span> Analyze
        </button>
      </div>
      <div class="framework-badge" id="frameworkBadge">Next.js</div>
    </div>

    <!-- Score Gauge -->
    <div class="score-section" id="scoreSection">
      <div class="score-ring-container">
        <svg class="score-ring" viewBox="0 0 120 120">
          <circle class="ring-bg" cx="60" cy="60" r="52"/>
          <circle class="ring-fill" id="ringFill" cx="60" cy="60" r="52"
            stroke-dasharray="326.73"
            stroke-dashoffset="326.73"/>
        </svg>
        <div class="score-value" id="scoreValue">--</div>
        <div class="score-label">Score</div>
      </div>

      <div class="category-scores">
        <div class="cat-score">
          <div class="cat-bar-wrap">
            <div class="cat-bar" id="barImage" style="width:0%"></div>
          </div>
          <span class="cat-label">🖼️ Images</span>
          <span class="cat-num" id="numImage">--</span>
        </div>
        <div class="cat-score">
          <div class="cat-bar-wrap">
            <div class="cat-bar" id="barBundle" style="width:0%"></div>
          </div>
          <span class="cat-label">📦 Bundle</span>
          <span class="cat-num" id="numBundle">--</span>
        </div>
        <div class="cat-score">
          <div class="cat-bar-wrap">
            <div class="cat-bar" id="barRedirect" style="width:0%"></div>
          </div>
          <span class="cat-label">🔄 Redirects</span>
          <span class="cat-num" id="numRedirect">--</span>
        </div>
        <div class="cat-score">
          <div class="cat-bar-wrap">
            <div class="cat-bar" id="barSeo" style="width:0%"></div>
          </div>
          <span class="cat-label">🎯 SEO</span>
          <span class="cat-num" id="numSeo">--</span>
        </div>
      </div>
    </div>

    <!-- Summary badges -->
    <div class="summary-badges" id="summaryBadges" style="display:none">
      <span class="badge badge-error" id="badgeError">0 Errors</span>
      <span class="badge badge-warn" id="badgeWarn">0 Warnings</span>
      <span class="badge badge-info" id="badgeInfo">0 Info</span>
    </div>

    <!-- Issue Sections -->
    <div class="issues-container" id="issuesContainer">
      <div class="loading-state" id="loadingState">
        <div class="spinner"></div>
        <p>Click <strong>Analyze</strong> to scan your project</p>
      </div>
      <div id="issuesList" style="display:none"></div>
    </div>

    <div class="footer" id="footer"></div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.VitalLensPanel = VitalLensPanel;
VitalLensPanel.viewType = 'vitallens.panel';
//# sourceMappingURL=panel.js.map