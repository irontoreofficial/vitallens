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
exports.BundleAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const types_1 = require("../../core/types");
/**
 * Analyzes package.json for heavy npm packages and suggests lightweight alternatives.
 * Also provides CodeLens metrics directly above each offending dependency line.
 */
class BundleAnalyzer {
    constructor(context) {
        this.context = context;
        this.rules = [];
        this.loadRules();
    }
    loadRules() {
        try {
            const rulesPath = path.join(this.context.extensionPath, 'resources', 'rules', 'heavyPackages.json');
            const content = fs.readFileSync(rulesPath, 'utf8');
            const data = JSON.parse(content);
            this.rules = data.packages;
        }
        catch (err) {
            console.error('[VitalLens] Failed to load heavyPackages.json:', err);
            this.rules = [];
        }
    }
    getRules() {
        return this.rules;
    }
    async analyze(document) {
        const issues = [];
        let pkgData;
        try {
            pkgData = JSON.parse(document.getText());
        }
        catch {
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
            const altText = rule.alternatives.length > 0
                ? ` Consider: ${rule.alternatives.map((a) => `'${a.name}' (${a.sizeKB}KB)`).join(' or ')}.`
                : '';
            const message = `📦 "${pkgName}" adds ~${rule.sizeKB}KB to your bundle (+${rule.ttImpactMs}ms TTI). ${rule.reason}${altText}`;
            const fixes = this.buildFixes(document, lineIndex, rule);
            issues.push({
                ruleId: `NX-BUNDLE-${pkgName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`,
                title: `Heavy package: ${pkgName} (~${rule.sizeKB}KB)`,
                message,
                severity: rule.sizeKB > 100 ? types_1.IssueSeverity.Warning : types_1.IssueSeverity.Info,
                category: types_1.IssueCategory.Bundle,
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
    findPackageLine(text, document, pkgName) {
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
    buildFixes(document, lineIndex, rule) {
        if (rule.alternatives.length === 0) {
            return [];
        }
        return rule.alternatives.map((alt) => ({
            label: `Replace with '${alt.name}' (${alt.sizeKB}KB) — ${alt.description}`,
            edit: this.buildReplaceEdit(document, lineIndex, rule.name, alt.name),
        }));
    }
    buildReplaceEdit(document, lineIndex, oldPkg, newPkg) {
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
exports.BundleAnalyzer = BundleAnalyzer;
//# sourceMappingURL=bundleAnalyzer.js.map