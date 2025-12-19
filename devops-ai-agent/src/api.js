import axios from "axios";

// Configure your backend's base URL
const API_URL = "http://localhost:4000";

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // This is crucial for sending session cookies
});

// A simple cache to hold the last successful DevOps generation result
let lastDevopsResult = null;

export const api = {
  /**
   * Checks for the currently authenticated user.
   */
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get("/api/current_user");
      return response.data;
    } catch (error) {
      // It's normal for this to fail if not logged in
      return null;
    }
  },

  /**
   * Logs the user out.
   */
  logout: async () => {
    await apiClient.get("/api/logout");
  },

  /**
   * Scans a repository and generates DevOps files.
   * @param {string} repoPath The absolute path to the repository.
   */
  generateDevops: async (repoPath) => {
    try {
      const response = await apiClient.post("/generate-devops", { repoPath });
      lastDevopsResult = response.data; // Cache the successful result
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.details || "Failed to generate DevOps files."
      );
    }
  },

  // ✅ NEW: Fetches the last 5 days of chat history for the current user.
  getChatHistory: async () => {
    try {
      const response = await apiClient.get("/api/chat-history");
      return response.data;
    } catch (error) {
      // Chat/history endpoints are not supported in deterministic mode
      throw new Error(error.response?.data?.error || "Chat endpoints are disabled in deterministic mode.");
    }
  },

  // ✅ NEW: Sends a question to the primary DevOps chatbot with history support.
  askDevopsBot: async (question) => {
    throw new Error("LLM-based DevOps bot is disabled. Use the generated files and security report instead.");
  },

  // ❌ REMOVED: This function is obsolete and replaced by askDevopsBot.
  // askQuestion: async (question) => { ... }

  /**
   * Sends a question to the security report chatbot.
   * @param {string} repoPath The path to the repository.
   * @param {string} question The user's question about the report.
   */
  // This function in your api.js file is correct. No changes needed here.
  chatWithSecurityReport: async (repoPath, question) => {
    try {
      const response = await apiClient.post("/chat-security-report", {
        repoPath,
        question,
      });
      // This correctly returns the { recommendations: "..." } object to the component
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.details || "Chat about security is disabled in deterministic mode.");
    }
  },

  /**
   * Sends a question to the general DevOps chatbot.
   * @param {string} repoPath The path to the repository.
   * @param {string} question The user's general DevOps question.
   */
  chatWithDevops: async (repoPath, question) => {
    throw new Error("LLM-based chat endpoints are disabled in deterministic mode.");
  },

  /**
   * Retrieves the last cached result from a successful DevOps generation.
   */
  getLastDevopsResult: () => {
    return lastDevopsResult;
  },
  /**
   * Web search using headless Chrome (puppeteer) driven on the backend.
   * Returns { query, results: [{title,snippet,href}, ...] }
   */
  searchWeb: async (query) => {
    try {
      const response = await apiClient.post('/search-web', { query });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Search failed');
    }
  },

  /**
   * Get security details (deterministic) for a repo path.
   */
  getSecurityDetails: async (repoPath) => {
    try {
      const response = await apiClient.post('/security-details', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to get security details');
    }
  }
  ,
  preflight: async (repoPath) => {
    try {
      // support optional second parameter for options
      const response = await apiClient.post('/preflight', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Preflight failed');
    }
  },

  /**
   * Get the architecture diagram (Mermaid.js code) for a repository.
   */
  getArchitectureMap: async (repoPath) => {
    try {
      const response = await apiClient.post('/architecture-map', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to generate architecture map');
    }
  }
};
