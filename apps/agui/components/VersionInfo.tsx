'use client';

import { useEffect, useState } from 'react';
import { SDK_VERSION } from '@/lib/ciris-sdk/version';

interface VersionData {
  gui: {
    version: string;
    buildDate: string;
    gitHash: string;
  };
  sdk: {
    version: string;
    buildDate: string;
    gitHash: string;
  };
  agent?: {
    version: string;
    gitHash: string;
  };
}

export function VersionInfo({ className = '' }: { className?: string }) {
  const [versions, setVersions] = useState<VersionData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Get GUI version from package.json version (injected at build time)
    const guiVersion = process.env.NEXT_PUBLIC_GUI_VERSION || '1.1.1-beta';
    const gitHash = process.env.NEXT_PUBLIC_GIT_HASH || 'dev';

    // Try to get agent version from API
    fetch('/api/version')
      .then(res => res.json())
      .then(agentData => {
        setVersions({
          gui: {
            version: guiVersion,
            buildDate: new Date().toISOString(),
            gitHash: gitHash.substring(0, 7),
          },
          sdk: {
            version: SDK_VERSION.version,
            buildDate: SDK_VERSION.buildDate,
            gitHash: SDK_VERSION.gitHash.substring(0, 7),
          },
          agent: agentData,
        });
      })
      .catch(() => {
        // If API fails, just show GUI and SDK versions
        setVersions({
          gui: {
            version: guiVersion,
            buildDate: new Date().toISOString(),
            gitHash: gitHash.substring(0, 7),
          },
          sdk: {
            version: SDK_VERSION.version,
            buildDate: SDK_VERSION.buildDate,
            gitHash: SDK_VERSION.gitHash.substring(0, 7),
          },
        });
      });
  }, []);

  if (!versions) return null;

  return (
    <div className={`fixed bottom-2 right-2 text-xs ${className}`}>
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="px-2 py-1 bg-gray-800/50 text-gray-400 rounded hover:bg-gray-700/50 transition-colors"
      >
        v{versions.gui.version}
      </button>

      {isVisible && (
        <div className="absolute bottom-8 right-0 bg-gray-800 border border-gray-700 rounded p-3 min-w-[250px] shadow-lg">
          <div className="space-y-2 text-gray-300">
            <div>
              <div className="font-semibold text-gray-100">GUI</div>
              <div>Version: {versions.gui.version}</div>
              <div>Hash: {versions.gui.gitHash}</div>
            </div>

            <div className="border-t border-gray-700 pt-2">
              <div className="font-semibold text-gray-100">SDK</div>
              <div>Version: {versions.sdk.version}</div>
              <div>Hash: {versions.sdk.gitHash}</div>
            </div>

            {versions.agent && (
              <div className="border-t border-gray-700 pt-2">
                <div className="font-semibold text-gray-100">Agent</div>
                <div>Version: {versions.agent.version}</div>
                <div>Hash: {versions.agent.gitHash}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
