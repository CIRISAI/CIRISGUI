// CIRIS TypeScript SDK - Config Resource

import { BaseResource } from './base';
import { ConfigData } from '../types';

export interface ConfigValueWrapper {
  string_value?: string | null;
  int_value?: number | null;
  float_value?: number | null;
  bool_value?: boolean | null;
  list_value?: any[] | null;
  dict_value?: any | null;
}

export interface ConfigValue {
  key: string;
  value: ConfigValueWrapper;
  description?: string;
  updated_at: string;
  updated_by?: string;
  is_sensitive?: boolean;
}

export interface ConfigUpdateResponse {
  success: boolean;
  key: string;
  previous_value?: any;
  new_value: any;
  message?: string;
}

export interface ConfigDeleteResponse {
  success: boolean;
  key: string;
  message: string;
  deleted_value?: any;
}

export interface ConfigListResponse {
  configs: ConfigValue[];
  total: number;
}

// Helper function to extract actual value from wrapper
export function unwrapConfigValue(wrapper: ConfigValueWrapper | null | undefined): any {
  if (!wrapper) return null;

  if (wrapper.string_value !== null && wrapper.string_value !== undefined) return wrapper.string_value;
  if (wrapper.int_value !== null && wrapper.int_value !== undefined) return wrapper.int_value;
  if (wrapper.float_value !== null && wrapper.float_value !== undefined) return wrapper.float_value;
  if (wrapper.bool_value !== null && wrapper.bool_value !== undefined) return wrapper.bool_value;
  if (wrapper.list_value !== null && wrapper.list_value !== undefined) return wrapper.list_value;
  if (wrapper.dict_value !== null && wrapper.dict_value !== undefined) return wrapper.dict_value;
  return null;
}

// Helper function to wrap value for API
export function wrapConfigValue(value: any): ConfigValueWrapper {
  const wrapper: ConfigValueWrapper = {
    string_value: null,
    int_value: null,
    float_value: null,
    bool_value: null,
    list_value: null,
    dict_value: null
  };

  if (typeof value === 'string') {
    wrapper.string_value = value;
  } else if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      wrapper.int_value = value;
    } else {
      wrapper.float_value = value;
    }
  } else if (typeof value === 'boolean') {
    wrapper.bool_value = value;
  } else if (Array.isArray(value)) {
    wrapper.list_value = value;
  } else if (typeof value === 'object' && value !== null) {
    wrapper.dict_value = value;
  }

  return wrapper;
}

export class ConfigResource extends BaseResource {
  /**
   * Get all configuration values
   */
  async getAll(): Promise<ConfigListResponse> {
    return this.transport.get<ConfigListResponse>('/v1/config');
  }

  /**
   * Update multiple configuration values
   */
  async updateMultiple(updates: { [key: string]: any }): Promise<{
    success: boolean;
    updated: string[];
    failed: string[];
    message: string;
  }> {
    // Convert to individual updates
    const results = await Promise.allSettled(
      Object.entries(updates).map(([key, value]) => this.set(key, value))
    );

    const updated: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      const key = Object.keys(updates)[index];
      if (result.status === 'fulfilled') {
        updated.push(key);
      } else {
        failed.push(key);
      }
    });

    return {
      success: failed.length === 0,
      updated,
      failed,
      message: failed.length === 0 ? 'All configurations updated' : `${failed.length} updates failed`
    };
  }

  /**
   * Get a specific configuration value
   */
  async get(key: string): Promise<ConfigValue> {
    return this.transport.get<ConfigValue>(`/v1/config/${key}`);
  }

  /**
   * Set a specific configuration value
   */
  async set(key: string, value: any, reason?: string): Promise<ConfigValue> {
    // The API expects the value directly, not wrapped
    return this.transport.put<ConfigValue>(`/v1/config/${key}`, {
      value,
      reason
    });
  }

  /**
   * Delete a specific configuration value
   */
  async delete(key: string): Promise<{ status: string; key: string }> {
    return this.transport.delete<{ status: string; key: string }>(`/v1/config/${key}`);
  }

  /**
   * Get configuration (returns unwrapped values for backward compatibility)
   */
  async getConfig(): Promise<ConfigData> {
    const response = await this.getAll();
    const config: ConfigData = {};

    response.configs.forEach(item => {
      config[item.key] = unwrapConfigValue(item.value);
    });

    return config;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: ConfigData): Promise<{
    success: boolean;
    updated: string[];
    failed: string[];
    message: string;
  }> {
    return this.updateMultiple(updates);
  }

  /**
   * Get a single configuration value by key (returns unwrapped value)
   */
  async getConfigByKey(key: string): Promise<{ key: string; value: any; updated_at: string; updated_by?: string }> {
    const configValue = await this.get(key);
    return {
      key: configValue.key,
      value: unwrapConfigValue(configValue.value),
      updated_at: configValue.updated_at,
      updated_by: configValue.updated_by
    };
  }

  /**
   * Update a single configuration value by key
   */
  async updateConfigByKey(key: string, value: any, reason?: string): Promise<ConfigUpdateResponse> {
    const result = await this.set(key, value, reason);
    return {
      success: true,
      key: result.key,
      new_value: unwrapConfigValue(result.value),
      message: 'Configuration updated successfully'
    };
  }

  /**
   * Get configuration values by prefix
   */
  async getByPrefix(prefix: string): Promise<ConfigListResponse> {
    return this.transport.get<ConfigListResponse>(`/v1/config?prefix=${encodeURIComponent(prefix)}`);
  }

}
