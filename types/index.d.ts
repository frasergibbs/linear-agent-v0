/**
 * TypeScript type definitions for V0 Platform API
 */

export interface V0SessionContext {
  framework?: 'next' | 'react' | 'vue';
  styling?: 'tailwind' | 'css' | 'styled-components';
  darkMode?: boolean;
  responsive?: boolean;
  accessibility?: boolean;
}

export interface V0SessionResponse {
  chatId: string;
  demoUrl: string;
  files: V0File[];
  metadata: {
    createdAt: string;
    framework?: string;
    styling?: string;
    iterationCount?: number;
    refinedAt?: string;
  };
}

export interface V0File {
  path: string;
  content: string;
  language: string;
}

export interface V0ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  labels?: string[];
  url?: string;
  status?: string;
  priority?: {
    value: number;
    name: string;
  };
}
