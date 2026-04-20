// =====================================================
// AI Chat Assistant Component
// =====================================================

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useChatStore } from '@/lib/store';

// Pre-defined responses for demo (in production, this would use Vercel AI SDK + Groq)
const knowledgeBase = {
  greetings: [
    "Hello! I'm ForgeGuard AI's virtual assistant. How can I help you with AI security today?",
    'Hi there! Ready to discuss securing your AI systems?',
    'Welcome! Ask me anything about AI red teaming and security.',
  ],
  services: {
    'red teaming':
      'Our AI Red Teaming service starts at $1,500 and includes comprehensive prompt injection testing, jailbreak attempts, data extraction tests, and a detailed security report. The typical duration is 1-2 weeks.',
    'llm security audit':
      'We conduct thorough LLM security audits to identify vulnerabilities in your AI systems. This includes testing for adversarial inputs, safety filter bypasses, and more.',
    'secure agents':
      'Our Secure AI Agents service builds production-ready AI automation with security-first architecture. Starting at $2,500 with 2-4 weeks delivery time.',
    'ml model hardening':
      'We help secure your ML deployments with adversarial training, model encryption, and secure API deployment. Starting at $3,000.',
    'prompt engineering':
      'Expert prompt engineering that balances capability with security. We design prompt systems that deliver excellent results while minimizing injection risks. Starting at $800.',
    consultation:
      'I offer one-on-one consultation on AI security strategy, architecture review, and best practices at $200/hour.',
  },
  pricing:
    'Our services start at $800 for prompt engineering, $1,500 for red teaming, $2,500 for secure agents, and $3,000 for ML model hardening. Consultation is $200/hour.',
  contact:
    'You can reach Konain at konain@forgeguard.ai or through the contact form on this website. Response time is typically within 24 hours.',
  location:
    "ForgeGuard AI is based in Karachi, Pakistan, but we work with clients worldwide. All services are available remotely.",
  experience:
    'Konain Sultan Khan is a 17-year-old self-taught AI security specialist with expertise in red teaming, Kali Linux, and modern AI/ML frameworks. He has completed Harvard CS50 and has conducted 50+ security audits.',
  projects:
    'Check out our featured projects: PromptGuard (injection detector), RedTeamLLM (automated testing framework), and SecureAgent (hardened AI assistant). All are available on GitHub.',
  default:
    "I understand you're interested in AI security. Could you provide more details about what you're looking for? I can help with red teaming, security audits, secure AI development, or general consultation.",
};

function generateResponse(input: string): string {
  const lowerInput = input.toLowerCase();

  // Check for greetings
  if (/^(hi|hello|hey|greetings)/i.test(lowerInput)) {
    return knowledgeBase.greetings[
      Math.floor(Math.random() * knowledgeBase.greetings.length)
    ];
  }

  // Check for service inquiries
  for (const [key, response] of Object.entries(knowledgeBase.services)) {
    if (lowerInput.includes(key)) {
      return response;
    }
  }

  // Check for pricing
  if (lowerInput.includes('price') || lowerInput.includes('cost') || lowerInput.includes('how much')) {
    return knowledgeBase.pricing;
  }

  // Check for contact
  if (lowerInput.includes('contact') || lowerInput.includes('email') || lowerInput.includes('reach')) {
    return knowledgeBase.contact;
  }

  // Check for location
  if (lowerInput.includes('location') || lowerInput.includes('where') || lowerInput.includes('based')) {
    return knowledgeBase.location;
  }

  // Check for experience/about
  if (lowerInput.includes('experience') || lowerInput.includes('who') || lowerInput.includes('about') || lowerInput.includes('background')) {
    return knowledgeBase.experience;
  }

  // Check for projects
  if (lowerInput.includes('project') || lowerInput.includes('portfolio') || lowerInput.includes('github')) {
    return knowledgeBase.projects;
  }

  return knowledgeBase.default;
}

export default function AIChat() {
  const { isOpen, messages, toggleChat, addMessage, setTyping } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    });

    setInput('');
    setTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const response = generateResponse(input);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        created_at: new Date().toISOString(),
      });
      setTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-cyan to-blue-500 flex items-center justify-center shadow-lg shadow-cyan/30 hover:shadow-cyan/50 transition-shadow"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6 text-background" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              className="relative"
            >
              <MessageSquare className="w-6 h-6 text-background" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]"
          >
            <div className="glass rounded-2xl overflow-hidden shadow-2xl border border-cyan/20">
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan/20 to-blue-500/20 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-cyan" />
                  </div>
                  <div>
                    <h4 className="font-semibold">ForgeGuard AI</h4>
                    <p className="text-xs text-gray-400">AI Security Assistant</p>
                  </div>
                </div>
                <button
                  onClick={toggleChat}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="h-80 overflow-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                    <Bot className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">
                      Ask me about AI security services, pricing, or how I can help
                      secure your AI systems.
                    </p>
                  </div>
                )}

                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user'
                          ? 'bg-cyan/20'
                          : 'bg-gradient-to-r from-cyan to-blue-500'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-cyan" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-background" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        message.role === 'user'
                          ? 'bg-cyan text-background'
                          : 'bg-white/5'
                      }`}
                    >
                      {message.content}
                    </div>
                  </motion.div>
                ))}

                {useChatStore.getState().isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan to-blue-500 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-background" />
                    </div>
                    <div className="bg-white/5 rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-gray-400"
                        />
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                          className="w-2 h-2 rounded-full bg-gray-400"
                        />
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                          className="w-2 h-2 rounded-full bg-gray-400"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="flex-1 bg-gray-900 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan text-background hover:bg-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
