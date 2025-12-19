import React, { useState, useEffect, useMemo } from "react";
import { api } from "../api";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Spinner from "./ui/Spinner";
import FileTree from "./FileTree";
import CodeBlock from "./ui/CodeBlock";
import { UploadCloud, XCircle, FileCode2, Zap, Copy, Check, Layers, Cpu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Mermaid diagram component
const MermaidDiagram = ({ mermaidCode }) => {
  const [svgContent, setSvgContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renderId] = useState(() => `mermaid_${Math.random().toString(36).slice(2,9)}`);

  useEffect(() => {
    const loadMermaid = async () => {
      try {
        // Try to load ESM build first (improves compatibility with Vite)
        let mermaidModule;
        try {
          mermaidModule = await import("mermaid/dist/mermaid.esm.min.mjs");
        } catch (e) {
          // Fallback to package entry
          mermaidModule = await import("mermaid");
        }

        const mermaid = mermaidModule.default || mermaidModule;
        if (!mermaid) throw new Error("Mermaid module not found");

        mermaid.initialize({ startOnLoad: true, theme: "dark" });

        // mermaid.render can return svg string or an object depending on build
        const code = mermaidCode && mermaidCode.trim() ? mermaidCode : "graph TD; Client-->Server; Server-->DB;";
        const renderResult = await mermaid.render(renderId, code);
        let svg = null;
        if (typeof renderResult === "string") svg = renderResult;
        else if (renderResult && typeof renderResult === 'object') {
          svg = renderResult.svg || renderResult?.dom?.innerHTML || null;
        }
        if (!svg && typeof mermaid.getSVG === 'function') {
          // some builds expose getSVG
          try { svg = mermaid.getSVG(renderId); } catch(e) { /* ignore */ }
        }
        setSvgContent(svg || null);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setSvgContent(null);
      } finally {
        setLoading(false);
      }
    };
    loadMermaid();
  }, [mermaidCode]);

  if (loading) return <Spinner size="sm" />;
  if (!svgContent) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        <p>Could not render architecture diagram. Raw code:</p>
        <pre className="mt-2 bg-gray-950 p-2 rounded text-xs overflow-auto">{mermaidCode}</pre>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-950 rounded-lg overflow-auto max-h-96">
      <div dangerouslySetInnerHTML={{ __html: svgContent }} />
    </div>
  );
};

// Copy button utility
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

const transformContentToFlatMap = (content, repoPath, metadata) => {
  if (!content || !repoPath || !metadata) return {};
  const allFiles = {};
  if (content.dockerfiles) {
    Object.entries(content.dockerfiles).forEach(
      ([serviceName, fileContent]) => {
        const serviceInfo = metadata.services[serviceName];
        if (serviceInfo) {
          const relativePath = serviceInfo.path
            .replace(repoPath, "")
            .replace(/^[\\/]/, "");
          const displayPath = relativePath
            ? `${relativePath}/Dockerfile`
            : "Dockerfile";
          allFiles[displayPath] = fileContent;
        }
      }
    );
  }
  if (content.dockerCompose)
    allFiles["docker-compose.yml"] = content.dockerCompose;
  if (content.ciCdPipeline)
    allFiles[".github/workflows/ci.yml"] = content.ciCdPipeline;
  if (content.kubernetes) {
    Object.entries(content.kubernetes).forEach(([service, manifests]) => {
      Object.entries(manifests).forEach(([type, fileContent]) => {
        allFiles[`infra/kubernetes/${service}/${type}.yaml`] = fileContent;
      });
    });
  }
  if (content.securityReport)
    allFiles["infra/security-report.md"] = content.securityReport;
  return allFiles;
};

