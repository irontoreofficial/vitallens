"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueCategory = exports.IssueSeverity = void 0;
var IssueSeverity;
(function (IssueSeverity) {
    IssueSeverity["Error"] = "error";
    IssueSeverity["Warning"] = "warning";
    IssueSeverity["Info"] = "info";
})(IssueSeverity || (exports.IssueSeverity = IssueSeverity = {}));
var IssueCategory;
(function (IssueCategory) {
    IssueCategory["Image"] = "image";
    IssueCategory["Bundle"] = "bundle";
    IssueCategory["Redirect"] = "redirect";
    IssueCategory["SEO"] = "seo";
})(IssueCategory || (exports.IssueCategory = IssueCategory = {}));
//# sourceMappingURL=types.js.map