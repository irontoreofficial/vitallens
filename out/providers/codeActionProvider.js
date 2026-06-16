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
exports.VitalLensCodeActionProvider = void 0;
const vscode = __importStar(require("vscode"));
const COMMAND_ID = 'vitallens.applyFix';
/**
 * Provides Quick Fix code actions for VitalLens diagnostics.
 * When the user clicks the lightbulb on a VitalLens diagnostic, this
 * provider returns the available WorkspaceEdit fixes.
 */
class VitalLensCodeActionProvider {
    constructor(issueStore) {
        this.issueStore = issueStore;
    }
    provideCodeActions(document, range, context, token) {
        const actions = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'VitalLens') {
                continue;
            }
            // Find the matching VitalIssue
            const fileIssues = this.issueStore.get(document.uri.toString()) ?? [];
            const issue = fileIssues.find((i) => i.range.start.line === diagnostic.range.start.line &&
                i.ruleId === diagnostic.code);
            if (!issue?.fixes) {
                continue;
            }
            for (const fix of issue.fixes) {
                const action = new vscode.CodeAction(fix.label, vscode.CodeActionKind.QuickFix);
                action.diagnostics = [diagnostic];
                action.isPreferred = fix === issue.fixes[0]; // Mark first fix as preferred
                if (fix.edit) {
                    action.edit = fix.edit;
                }
                else if (fix.command) {
                    action.command = fix.command;
                }
                actions.push(action);
            }
        }
        return actions;
    }
    /** Update the issue store when re-analysis completes. */
    updateIssues(uri, issues) {
        this.issueStore.set(uri.toString(), issues);
    }
}
exports.VitalLensCodeActionProvider = VitalLensCodeActionProvider;
VitalLensCodeActionProvider.providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];
//# sourceMappingURL=codeActionProvider.js.map