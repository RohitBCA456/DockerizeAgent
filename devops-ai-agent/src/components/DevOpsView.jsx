import React, { useState, useEffect, useMemo } from "react";
import { api } from "../api";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Spinner from "./ui/Spinner";
import FileTree from "./FileTree";
import CodeBlock from "./ui/CodeBlock";
import { UploadCloud, XCircle, FileCode2, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  // ✅ FIX: Initialize state from sessionStorage to persist across tabs
  const [result, setResult] = useState(() => {
    const saved = sessionStorage.getItem("devopsResult");
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedFile, setSelectedFile] = useState(() => {
    const saved = sessionStorage.getItem("selectedDevopsFile");
    return saved ? JSON.parse(saved) : null;
  });

  // ✅ FIX: Use useEffect to save results to sessionStorage when they change
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

    // Store the path for the API call, then clear the input
    const pathToGenerate = repoPath;

    setLoading(true);
    setError(null);

    // Clear previous results from state and storage
    setResult(null);
    setSelectedFile(null);

    try {
      const data = await api.generateDevops(pathToGenerate);

      // ✅ FIX: Store the repo path with the result for later use
      const resultWithRepoPath = { ...data, sourceRepoPath: pathToGenerate };
      setResult(resultWithRepoPath);

      // ✅ FIX: Clear the input path after a successful generation starts
      setRepoPath("");
      localStorage.removeItem("repoPath");

      if (data.generatedContent) {
        const flatMap = transformContentToFlatMap(
          data.generatedContent,
          pathToGenerate, // Use the path from this generation
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
    // ✅ FIX: Use the saved repo path from the result object
    return transformContentToFlatMap(
      result.generatedContent,
      result.sourceRepoPath,
      result.metadata
    );
  }, [result]);

  return (
    <div className="space-y-8 bg-gray-900 bg-[radial-gradient(#ffffff1a_1px,transparent_1px)] [background-size:32px_32px]">
      <div className="p-6 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">
          DevOps File Generator
        </h1>
        <p className="text-gray-400 mb-6">
          Select your project folder and let the AI generate your complete
          DevOps setup.
        </p>
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleSelectRepo}
            variant="secondary"
            className="flex-shrink-0 shadow-lg flex"
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

      <div
        className={`transition-opacity duration-500 ease-in-out ${
          loading ? "opacity-100" : "opacity-0 h-0"
        }`}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center p-10 bg-gray-800/50 rounded-lg backdrop-blur-sm">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-300">
              Scanning repository and generating files...
            </p>
          </div>
        )}
      </div>

      <div
        className={`transition-opacity duration-700 ease-in-out ${
          result && !loading ? "opacity-100" : "opacity-0"
        }`}
      >
        {result && Object.keys(files).length > 0 && (
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
                    <div className="bg-gray-800 border-b border-gray-700 p-3 sticky top-0 font-mono text-sm text-indigo-300 z-10">
                      {selectedFile.path}
                    </div>
                    <div className="flex-grow overflow-y-auto">
                      {selectedFile.path.endsWith(".md") ? (
                        <article className="prose prose-invert p-4 text-white">
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
      </div>
    </div>
  );
};

export default DevOpsView;
