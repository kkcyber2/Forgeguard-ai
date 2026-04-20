// =====================================================
// Global State Management (Zustand)
// =====================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, Project, Message, ChatMessage } from '@/types';

// =====================================================
// Auth Store
// =====================================================
interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));

// =====================================================
// Chat Store
// =====================================================
interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  isTyping: boolean;
  unreadCount: number;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setTyping: (typing: boolean) => void;
  clearMessages: () => void;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  messages: [],
  isTyping: false,
  unreadCount: 0,
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setTyping: (typing) => set({ isTyping: typing }),
  clearMessages: () => set({ messages: [] }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}));

// =====================================================
// Dashboard Store
// =====================================================
interface DashboardState {
  projects: Project[];
  messages: Message[];
  unreadMessages: number;
  isLoading: boolean;
  setProjects: (projects: Project[]) => void;
  setMessages: (messages: Message[]) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  addMessage: (message: Message) => void;
  markMessageAsRead: (messageId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  projects: [],
  messages: [],
  unreadMessages: 0,
  isLoading: false,
  setProjects: (projects) => set({ projects }),
  setMessages: (messages) =>
    set({
      messages,
      unreadMessages: messages.filter((m) => !m.is_read).length,
    }),
  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),
  updateProject: (project) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id ? project : p
      ),
    })),
  addMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages],
      unreadMessages: message.is_read
        ? state.unreadMessages
        : state.unreadMessages + 1,
    })),
  markMessageAsRead: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, is_read: true } : m
      ),
      unreadMessages: Math.max(0, state.unreadMessages - 1),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// =====================================================
// UI Store
// =====================================================
interface UIState {
  isMobileMenuOpen: boolean;
  isScrolled: boolean;
  activeSection: string;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  setScrolled: (scrolled: boolean) => void;
  setActiveSection: (section: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMobileMenuOpen: false,
  isScrolled: false,
  activeSection: 'hero',
  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  setScrolled: (scrolled) => set({ isScrolled: scrolled }),
  setActiveSection: (section) => set({ activeSection: section }),
}));

// =====================================================
// Demo Store (for red teaming demo)
// =====================================================
interface DemoState {
  testInput: string;
  results: Array<{
    input: string;
    threatDetected: boolean;
    confidence: number;
    category: string | null;
    explanation: string;
  }>;
  isAnalyzing: boolean;
  setTestInput: (input: string) => void;
  addResult: (result: DemoState['results'][0]) => void;
  setAnalyzing: (analyzing: boolean) => void;
  clearResults: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  testInput: '',
  results: [],
  isAnalyzing: false,
  setTestInput: (input) => set({ testInput: input }),
  addResult: (result) =>
    set((state) => ({ results: [result, ...state.results] })),
  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  clearResults: () => set({ results: [] }),
}));

// =====================================================
// Settings Store (persisted)
// =====================================================
interface SettingsState {
  theme: 'dark' | 'light' | 'system';
  reduceMotion: boolean;
  highContrast: boolean;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setReduceMotion: (reduce: boolean) => void;
  setHighContrast: (high: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      reduceMotion: false,
      highContrast: false,
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setHighContrast: (highContrast) => set({ highContrast }),
    }),
    {
      name: 'forgeguard-settings',
    }
  )
);
