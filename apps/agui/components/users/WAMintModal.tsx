'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { cirisClient } from '../../lib/ciris-sdk';
import type { UserDetail, WARole } from '../../lib/ciris-sdk';
import { XMarkIcon, ShieldIcon } from '../Icons';

interface WAMintModalProps {
  user: UserDetail;
  onClose: () => void;
  onSuccess: () => void;
}

export function WAMintModal({ user, onClose, onSuccess }: WAMintModalProps) {
  const [waRole, setWARole] = useState<WARole>('OBSERVER');
  const [rootKey, setRootKey] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('~/.ciris/wa_keys/root_wa.key');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [keyExists, setKeyExists] = useState<boolean | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);
  const [useAutoSign, setUseAutoSign] = useState(false);

  // Check if private key exists when path changes
  useEffect(() => {
    const checkKey = async () => {
      if (!privateKeyPath) return;

      setCheckingKey(true);
      try {
        const response = await cirisClient.users.checkWAKeyExists(privateKeyPath);
        setKeyExists(!!response.exists && !!response.valid_size);
        if (response.exists && response.valid_size) {
          setUseAutoSign(true);
        }
      } catch (err) {
        console.error('Failed to check key:', err);
        setKeyExists(false);
      } finally {
        setCheckingKey(false);
      }
    };

    // Debounce the key check
    const timer = setTimeout(checkKey, 500);
    return () => clearTimeout(timer);
  }, [privateKeyPath]);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setMinting(true);
      setError(null);

      // Prepare the mint request
      const mintRequest: any = {
        wa_role: waRole
      };

      if (useAutoSign && keyExists) {
        // Use auto-signing with the private key path
        mintRequest.private_key_path = privateKeyPath;
      } else {
        // Use the provided signature
        if (!rootKey) {
          throw new Error('Please provide a signature or enable auto-signing');
        }
        mintRequest.signature = rootKey;
      }

      await cirisClient.users.mintWiseAuthority(user.user_id, mintRequest);

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mint as Wise Authority');
    } finally {
      setMinting(false);
    }
  };

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] mx-auto bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-5 pb-4 sm:p-6 border-b">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                      <ShieldIcon size="md" className="text-purple-600" />
                    </div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Mint as Wise Authority
                    </Dialog.Title>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon size="lg" className="text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 sm:p-6">
                  <div className="text-center mb-6">
                    <p className="text-sm text-gray-500">
                      Grant Wise Authority status to <span className="font-medium">{user.username}</span>
                    </p>
                  </div>

                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <form onSubmit={handleMint} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="wa-role" className="block text-sm font-medium text-gray-700">
                      WA Role
                    </label>
                    <select
                      id="wa-role"
                      value={waRole}
                      onChange={(e) => setWARole(e.target.value as WARole)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="OBSERVER">Observer</option>
                      <option value="AUTHORITY">Authority</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {waRole === 'AUTHORITY'
                        ? 'Can approve deferrals and provide guidance'
                        : 'Can observe and monitor the system'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="private-key-path" className="block text-sm font-medium text-gray-700">
                      Private Key Path
                    </label>
                    <input
                      type="text"
                      id="private-key-path"
                      value={privateKeyPath}
                      onChange={(e) => setPrivateKeyPath(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Path to your ROOT private key file"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Path to your ROOT private key file (e.g., ~/.ciris/wa_keys/root_wa.key)
                    </p>
                    {checkingKey && (
                      <p className="mt-1 text-xs text-gray-400">Checking key...</p>
                    )}
                    {!checkingKey && keyExists !== null && (
                      <p className={`mt-1 text-xs ${keyExists ? 'text-green-600' : 'text-red-600'}`}>
                        {keyExists ? '✓ Key found - auto-signing available' : '✗ Key not found at this path'}
                      </p>
                    )}
                  </div>

                  {keyExists && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="use-auto-sign"
                        checked={useAutoSign}
                        onChange={(e) => setUseAutoSign(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="use-auto-sign" className="ml-2 block text-sm text-gray-700">
                        Use auto-signing (sign on server with private key)
                      </label>
                    </div>
                  )}

                  {(!useAutoSign || !keyExists) && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label htmlFor="root-key" className="block text-sm font-medium text-gray-700">
                          ROOT Signature
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowInstructions(!showInstructions)}
                          className="text-xs text-indigo-600 hover:text-indigo-500"
                        >
                          How to sign?
                        </button>
                      </div>
                      <textarea
                        id="root-key"
                        value={rootKey}
                        onChange={(e) => setRootKey(e.target.value)}
                        required={!useAutoSign || !keyExists}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono text-xs"
                        placeholder="Paste the Ed25519 signature here..."
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        This action requires a valid signature from the ROOT private key
                      </p>
                    </div>
                  )}

                  {showInstructions && (
                    <div className="bg-gray-50 rounded-md p-4 text-xs">
                      <h5 className="font-medium text-gray-900 mb-2">Signing Instructions:</h5>
                      <ol className="list-decimal list-inside space-y-1 text-gray-600">
                        <li>Use the signing tool with your ROOT private key at the path specified above</li>
                        <li>Sign the message: <code className="bg-gray-100 px-1 py-0.5 rounded">MINT_WA:{user.user_id}:{waRole}</code></li>
                        <li>Copy the base64-encoded signature</li>
                        <li>Paste it in the signature field above</li>
                      </ol>
                      <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded">
                        <p className="text-indigo-800">
                          <strong>Example command:</strong><br />
                          <code className="text-xs">
                            python /home/emoore/CIRISAgent/sign_wa_mint.py {user.user_id} {waRole} {privateKeyPath || '~/.ciris/wa_keys/root_wa.key'}
                          </code>
                        </p>
                      </div>
                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-yellow-800">
                          <strong>Security Note:</strong> Never share your ROOT private key.
                          Sign messages offline and only share the signature.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      disabled={minting}
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50"
                    >
                      {minting ? 'Minting...' : 'Mint Authority'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
