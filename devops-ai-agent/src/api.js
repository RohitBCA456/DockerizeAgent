import axios from "axios";

export const API_URL = "http://localhost:4000";

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let lastDevopsResult = null;

export const api = {
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get("/api/current_user");
      return response.data;
    } catch (error) {
      return null;
    }
  },

  logout: async () => {
    await apiClient.get("/api/logout");
  },

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

  getChatHistory: async () => {
    try {
      const response = await apiClient.get("/api/chat-history");
      return response.data;
    } catch (error) {
      // Chat/history endpoints are not supported in deterministic mode
      throw new Error(error.response?.data?.error || "Chat endpoints are disabled in deterministic mode.");
    }
  },

  askDevopsBot: async (question) => {
    throw new Error("LLM-based DevOps bot is disabled. Use the generated files and security report instead.");
  },

  chatWithDevops: async (repoPath, question) => {
    throw new Error("LLM-based chat endpoints are disabled in deterministic mode.");
  },

  getLastDevopsResult: () => {
    return lastDevopsResult;
  },

  searchWeb: async (query) => {
    try {
      const response = await apiClient.post('/search-web', { query });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Search failed');
    }
  },

  getSecurityDetails: async (repoPath) => {
    try {
      const response = await apiClient.post('/security-details', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to get security details');
    }
  }
  ,
  quickHealth: async (repoPath) => {
    try {
      const response = await apiClient.post('/quick-health', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Quick health failed');
    }
  },

  riskSearch: async (repoPath, query) => {
    try {
      const response = await apiClient.post('/risk-search', { repoPath, query });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Risk search failed');
    }
  },

  getArchitectureMap: async (repoPath) => {
    try {
      const response = await apiClient.post('/architecture-map', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to generate architecture map');
    }
  }
  ,
  getThreatModel: async (repoPath) => {
    try {
      const response = await apiClient.post('/threat-model', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to generate threat model');
    }
  },
  getDisasterRecoveryPlan: async (repoPath) => {
    try {
      const response = await apiClient.post('/disaster-recovery', { repoPath });
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to generate disaster recovery plan');
    }
  }
};