const DevOpsView = () => {
  const [repoPath, setRepoPath] = useState(
    localStorage.getItem("repoPath") || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State to persist results
  const [result, setResult] = useState(() => {
    const saved = sessionStorage.getItem("devopsResult");
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedFile, setSelectedFile] = useState(() => {
    const saved = sessionStorage.getItem("selectedDevopsFile");
    return saved ? JSON.parse(saved) : null;
  });

  // Mermaid architecture diagram
  const [mermaidCode, setMermaidCode] = useState(null);
  const [mermaidLoading, setMermaidLoading] = useState(false);

  // Tab state: 'files', 'architecture', 'metadata'
  const [activeTab, setActiveTab] = useState("files");

  // Persist results
  useEffect(() => {
    if (result) {
      sessionStorage.setItem("devopsResult", JSON.stringify(result));
    } else {
      sessionStorage.removeItem("devopsResult");
    }
  }, [result]);

  useEffect(() => {
    if (selectedFile) {
      sessionStorage.setItem(
        "selectedDevopsFile",
        JSON.stringify(selectedFile)
      );
    } else {
      sessionStorage.removeItem("selectedDevopsFile");
    }
  }, [selectedFile]);

  const handleSelectRepo = async () => {
    const path = await window.electronAPI.openFolderDialog();
    if (path) {
      setRepoPath(path);
      localStorage.setItem("repoPath", path);
    }
  };

  const handleGenerate = async () => {
    if (!repoPath) {
      setError("Please select a repository path first.");
      return;
    }

    const pathToGenerate = repoPath;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedFile(null);
    setMermaidCode(null);

    try {
      // Generate DevOps files
      const data = await api.generateDevops(pathToGenerate);
      const resultWithRepoPath = { ...data, sourceRepoPath: pathToGenerate };
      setResult(resultWithRepoPath);

      // Fetch architecture diagram
      setMermaidLoading(true);
      try {
        const archData = await api.getArchitectureMap(pathToGenerate);
        setMermaidCode(archData.mermaid);
      } catch (e) {
        console.error("Failed to fetch architecture map:", e);
      } finally {
        setMermaidLoading(false);
      }

      setRepoPath("");
      localStorage.removeItem("repoPath");

      if (data.generatedContent) {
        const flatMap = transformContentToFlatMap(
          data.generatedContent,
          pathToGenerate,
          data.metadata
        );
        const firstFilePath = Object.keys(flatMap)[0];
        if (firstFilePath) {
          setSelectedFile({
            path: firstFilePath,
            content: flatMap[firstFilePath],
          });
        }
      }
      setActiveTab("files");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFileLanguage = (fileName = "") => {
    if (fileName.endsWith(".yml") || fileName.endsWith(".yaml")) return "yaml";
    if (fileName.toLowerCase().includes("dockerfile")) return "dockerfile";
    if (fileName.endsWith(".json")) return "json";
    if (fileName.endsWith(".md")) return "markdown";
    return "plaintext";
  };

  const files = useMemo(() => {
    if (!result) return {};
    return transformContentToFlatMap(
      result.generatedContent,
      result.sourceRepoPath,
      result.metadata
    );
  }, [result]);

  return (
    <div className="space-y-8 bg-gray-900 bg-[radial-gradient(#ffffff1a_1px,transparent_1px)] [background-size:32px_32px]">
      {/* Header & Input Section */}
      <div className="p-6 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">
          🚀 DevOps File Generator & Architecture Visualizer
        </h1>
        <p className="text-gray-400 mb-6">
          Select your project folder to generate DevOps scaffolding (Dockerfiles, docker-compose, GitHub Actions, 
          Kubernetes configs) and view the architecture diagram.
        </p>
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleSelectRepo}
            variant="secondary"
            className="flex-shrink-0 shadow-lg flex items-center"
          >
            <UploadCloud className="w-5 h-5 mr-2" />
            Select Repository
          </Button>

          <div className="flex-grow bg-gray-950/50 border border-gray-700 rounded-md p-3 text-gray-300 font-mono text-sm truncate">
            {repoPath || "No repository selected..."}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading || !repoPath}
            variant="primary"
            size="lg"
            className="shadow-lg shadow-indigo-500/30 flex items-center"
          >
            {loading ? <Spinner size="sm" /> : <Zap className="w-5 h-5 mr-2" />}
            Generate
          </Button>
        </div>
        {error && (
          <p className="text-red-400 mt-4 flex items-center text-sm">
            <XCircle className="w-4 h-4 mr-2" />
            {error}
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-10 bg-gray-800/50 rounded-lg backdrop-blur-sm">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-300">
            Scanning repository and generating files...
          </p>
        </div>
      )}

      {/* Results Section */}
      {result && !loading && Object.keys(files).length > 0 && (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex space-x-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
            {[
              { id: "files", label: "📄 Generated Files", icon: FileCode2 },
              { id: "architecture", label: "🏗️ Architecture", icon: Layers },
              { id: "metadata", label: "📊 Metadata", icon: Cpu },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 rounded transition-colors ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB: Generated Files */}
          {activeTab === "files" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <FileTree
                  title="Generated Files"
                  files={files}
                  onFileSelect={setSelectedFile}
                  selectedFilePath={selectedFile?.path}
                />
              </div>
              <div className="lg:col-span-2">
                <Card className="p-0 overflow-hidden">
                  {!selectedFile ? (
                    <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                      <FileCode2 className="w-16 h-16 mb-4" />
                      <p>Select a file to view its content</p>
                    </div>
                  ) : (
                    <div className="h-[70vh] flex flex-col">
                      <div className="bg-gray-800 border-b border-gray-700 p-3 sticky top-0 font-mono text-sm text-indigo-300 z-10 flex justify-between items-center">
                        <span>{selectedFile.path}</span>
                        <CopyButton text={selectedFile.content} />
                      </div>
                      <div className="flex-grow overflow-y-auto">
                        {selectedFile.path.endsWith(".md") ? (
                          <article className="prose prose-invert p-4 text-white max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {selectedFile.content}
                            </ReactMarkdown>
                          </article>
                        ) : (
                          <CodeBlock
                            language={getFileLanguage(selectedFile.path)}
                            value={selectedFile.content}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* TAB: Architecture Diagram */}
          {activeTab === "architecture" && (
            <Card className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">System Architecture</h2>
              {mermaidLoading ? (
                <div className="flex items-center justify-center h-96">
                  <Spinner size="lg" />
                </div>
              ) : mermaidCode ? (
                <MermaidDiagram mermaidCode={mermaidCode} />
              ) : (
                <div className="p-4 text-gray-400 text-center">
                  No architecture diagram available
                </div>
              )}
            </Card>
          )}

          {/* TAB: Metadata & Details */}
          {activeTab === "metadata" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Services Info */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Detected Services</h3>
                {result.metadata && result.metadata.services ? (
                  <div className="space-y-3">
                    {Object.entries(result.metadata.services).map(([name, svc]) => (
                      <div key={name} className="bg-gray-800 p-3 rounded text-sm">
                        <p className="font-semibold text-indigo-300">{name}</p>
                        <p className="text-gray-400">Path: {svc.path}</p>
                        <p className="text-gray-400">Port: {svc.port || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No service information available</p>
                )}
              </Card>

              {/* Port Checks */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Port Availability</h3>
                {result.metadata && result.metadata.portChecks ? (
                  <div className="space-y-2">
                    {result.metadata.portChecks.map((pc) => (
                      <div key={pc.port} className="flex items-center text-sm">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${pc.inUse ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-gray-300">Port {pc.port}: </span>
                        <span className={pc.inUse ? 'text-red-400 ml-2' : 'text-green-400 ml-2'}>
                          {pc.inUse ? 'IN USE' : 'Available'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No port checks available</p>
                )}
              </Card>

              {/* Maintenance Score */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Maintenance Status</h3>
                {result.metadata && result.metadata.maintenance ? (
                  <div className="space-y-3">
                    {Object.entries(result.metadata.maintenance).map(([svc, data]) => (
                      <div key={svc} className="bg-gray-800 p-3 rounded text-sm">
                        <p className="font-semibold text-indigo-300">{svc}</p>
                        {data.maintenanceScore !== undefined ? (
                          <>
                            <p className="text-gray-400">Score: <span className={data.maintenanceScore >= 70 ? 'text-green-400' : data.maintenanceScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>{data.maintenanceScore}</span>/100</p>
                            <p className="text-gray-400">Outdated: {data.numOutdated || 0} packages</p>
                          </>
                        ) : (
                          <p className="text-gray-400">Check not run</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No maintenance data available</p>
                )}
              </Card>

              {/* Required Services */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Infrastructure</h3>
                {result.metadata && result.metadata.requiredServices ? (
                  <div className="space-y-2">
                    {result.metadata.requiredServices.map((svc) => (
                      <div key={svc} className="flex items-center text-sm text-gray-300">
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 mr-2"></span>
                        {svc}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No infrastructure data available</p>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && (
        <div className="flex flex-col items-center justify-center p-16 text-center text-gray-500">
          <Zap className="w-20 h-20 mb-4 opacity-50" />
          <p className="text-lg">Select a repository and click Generate to get started</p>
        </div>
      )}
    </div>
  );
};

export default DevOpsView;
