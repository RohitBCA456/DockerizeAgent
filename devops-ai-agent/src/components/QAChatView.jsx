// DevOpsView.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";
import Button from "./ui/Button";
import Spinner from "./ui/Spinner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, PlusSquare, MessageSquare } from "lucide-react";
import { v4 as uuidv4 } from 'uuid'; // A library to generate unique IDs

// Helper function to check if a date is within the last 5 days
const isWithinLast5Days = (timestamp) => {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  return new Date(timestamp) > fiveDaysAgo;
};

// =================================================================
// 1. Chat Sidebar Component (No changes needed)
// =================================================================
const ChatSidebar = ({ sessions, activeChatId, onNewChat, onSelectChat }) => {
  return (
    <div className="w-1/4 bg-gray-800 flex flex-col p-3 border-r border-gray-700">
      <Button
        onClick={onNewChat}
        variant="secondary"
        className="w-full flex items-center justify-center gap-2 mb-4"
      >
        <PlusSquare className="w-5 h-5" /> New Chat
      </Button>
      <div className="flex-grow overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-400 mb-2 px-2">Recent Chats (Last 5 Days)</h2>
        <ul className="space-y-1">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                onClick={() => onSelectChat(session.id)}
                className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 truncate text-sm ${
                  session.id === activeChatId
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{session.title || 'New Chat'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};


// =================================================================
// 2. Main Chat Window Component (No changes needed)
// =================================================================
const ChatWindow = ({ messages, currentQuestion, setCurrentQuestion, handleSendMessage, loading }) => {
  const chatContainerRef = useRef(null);

  // Auto-scroll to the bottom of the chat on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white w-3/4">
        <div className="p-4 border-b border-gray-700 text-center">
            <h1 className="text-xl font-bold">DevOps Assistant</h1>
        </div>

        <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6">
            {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'human' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${msg.role === 'human' ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                    {msg.role === 'human' ? 'U' : 'AI'}
                </div>
                <div className={`max-w-xl px-4 py-2 rounded-lg ${msg.role === 'human' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                    <article className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                        </ReactMarkdown>
                    </article>
                </div>
            </div>
            ))}
            {loading && (
                <div className="flex items-start gap-3 flex-row">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-600">AI</div>
                    <div className="bg-gray-700 rounded-lg p-3">
                        <Spinner size="sm" />
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input
                type="text"
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                placeholder="Ask anything about DevOps or deployment..."
                className="flex-grow bg-gray-800 border border-gray-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
            />
            <Button type="submit" variant="primary" disabled={loading || !currentQuestion} size="lg">
                <Send className="w-5 h-5"/>
            </Button>
            </form>
        </div>
    </div>
  );
};


// =================================================================
// 3. Parent View Component - Manages all state and logic (CORRECTED)
// =================================================================
const QAChatView = () => {
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ FIX 1: Wrap handleNewChat in useCallback to give it a stable identity
  const handleNewChat = useCallback(() => {
    const newChat = {
      id: uuidv4(),
      title: "New Chat",
      timestamp: new Date().toISOString(),
      messages: [],
    };
    setChatSessions(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  }, []); // Empty dependency array ensures this function is created only once

  // Load chats from localStorage on initial render
  useEffect(() => {
    const savedSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
    const recentSessions = savedSessions.filter(s => isWithinLast5Days(s.timestamp));
    
    setChatSessions(recentSessions);

    if (recentSessions.length > 0) {
      setActiveChatId(recentSessions[0].id);
    } else {
      handleNewChat(); // Create a new chat if no recent ones exist
    }
  // ✅ FIX 2: Add the stable handleNewChat function as a dependency
  }, [handleNewChat]);

  // Save chats to localStorage whenever they change
  useEffect(() => {
    // Only save if chatSessions has been initialized
    if (chatSessions.length > 0) {
        localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    }
  }, [chatSessions]);

  const handleSelectChat = (id) => {
    setActiveChatId(id);
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const question = currentQuestion.trim();
    if (!question || loading || !activeChatId) return;

    const userMessage = { role: 'human', content: question };
    
    // This function correctly updates the session with a new message
    const updateSessions = (newMessage) => {
      setChatSessions(prevSessions => {
        const updatedSessions = prevSessions.map(session => {
          if (session.id === activeChatId) {
            // If it's the first message, update the title
            const newTitle = session.messages.length === 0 ? question : session.title;
            return {
              ...session,
              title: newTitle,
              messages: [...session.messages, newMessage],
            };
          }
          return session;
        });
        return updatedSessions;
      });
    };

    updateSessions(userMessage); // Add user's message to state
    setCurrentQuestion("");
    setLoading(true);

    try {
      // Use the Chrome-driven web search for any query
      const resp = await api.searchWeb(question);
      let text = 'No results found.';
      if (resp && Array.isArray(resp.results) && resp.results.length) {
        const r = resp.results[0];
        text = r.snippet ? `${r.snippet}\n\n${r.href || ''}` : `${r.title || r.href}`;
      }
      const aiMessage = { role: 'ai', content: text };
      updateSessions(aiMessage);
    } catch (err) {
      const errorMessage = { role: 'ai', content: `Search failed: ${err.message || 'Please try again.'}` };
      updateSessions(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const activeChat = chatSessions.find(s => s.id === activeChatId);
  const activeMessages = activeChat ? activeChat.messages : [];

  return (
    <div className="flex h-full">
      <ChatSidebar 
        sessions={chatSessions} 
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
      />
      <ChatWindow 
        messages={activeMessages}
        currentQuestion={currentQuestion}
        setCurrentQuestion={setCurrentQuestion}
        handleSendMessage={handleSendMessage}
        loading={loading}
      />
    </div>
  );
};

export default QAChatView;