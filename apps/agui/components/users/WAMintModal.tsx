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
  isSelfMint?: boolean;
}

export function WAMintModal({ user, onClose, onSuccess, isSelfMint = false }: WAMintModalProps) {
  const [waRole, setWARole] = useState<WARole>('observer' as WARole);
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
                      {isSelfMint ? 'Bootstrap Wise Authority' : 'Mint as Wise Authority'}
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
                      {isSelfMint 
                        ? <>
                            You are about to mint yourself (<span className="font-medium">{user.username}</span>) as the first Wise Authority.
                            <br />
                            <span className="text-xs text-amber-600 mt-2 block">
                              This requires the root WA private key to sign the transaction.
                            </span>
                          </>
                        : <>Grant Wise Authority status to <span className="font-medium">{user.username}</span></>
                      }
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
                      <option value="observer">Observer</option>
                      <option value="authority">Authority</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {waRole === 'authority'
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
                        placeholder="Paste ONLY the signature value (e.g., EjRdHhbaEySL...) - NOT the 'Signature:' prefix"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Paste the base64 signature from the command output (without "Signature:" prefix)
                      </p>
                    </div>
                  )}

                  {showInstructions && (
                    <div className="bg-gray-50 rounded-md p-4 text-xs space-y-3">
                      <h5 className="font-medium text-gray-900">How to Generate Your Signature:</h5>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="font-semibold text-blue-900 mb-2">Step 1: Run this command in your terminal:</p>
                        <code className="block bg-white p-2 rounded text-xs font-mono break-all border border-blue-300">
                          python /home/emoore/CIRISAgent/scripts/security/sign_wa_mint.py {user.user_id} {waRole} {privateKeyPath || '~/.ciris/wa_keys/root_wa.key'}
                        </code>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <p className="font-semibold text-green-900 mb-1">Step 2: Copy ONLY the signature line:</p>
                        <div className="bg-white p-2 rounded border border-green-300">
                          <p className="text-gray-600 text-xs">The output will show:</p>
                          <p className="font-mono text-xs text-gray-500">Message: MINT_WA:{user.user_id}:{waRole}</p>
                          <p className="font-mono text-xs text-green-700 font-bold">
                            Signature: <span className="bg-yellow-100 px-1">EjRdHhbaEySL...us9AAw==</span>
                          </p>
                          <p className="text-green-800 mt-2 font-semibold">↑ Copy this value (without "Signature:")</p>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded p-3">
                        <p className="font-semibold text-amber-900 mb-1">Step 3: Paste the signature:</p>
                        <p className="text-amber-800">Paste ONLY the base64 string (like "EjRdHhbaEySL...") into the signature field above</p>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-red-800 text-xs">
                          <strong>⚠️ Security:</strong> Never share your private key. Only paste the signature.
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
