'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cirisClient, unwrapConfigValue, wrapConfigValue } from '../../lib/ciris-sdk';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import toast from 'react-hot-toast';
import { SpinnerIcon, ExclamationTriangleIcon, ChevronRightIcon, KeyIcon, ServerIcon, DatabaseIcon, ShieldIcon, CogIcon } from '../../components/Icons';

// Configuration categories with icons and descriptions
const CONFIG_CATEGORIES = {
  adapters: {
    icon: ServerIcon,
    label: 'Adapters',
    description: 'Communication adapter configurations',
    color: 'purple'
  },
  services: {
    icon: CogIcon,
    label: 'Services',
    description: 'Service-specific settings',
    color: 'blue'
  },
  security: {
    icon: ShieldIcon,
    label: 'Security',
    description: 'Security and authentication settings',
    color: 'red'
  },
  database: {
    icon: DatabaseIcon,
    label: 'Database',
    description: 'Database connection settings',
    color: 'green'
  },
  limits: {
    icon: ExclamationTriangleIcon,
    label: 'Limits',
    description: 'Rate limits and constraints',
    color: 'yellow'
  },
  workflow: {
    icon: CogIcon,
    label: 'Workflow',
    description: 'Task and workflow settings',
    color: 'indigo'
  },
  telemetry: {
    icon: ChevronRightIcon,
    label: 'Telemetry',
    description: 'Monitoring and telemetry',
    color: 'orange'
  }
};

// Type definitions
interface ConfigItem {
  key: string;
  value: any;
  updated_at: string;
  updated_by?: string;
  is_sensitive?: boolean;
  description?: string;
}

interface ConfigSection {
  name: string;
  items: ConfigItem[];
  category?: string;
}

