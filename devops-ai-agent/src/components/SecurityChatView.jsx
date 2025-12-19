// src/components/SecurityChatView.jsx

import React, { useState, useEffect } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { api } from "../api";
import Spinner from "./ui/Spinner";
import { ShieldAlert, Wand2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Import syntax highlighter for attractive code blocks
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Custom components to render markdown beautifully
const customRenderers = {
  h2: ({ node, ...props }) => (
    <h2
      className="text-xl font-bold border-b border-gray-600 pb-2 mb-4"
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-lg font-semibold mb-3" {...props} />
  ),
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    ) : (
      <code
        className="bg-gray-700 rounded-md px-1.5 py-1 text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
};

const SecurityChatView = () => {
  const [summaryReport, setSummaryReport] = useState(null);
  const [detailedReport, setDetailedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [repoPath, setRepoPath] = useState(null);

  useEffect(() => {
    const savedResultString = sessionStorage.getItem("devopsResult");

    if (!savedResultString) {
      setError("Please generate a DevOps report first to view security issues.");
      return;
    }

    try {
      const lastResult = JSON.parse(savedResultString);
      const initialReport = lastResult?.generatedContent?.securityReport;
      const sourceRepoPath = lastResult?.sourceRepoPath;

      // ✅ LOAD: Check for a previously saved detailed report
      const savedDetailedReport = lastResult?.generatedContent?.detailedSecurityReport;

      if (initialReport && sourceRepoPath) {
        setSummaryReport(initialReport);
        setRepoPath(sourceRepoPath);

        // ✅ LOAD: If a detailed report was found, set it in the state
        if (savedDetailedReport) {
          setDetailedReport(savedDetailedReport);
        }
      } else {
        setError(
          "No security report found. Please generate one from the DevOps tab first."
        );
      }
    } catch (e) {
      setError("Could not load repository metadata. Please re-scan your project.");
    }
  }, []);

  const handleGenerateDetails = async () => {
    if (!repoPath) {
      setError("Repository path is missing. Cannot generate report.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.getSecurityDetails(repoPath);
      // Merge the deterministic details into a markdown-like summary
      const parts = [];
      if (response.securityReport) parts.push(response.securityReport);
      if (response.envSecrets && response.envSecrets.length) {
        parts.push('\n\n## Suspicious .env entries found:');
        response.envSecrets.forEach(s => {
          parts.push(`- ${s.path}`);
          s.suspicious.forEach(line => parts.push(`  - ${line}`));
        });
      }
      if (response.patternIssues && response.patternIssues.length) {
        parts.push('\n\n## Code Pattern Issues:');
        response.patternIssues.forEach(p => parts.push(`- ${p.path}: ${p.issue}`));
      }

      const newDetailedReport = parts.join('\n\n') || 'No additional issues found.';
      setDetailedReport(newDetailedReport);

      // Save updated detailed report to sessionStorage
      const savedResultString = sessionStorage.getItem("devopsResult");
      if (savedResultString) {
        const lastResult = JSON.parse(savedResultString);
        lastResult.generatedContent.detailedSecurityReport = newDetailedReport;
        sessionStorage.setItem("devopsResult", JSON.stringify(lastResult));
      }
    } catch (err) {
      setError(`Failed to generate detailed report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (error && !summaryReport) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-400">
        <ShieldAlert className="w-12 h-12 mb-4" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full p-4">
      {/* Left Panel: The Initial Summary Report */}
      <div className="w-1/3 flex flex-col">
        <h2 className="text-2xl font-bold text-white mb-4">Issues Summary</h2>
        <Card className="flex-grow p-4 overflow-y-auto">
          <article className="prose prose-invert max-w-none text-white">

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={customRenderers}
            >
              {summaryReport || "Loading summary..."}
            </ReactMarkdown>
          </article>
        </Card>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-300">Quick Stats:</div>
          <div className="flex items-center gap-2">
            <div className="bg-red-600 text-white px-2 py-1 rounded-md text-sm">Env Secrets: { (sessionStorage.getItem('devopsResult') && (() => { try { const s = JSON.parse(sessionStorage.getItem('devopsResult')); return (s.generatedContent && s.generatedContent.detailedSecurityReport) ? (s.generatedContent.detailedSecurityReport.match(/Suspicious/g) || []).length : 0 } catch(e){return 0} })()) }</div>
          </div>
        </div>
      </div>

      {/* Right Panel: The Detailed Analysis Area */}
      <div className="w-2/3 flex flex-col">
        <h2 className="text-2xl font-bold text-white mb-4">
          Detailed Analysis & Fixes
        </h2>
        <Card className="flex-grow flex flex-col items-center justify-center p-6">
          {loading ? (
            <>
              <Spinner size="lg" />
              <p className="mt-4 text-gray-300">
                AI is analyzing and generating the report...
              </p>
            </>
          ) : detailedReport ? (
            <div className="w-full h-full overflow-y-auto">
              <article className="prose prose-invert max-w-none text-white">

                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={customRenderers}
                >
                  {detailedReport}
                </ReactMarkdown>
              </article>
            </div>
          ) : (
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-500" />
              <h3 className="text-xl font-bold text-white mb-2">
                Generate In-Depth Analysis
              </h3>
              <p className="text-gray-400 mb-6 max-w-md">
                The AI will analyze each issue from the summary and provide
                detailed explanations and code examples for how to fix them.
              </p>
              <Button
                onClick={handleGenerateDetails}
                variant="primary"
                size="lg"
                disabled={!summaryReport || !repoPath}
                className="inline-flex items-center"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Generate Detailed Analysis
              </Button>
              {error && <p className="text-red-400 mt-4">{error}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SecurityChatView;