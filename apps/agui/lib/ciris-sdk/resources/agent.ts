// CIRIS TypeScript SDK - Agent Resource

import { BaseResource } from './base';
import {
  AgentStatus,
  AgentIdentity,
  InteractResponse,
  ConversationHistory,
  ConversationMessage
} from '../types';

export class AgentResource extends BaseResource {
  /**
   * Submit a message for async processing (SSE-compatible)
   */
  async submitMessage(
    message: string,
    options: {
      channel_id?: string;
      context?: Record<string, any>;
    } = {}
  ): Promise<{
    message_id: string;
    task_id: string | null;
    channel_id: string;
    submitted_at: string;
    accepted: boolean;
    rejection_reason: string | null;
    rejection_detail: string | null;
  }> {
    return this.transport.post('/v1/agent/message', {
      message,
      channel_id: options.channel_id || 'web_ui',
      context: options.context
    });
  }

  /**
   * Send a message to the agent (legacy, synchronous)
   */
  async interact(
    message: string,
    options: {
      channel_id?: string;
      context?: Record<string, any>;
    } = {}
  ): Promise<InteractResponse> {
    return this.transport.post<InteractResponse>('/v1/agent/interact', {
      message,
      channel_id: options.channel_id || 'web_ui',
      context: options.context
    });
  }

  /**
   * Get agent status
   */
  async getStatus(): Promise<AgentStatus> {
    return this.transport.get<AgentStatus>('/v1/agent/status');
  }

  /**
   * Get agent identity
   */
  async getIdentity(): Promise<AgentIdentity> {
    return this.transport.get<AgentIdentity>('/v1/agent/identity');
  }

  /**
   * Get conversation history
   */
  async getHistory(options: {
    channel_id?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ConversationHistory> {
    return this.transport.get<ConversationHistory>('/v1/agent/history', {
      params: {
        channel_id: options.channel_id,
        limit: options.limit || 50,
        offset: options.offset || 0
      }
    });
  }

  /**
   * Get available channels
   */
  async getChannels(): Promise<any[]> {
    const response = await this.transport.get<{ channels: any[]; total_count: number }>('/v1/agent/channels');
    return response.channels || [];
  }

  /**
   * Clear conversation history for a channel
   */
  async clearHistory(channel_id: string): Promise<void> {
    return this.transport.delete(`/v1/agent/history/${channel_id}`);
  }

  /**
   * Get a specific message
   */
  async getMessage(messageId: string): Promise<ConversationMessage> {
    return this.transport.get<ConversationMessage>(`/v1/agent/message/${messageId}`);
  }
}