export default function ConfigPage() {
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch configuration
  const { data: configResponse, isLoading } = useQuery({
    queryKey: ['config-list'],
    queryFn: () => cirisClient.config.getAll(),
  });

  // Fetch adapters for adapter-specific configs
  const { data: adapters } = useQuery({
    queryKey: ['adapters'],
    queryFn: () => cirisClient.system.getAdapters(),
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      return cirisClient.config.set(key, value, 'Updated via UI');
    },
    onSuccess: (_, { key }) => {
      toast.success(`Configuration "${key}" updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['config-list'] });
      delete editedValues[key];
      setEditedValues({ ...editedValues });
    },
    onError: (error: any, { key }) => {
      toast.error(error.response?.data?.detail || `Failed to update "${key}"`);
    },
  });

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (key: string) => {
      return cirisClient.config.delete(key);
    },
    onSuccess: (_, key) => {
      toast.success(`Configuration "${key}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['config-list'] });
    },
    onError: (error: any, key) => {
      toast.error(error.response?.data?.detail || `Failed to delete "${key}"`);
    },
  });

  // Organize configs into sections
  const organizedConfigs = useMemo(() => {
    if (!configResponse) return {};

    const sections: Record<string, ConfigSection> = {};
    const configs = configResponse.configs.map(item => ({
      ...item,
      value: item.value ? unwrapConfigValue(item.value) : null
    }));

    // Filter by search term
    const filteredConfigs = configs.filter(item => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        item.key.toLowerCase().includes(searchLower) ||
        JSON.stringify(item.value).toLowerCase().includes(searchLower)
      );
    });

    // Group by sections
    filteredConfigs.forEach(item => {
      const parts = item.key.split('.');
      let sectionName = parts[0] || 'default';
      let category = null;

      // Determine category
      for (const [cat, info] of Object.entries(CONFIG_CATEGORIES)) {
        if (item.key.startsWith(cat)) {
          category = cat;
          break;
        }
      }

      // Special handling for adapter configs
      if (item.key.startsWith('adapter.') && parts.length >= 3) {
        const adapterId = parts[1];
        sectionName = `adapter.${adapterId}`;
        category = 'adapters';
      }

      if (!sections[sectionName]) {
        sections[sectionName] = {
          name: sectionName,
          items: [],
          category: category ?? undefined
        };
      }

      sections[sectionName].items.push(item);
    });

    // Add adapter configurations from adapters endpoint
    if (adapters && adapters.adapters) {
      adapters.adapters.forEach(adapter => {
        const sectionName = `adapter.${adapter.adapter_id}`;

        // Skip if filtered by search
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          if (
            !adapter.adapter_id.toLowerCase().includes(searchLower) &&
            !adapter.adapter_type.toLowerCase().includes(searchLower) &&
            !JSON.stringify(adapter.config || {}).toLowerCase().includes(searchLower)
          ) {
            return;
          }
        }

        if (!sections[sectionName]) {
          sections[sectionName] = {
            name: sectionName,
            items: [],
            category: 'adapters'
          };
        }

        // Add adapter config as a pseudo-config item
        sections[sectionName].items.push({
          key: `${adapter.adapter_id}.config`,
          value: adapter.config || {},
          updated_at: adapter.created_at || new Date().toISOString(),
          updated_by: 'system',
          is_sensitive: false
        });

        // Add adapter status info
        sections[sectionName].items.push({
          key: `${adapter.adapter_id}.status`,
          value: {
            type: adapter.adapter_type,
            is_running: adapter.is_running,
            last_activity: adapter.last_activity || 'Never'
          },
          updated_at: new Date().toISOString(),
          updated_by: 'system',
          is_sensitive: false
        });
      });
    }

    // Sort sections
    const sortedSections: Record<string, ConfigSection> = {};
    Object.keys(sections)
      .sort()
      .forEach(key => {
        sortedSections[key] = sections[key];
      });

    return sortedSections;
  }, [configResponse, searchTerm, adapters]);

  // Filter sections by category
  const filteredSections = useMemo(() => {
    if (!selectedCategory) return organizedConfigs;

    const filtered: Record<string, ConfigSection> = {};
    Object.entries(organizedConfigs).forEach(([key, section]) => {
      if (section.category === selectedCategory) {
        filtered[key] = section;
      }
    });
    return filtered;
  }, [organizedConfigs, selectedCategory]);

  // Toggle section expansion
  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  // Handle value change
  const handleValueChange = (key: string, value: any) => {
    setEditedValues({
      ...editedValues,
      [key]: value
    });
  };

  // Get display value (edited or original)
  const getDisplayValue = (key: string, originalValue: any) => {
    return editedValues.hasOwnProperty(key) ? editedValues[key] : originalValue;
  };

  // Check if value has been edited
  const isEdited = (key: string) => editedValues.hasOwnProperty(key);

  // Save changes
  const saveChanges = async () => {
    const updates = Object.entries(editedValues);
    if (updates.length === 0) {
      toast('No changes to save');
      return;
    }

    for (const [key, value] of updates) {
      await updateConfigMutation.mutateAsync({ key, value });
    }
  };

  // Render config value input
  const renderValueInput = (item: ConfigItem) => {
    const value = getDisplayValue(item.key, item.value);
    const edited = isEdited(item.key);

    if (typeof item.value === 'boolean') {
      return (
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleValueChange(item.key, e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-600">{value ? 'Enabled' : 'Disabled'}</span>
        </label>
      );
    } else if (typeof item.value === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleValueChange(item.key, parseFloat(e.target.value) || 0)}
          className={`block w-full rounded-md shadow-sm sm:text-sm ${
            edited ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
          } focus:ring-indigo-500 focus:border-indigo-500`}
        />
      );
    } else if (typeof item.value === 'object' && item.value !== null) {
      return (
        <div className="relative">
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleValueChange(item.key, parsed);
              } catch {
                // Invalid JSON, keep as string for now
              }
            }}
            className={`block w-full rounded-md shadow-sm sm:text-sm font-mono ${
              edited ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
            } focus:ring-indigo-500 focus:border-indigo-500`}
            rows={4}
          />
        </div>
      );
    } else {
      return (
        <input
          type={item.is_sensitive ? 'password' : 'text'}
          value={value || ''}
          onChange={(e) => handleValueChange(item.key, e.target.value)}
          className={`block w-full rounded-md shadow-sm sm:text-sm ${
            edited ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
          } focus:ring-indigo-500 focus:border-indigo-500 ${
            item.is_sensitive ? 'font-mono' : ''
          }`}
          placeholder={item.value === null ? 'Not set' : ''}
        />
      );
    }
  };

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configuration Management</h1>
          <p className="mt-2 text-lg text-gray-600">
            Manage system configuration with live updates and validation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Categories</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedCategory === null
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  All Configurations
                </button>
                {Object.entries(CONFIG_CATEGORIES).map(([key, info]) => {
                  const Icon = info.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center ${
                        selectedCategory === key
                          ? `bg-${info.color}-100 text-${info.color}-700`
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="mr-2" size="sm" />
                      {info.label}
                    </button>
                  );
                })}
              </nav>

              {/* Adapter List */}
              {adapters && adapters.adapters.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Active Adapters</h3>
                  <div className="space-y-1 text-xs">
                    {adapters.adapters.map(adapter => (
                      <div key={adapter.adapter_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">{adapter.adapter_id}</span>
                        <span className="text-gray-500">{adapter.adapter_type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Configuration Panel */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                {/* Toolbar */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex-1 max-w-sm">
                    <input
                      type="text"
                      placeholder="Search configurations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-3 ml-4">
                    <button
                      onClick={() => setExpandedSections(new Set(Object.keys(filteredSections)))}
                      className="text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      Expand All
                    </button>
                    <button
                      onClick={() => setExpandedSections(new Set())}
                      className="text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      Collapse All
                    </button>
                    {Object.keys(editedValues).length > 0 && (
                      <button
                        onClick={saveChanges}
                        disabled={updateConfigMutation.isPending}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {updateConfigMutation.isPending ? 'Saving...' : `Save ${Object.keys(editedValues).length} Changes`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Configuration Sections */}
                {isLoading ? (
                  <div className="text-center py-8">
                    <SpinnerIcon className="mx-auto text-indigo-600" size="lg" />
                    <p className="mt-2 text-gray-500">Loading configuration...</p>
                  </div>
                ) : Object.keys(filteredSections).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No configurations found matching your criteria.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(filteredSections).map(([sectionName, section]) => {
                      const isExpanded = expandedSections.has(sectionName);
                      const categoryInfo = section.category ? CONFIG_CATEGORIES[section.category as keyof typeof CONFIG_CATEGORIES] : null;

                      return (
                        <div key={sectionName} className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleSection(sectionName)}
                            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <ChevronRightIcon
                                className={`mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                size="sm"
                              />
                              <span className="font-medium text-gray-900">{sectionName}</span>
                              <span className="ml-2 text-sm text-gray-500">({section.items.length} items)</span>
                              {categoryInfo && (
                                <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${categoryInfo.color}-100 text-${categoryInfo.color}-800`}>
                                  {categoryInfo.label}
                                </span>
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-4 space-y-4">
                              {section.items.map(item => (
                                <div key={item.key} className="flex items-start space-x-4">
                                  <div className="flex-1">
                                    <div className="flex items-center mb-1">
                                      <label className="block text-sm font-medium text-gray-700">
                                        {item.key}
                                      </label>
                                      {item.is_sensitive && (
                                        <KeyIcon className="ml-2 text-orange-500" size="sm" />
                                      )}
                                      {isEdited(item.key) && (
                                        <span className="ml-2 text-xs text-yellow-600">• Modified</span>
                                      )}
                                    </div>
                                    {renderValueInput(item)}
                                    <div className="mt-1 text-xs text-gray-500">
                                      Last updated: {new Date(item.updated_at).toLocaleString()} by {item.updated_by}
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {isEdited(item.key) && (
                                      <button
                                        onClick={() => {
                                          delete editedValues[item.key];
                                          setEditedValues({ ...editedValues });
                                        }}
                                        className="text-sm text-gray-600 hover:text-gray-900"
                                      >
                                        Reset
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete "${item.key}"?`)) {
                                          deleteConfigMutation.mutate(item.key);
                                        }
                                      }}
                                      className="text-sm text-red-600 hover:text-red-900"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
