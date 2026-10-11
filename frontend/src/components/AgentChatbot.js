import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { sendChatMessage } from '../utils/api';
import './AgentChatbot.css';

// Feature 20: Suggested quick-reply questions
const SUGGESTED_QUESTIONS = [
  'What should I fix first?',
  'Explain the most critical finding',
  'Generate a security summary',
  'How do I fix missing HSTS?',
];

// Feature 14: Build a scan-aware system message when scan data is available
function buildSystemMessage(scan) {
  if (!scan) return null;
  const { summary = {}, findings = [], url } = scan;
  const top = findings
    .slice(0, 5)
    .map(f => `- [${f.severity?.toUpperCase()}] ${f.title}: ${f.description?.slice(0, 80)}`)
    .join('\n');
  return {
    role: 'user',
    parts: [{
      text: `You are Scantinel AI, a security expert assistant. The user just scanned "${url}" and got grade ${summary.grade} (score ${summary.riskScore}/100). ` +
        `Findings: ${summary.critical || 0} critical, ${summary.high || 0} high, ${summary.medium || 0} medium, ${summary.low || 0} low.\n` +
        `Top issues:\n${top}\n\nPlease answer the user's questions about this scan with specific, actionable advice.`
    }]
  };
}

export default function AgentChatbot({ scan }) {
  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: scan
        ? `Hello! I'm Scantinel AI. I've analyzed **${scan.url}** — grade **${scan.summary?.grade || '?'}** with ${scan.summary?.total || 0} total issues. Ask me anything about the findings!`
        : "Hello! I'm Scantinel AI. I can help you analyze scan results, explain vulnerabilities, or answer security questions. How can I help?"
    }
  ]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const chatbotRef     = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (chatbotRef.current && !chatbotRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Helper to format basic markdown
  const formatText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let inList = false;

    const renderLineText = (str) => {
      const parts = str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} style={{ color: 'var(--primary-color, #00D4FF)' }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px' }}>{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      });
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
      const isNumber = /^\d+\.\s/.test(trimmed);
      if (isBullet || isNumber) {
        if (!inList) inList = true;
        const content = isBullet ? trimmed.substring(2) : trimmed.replace(/^\d+\.\s/, '');
        listItems.push(<li key={i} style={{ marginBottom: '6px', lineHeight: '1.5' }}>{renderLineText(content)}</li>);
      } else {
        if (inList) {
          elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: '20px', margin: '8px 0', listStyleType: 'disc' }}>{listItems}</ul>);
          listItems = []; inList = false;
        }
        if (trimmed.startsWith('### '))
          elements.push(<h4 key={i} style={{ margin: '12px 0 8px 0', fontSize: '1.05rem', fontWeight: 'bold' }}>{renderLineText(trimmed.substring(4))}</h4>);
        else if (trimmed.startsWith('## '))
          elements.push(<h3 key={i} style={{ margin: '14px 0 8px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>{renderLineText(trimmed.substring(3))}</h3>);
        else if (trimmed.startsWith('# '))
          elements.push(<h2 key={i} style={{ margin: '16px 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>{renderLineText(trimmed.substring(2))}</h2>);
        else if (trimmed)
          elements.push(<p key={i} style={{ marginBottom: '8px', lineHeight: '1.5' }}>{renderLineText(trimmed)}</p>);
      }
    });
    if (inList) elements.push(<ul key="ul-end" style={{ paddingLeft: '20px', margin: '8px 0', listStyleType: 'disc' }}>{listItems}</ul>);
    return elements;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    setShowSuggestions(false);
    const userText = text.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    setIsLoading(true);
    try {
      // Build the history to send to the API
      // Feature 14: Prepend the scan-aware system context if we have scan data
      const sysMsg = buildSystemMessage(scan);
      const historyForApi = newMessages
        .filter(m => !m.text.startsWith("Hello! I'm Scantinel AI"))
        .map(msg => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] }));
      const messagesToSend = sysMsg ? [sysMsg, ...historyForApi] : historyForApi;
      const response = await sendChatMessage(messagesToSend);
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (err) {
      const isNetworkError = err.message?.includes('Network Error') || err.message?.includes('failed') || err.message?.includes('404');
      const errorMsg = isNetworkError
        ? 'Failed to connect to the backend server. Please verify the backend is running and the API URL is configured correctly.'
        : `Error: ${err.message || 'An unexpected error occurred.'}. Please ensure the Gemini API key is configured.`;
      setMessages(prev => [...prev, {
        role: 'model',
        text: `Sorry, I encountered an error. ${errorMsg}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e) => { e.preventDefault(); sendMessage(input); };

  return (
    <div className="chatbot-container" ref={chatbotRef}>
      {!isOpen ? (
        <button className="chatbot-toggle glass-button" onClick={() => setIsOpen(true)} title="Ask Scantinel AI">
          <MessageSquare size={24} />
          {scan && <span className="chatbot-scan-dot" />}
        </button>
      ) : (
        <div className="chatbot-window glass-panel">
          <div className="chatbot-header">
            <div className="chatbot-title">
              <Bot size={20} className="text-primary" />
              <span>Scantinel AI</span>
              {scan && <span className="chatbot-context-badge"><Sparkles size={10} />Scan-aware</span>}
            </div>
            <button className="chatbot-close" onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="chatbot-messages custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="chat-avatar">
                  {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className="chat-bubble" style={{ display: 'flex', flexDirection: 'column' }}>
                  {formatText(msg.text)}
                </div>
              </div>
            ))}

            {/* Feature 12: Suggested questions */}
            {showSuggestions && messages.length === 1 && (
              <div className="chatbot-suggestions">
                <div className="chatbot-suggestions-label">Quick questions</div>
                <div className="chatbot-suggestions-grid">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      className="chatbot-suggestion-btn"
                      onClick={() => sendMessage(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="chat-message model">
                <div className="chat-avatar"><Bot size={16} /></div>
                <div className="chat-bubble typing">
                  <div className="dot" /><div className="dot" /><div className="dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input-area" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={scan ? `Ask about ${scan.url}…` : 'Ask about your security scan...'}
              disabled={isLoading}
            />
            <button type="submit" disabled={!input.trim() || isLoading} className="send-btn">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
