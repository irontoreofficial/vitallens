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
exports.SeoAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const seoRules_1 = require("../core/seoRules");
/**
 * Analyzes multi-language source files (React, Vue, Angular, HTML, CSS, JS/TS)
 * for SEO and performance violations using the SEO rules engine.
 */
class SeoAnalyzer {
    async analyze(document) {
        const issues = [];
        const text = document.getText();
        const rules = (0, seoRules_1.getRulesForFile)(document.fileName);
        for (const rule of rules) {
            // Ensure regex is global to find all occurrences
            const regex = new RegExp(rule.regex.source, rule.regex.flags.includes('g') ? rule.regex.flags : rule.regex.flags + 'g');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);
                const formattedMessage = (0, seoRules_1.formatSeoMessage)(rule);
                const fixes = [];
                if (rule.getQuickFix) {
                    const edit = rule.getQuickFix(document, match, match.index);
                    if (edit) {
                        fixes.push({
                            label: rule.recommendation,
                            edit
                        });
                    }
                }
                issues.push({
                    ruleId: rule.id,
                    title: rule.title,
                    message: formattedMessage,
                    severity: rule.severity,
                    category: rule.category,
                    fileUri: document.uri,
                    range,
                    fixes,
                    meta: {
                        badCode: rule.badCode,
                        goodCode: rule.goodCode,
                        why: rule.why,
                        recommendation: rule.recommendation
                    }
                });
            }
        }
        return issues;
    }
}
exports.SeoAnalyzer = SeoAnalyzer;
//# sourceMappingURL=seoAnalyzer.js.map