import React, { useState } from 'react';
import toast from 'react-hot-toast';

interface AdapterConfigModalProps {
  adapterType: string;
  adapterId?: string;
  isEdit?: boolean;
  config: any;
  setConfig: (config: any) => void;
  onSubmit: (adapterType: string, config: any) => void;
  onClose: () => void;
  isPending?: boolean;
}

export function AdapterConfigModal({
  adapterType,
  adapterId,
  isEdit = false,
  config,
  setConfig,
  onSubmit,
  onClose,
  isPending = false
}: AdapterConfigModalProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const handleSubmit = () => {
    // Validation based on adapter type
    if (adapterType === 'discord') {
      if (!config.bot_token) {
        toast.error('Bot token is required');
        return;
      }
      if (!config.server_id) {
        toast.error('Server ID is required');
        return;
      }
    } else if (adapterType === 'api') {
      if (!config.host) {
        toast.error('Host is required');
        return;
      }
      if (!config.port) {
        toast.error('Port is required');
        return;
      }
    }

    onSubmit(adapterType, config);
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    marginTop: '5px'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '5px',
    fontSize: '14px',
    fontWeight: '500'
  };

  const fieldStyle = {
    marginBottom: '15px'
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
          {isEdit ? 'Edit' : 'Configure'} {adapterType.charAt(0).toUpperCase() + adapterType.slice(1)} Adapter {adapterId ? `(${adapterId})` : ''}
        </h3>

        {/* Discord Configuration */}
        {adapterType === 'discord' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Bot Token <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="password"
                value={config.bot_token || ''}
                onChange={(e) => setConfig({ ...config, bot_token: e.target.value })}
                style={inputStyle}
                placeholder={isEdit ? '••••••••' : 'Your Discord bot token'}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Server ID <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={config.server_id || ''}
                onChange={(e) => setConfig({ ...config, server_id: e.target.value })}
                style={inputStyle}
                placeholder="Discord server/guild ID"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Home Channel ID</label>
              <input
                type="text"
                value={config.home_channel_id || ''}
                onChange={(e) => setConfig({ ...config, home_channel_id: e.target.value })}
                style={inputStyle}
                placeholder="Primary channel for agent"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Deferral Channel ID</label>
              <input
                type="text"
                value={config.deferral_channel_id || ''}
                onChange={(e) => setConfig({ ...config, deferral_channel_id: e.target.value })}
                style={inputStyle}
                placeholder="Channel for deferred messages"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Monitored Channel IDs (comma-separated)</label>
              <input
                type="text"
                value={Array.isArray(config.monitored_channel_ids) ? config.monitored_channel_ids.join(', ') : ''}
                onChange={(e) => setConfig({
                  ...config,
                  monitored_channel_ids: e.target.value ? e.target.value.split(',').map(s => s.trim()) : []
                })}
                style={inputStyle}
                placeholder="Channel IDs to monitor"
              />
            </div>

            <div style={fieldStyle}>
              <label>
                <input
                  type="checkbox"
                  checked={config.respond_to_mentions !== false}
                  onChange={(e) => setConfig({ ...config, respond_to_mentions: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Respond to Mentions
              </label>
            </div>

            <div style={fieldStyle}>
              <label>
                <input
                  type="checkbox"
                  checked={config.respond_to_dms !== false}
                  onChange={(e) => setConfig({ ...config, respond_to_dms: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Respond to DMs
              </label>
            </div>
          </>
        )}

        {/* API Configuration */}
        {adapterType === 'api' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Host <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={config.host || ''}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                style={inputStyle}
                placeholder="0.0.0.0"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Port <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="number"
                value={config.port || ''}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 8080 })}
                style={inputStyle}
                placeholder="8080"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>CORS Origins</label>
              <input
                type="text"
                value={config.cors_origins?.join(', ') || '*'}
                onChange={(e) => setConfig({ ...config, cors_origins: e.target.value.split(',').map(s => s.trim()) })}
                style={inputStyle}
                placeholder="*, http://localhost:3000"
              />
            </div>

            <div style={fieldStyle}>
              <label>
                <input
                  type="checkbox"
                  checked={config.enable_auth !== false}
                  onChange={(e) => setConfig({ ...config, enable_auth: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Enable Authentication
              </label>
            </div>

            <div style={fieldStyle}>
              <label>
                <input
                  type="checkbox"
                  checked={config.cors_enabled !== false}
                  onChange={(e) => setConfig({ ...config, cors_enabled: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Enable CORS
              </label>
            </div>
          </>
        )}

        {/* CLI Configuration */}
        {adapterType === 'cli' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Prompt</label>
              <input
                type="text"
                value={config.prompt || ''}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                style={inputStyle}
                placeholder="> "
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>History File</label>
              <input
                type="text"
                value={config.history_file || ''}
                onChange={(e) => setConfig({ ...config, history_file: e.target.value })}
                style={inputStyle}
                placeholder=".ciris_history"
              />
            </div>

            <div style={fieldStyle}>
              <label>
                <input
                  type="checkbox"
                  checked={config.enable_colors || false}
                  onChange={(e) => setConfig({ ...config, enable_colors: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Enable Colors
              </label>
            </div>
          </>
        )}

        {/* Advanced JSON Editor */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              width: '100%',
              justifyContent: 'space-between'
            }}
          >
            <span>Advanced Configuration (JSON)</span>
            <span style={{ fontSize: '12px' }}>{showAdvanced ? '▼' : '▶'}</span>
          </button>

          {showAdvanced && (
            <div style={{ marginTop: '15px' }}>
              <label style={{ ...labelStyle, marginBottom: '10px' }}>
                Raw Configuration JSON
                {jsonError && (
                  <span style={{ color: 'red', fontSize: '12px', marginLeft: '10px' }}>
                    {jsonError}
                  </span>
                )}
              </label>
              <textarea
                value={JSON.stringify(config, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setConfig(parsed);
                    setJsonError(null);
                  } catch (error) {
                    setJsonError('Invalid JSON');
                  }
                }}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  minHeight: '200px',
                  resize: 'vertical',
                  borderColor: jsonError ? 'red' : '#ccc'
                }}
                placeholder="{}"
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Edit the raw JSON configuration. Changes here will override the form fields above.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              padding: '8px 16px',
              backgroundColor: isPending ? '#ccc' : '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isPending ? 'not-allowed' : 'pointer'
            }}
          >
            {isPending ? (isEdit ? 'Saving...' : 'Registering...') : (isEdit ? 'Save Changes' : 'Register Adapter')}
          </button>
        </div>
      </div>
    </div>
  );
}
