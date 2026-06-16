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
exports.DiagnosticsManager = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
const COLLECTION_NAME = 'vitallens';
/**
 * Manages the VS Code DiagnosticCollection for VitalLens.
 * Maps VitalIssue[] → vscode.Diagnostic[] and keeps the collection in sync.
 */
class DiagnosticsManager {
    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
    }
    /**
     * Update diagnostics for a single file URI.
     */
    update(uri, issues) {
        const diagnostics = issues
            .filter((i) => i.fileUri.toString() === uri.toString())
            .map((i) => this.toDiagnostic(i));
        this.collection.set(uri, diagnostics);
    }
    /**
     * Update diagnostics for multiple files at once.
     */
    updateAll(issues) {
        // Group issues by file URI
        const byFile = new Map();
        for (const issue of issues) {
            const key = issue.fileUri.toString();
            if (!byFile.has(key)) {
                byFile.set(key, []);
            }
            byFile.get(key).push(issue);
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
    clear(uri) {
        if (uri) {
            this.collection.delete(uri);
        }
        else {
            this.collection.clear();
        }
    }
    /** Dispose the collection when the extension is deactivated. */
    dispose() {
        this.collection.dispose();
    }
    toDiagnostic(issue) {
        const severity = this.mapSeverity(issue.severity);
        const diagnostic = new vscode.Diagnostic(issue.range, issue.message, severity);
        diagnostic.source = 'VitalLens';
        diagnostic.code = issue.ruleId;
        // Tag as unnecessary for info-level issues (renders as faded text)
        if (issue.severity === types_1.IssueSeverity.Info) {
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
        }
        return diagnostic;
    }
    mapSeverity(severity) {
        switch (severity) {
            case types_1.IssueSeverity.Error:
                return vscode.DiagnosticSeverity.Error;
            case types_1.IssueSeverity.Warning:
                return vscode.DiagnosticSeverity.Warning;
            case types_1.IssueSeverity.Info:
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }
}
exports.DiagnosticsManager = DiagnosticsManager;
//# sourceMappingURL=diagnostics.js.map