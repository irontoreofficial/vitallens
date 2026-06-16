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
exports.BundleCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
const bundleAnalyzer_1 = require("../analyzers/nextjs/bundleAnalyzer");
/**
 * Provides inline CodeLens above heavy package entries in package.json.
 * Shows bundle size and TTI impact directly in the editor.
 */
class BundleCodeLensProvider {
    constructor(context) {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
        this.bundleAnalyzer = new bundleAnalyzer_1.BundleAnalyzer(context);
    }
    refresh() {
        this._onDidChangeCodeLenses.fire();
    }
    async provideCodeLenses(document, token) {
        const config = vscode.workspace.getConfiguration('vitallens');
        if (!config.get('showCodeLens', true)) {
            return [];
        }
        // Only for package.json files
        if (!document.fileName.endsWith('package.json') || document.fileName.includes('node_modules')) {
            return [];
        }
        const codeLenses = [];
        const rules = this.bundleAnalyzer.getRules();
        const text = document.getText();
        let pkgData;
        try {
            pkgData = JSON.parse(text);
        }
        catch {
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
            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(alert) ~${rule.sizeKB}KB bundle | +${rule.ttImpactMs}ms TTI`,
                command: 'vitallens.showBundleDetail',
                arguments: [rule],
                tooltip: rule.reason,
            }));
            // Secondary lens: show best alternative if available
            if (rule.alternatives.length > 0) {
                const best = rule.alternatives[0];
                codeLenses.push(new vscode.CodeLens(range, {
                    title: `$(lightbulb) Try '${best.name}' instead (${best.sizeKB}KB)`,
                    command: 'vitallens.replacePackage',
                    arguments: [document.uri, lineIndex, pkgName, best.name],
                    tooltip: best.description,
                }));
            }
        }
        return codeLenses;
    }
    findPackageLine(text, pkgName) {
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
exports.BundleCodeLensProvider = BundleCodeLensProvider;
//# sourceMappingURL=codeLensProvider.js.map