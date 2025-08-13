'use client';

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon } from './Icons';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { useAgent } from '../contexts/AgentContextHybrid';
import { APIRole } from '../lib/ciris-sdk';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AgentSelector() {
  const { agents, currentAgent, currentAgentRole, agentRoles, selectAgent, isLoadingRoles } = useAgent();

  const getRoleBadge = (role: APIRole | undefined, isAuthority: boolean) => {
    if (!role) return null;

    const roleColors = {
      SYSTEM_ADMIN: 'bg-purple-100 text-purple-800',
      AUTHORITY: 'bg-blue-100 text-blue-800',
      ADMIN: 'bg-green-100 text-green-800',
      OBSERVER: 'bg-gray-100 text-gray-800'
    };

    const displayRole = isAuthority && role !== 'SYSTEM_ADMIN' ? 'AUTHORITY' : role;
    const color = roleColors[role] || roleColors.OBSERVER;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {displayRole}
      </span>
    );
  };

  const getAgentStatus = (agentId: string) => {
    const role = agentRoles.get(agentId);
    if (!role) return 'offline';

    // Check if last checked was recent (within 5 minutes)
    const isRecent = new Date().getTime() - role.lastChecked.getTime() < 300000;
    return isRecent ? 'online' : 'unknown';
  };

  if (!currentAgent) return null;

  return (
    <Listbox value={currentAgent} onChange={(agent) => selectAgent(agent.agent_id)}>
      {({ open }) => (
        <div>
          <div className="relative">
            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
              <span className="flex items-center justify-between">
                <span className="block truncate">{currentAgent.agent_name}</span>
                {currentAgentRole && getRoleBadge(currentAgentRole.apiRole, currentAgentRole.isAuthority)}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>
            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {agents.map((agent) => {
                  const role = agentRoles.get(agent.agent_id);
                  const status = getAgentStatus(agent.agent_id);

                  return (
                    <Listbox.Option
                      key={agent.agent_id}
                      className={({ active }) =>
                        classNames(
                          active ? 'text-white bg-indigo-600' : 'text-gray-900',
                          'relative cursor-pointer select-none py-2 pl-10 pr-4'
                        )
                      }
                      value={agent}
                      disabled={isLoadingRoles}
                    >
                      {({ selected, active }) => (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={classNames(selected ? 'font-medium' : 'font-normal', 'block truncate')}>
                                {agent.agent_name}
                              </span>
                              <span className={classNames(active ? 'text-indigo-200' : 'text-gray-500', 'text-xs')}>
                                {agent.container_name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {role && (
                                <span className={classNames(
                                  active ? 'bg-indigo-700' : '',
                                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                  !active && getRoleBadge(role.apiRole, role.isAuthority)?.props.className
                                )}>
                                  {role.isAuthority && role.apiRole !== 'SYSTEM_ADMIN' ? 'AUTHORITY' : role.apiRole}
                                </span>
                              )}
                              <span className={classNames(
                                'inline-block w-2 h-2 rounded-full',
                                status === 'online' ? 'bg-green-400' : status === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
                              )} />
                            </div>
                          </div>
                          {selected ? (
                            <span
                              className={classNames(
                                active ? 'text-white' : 'text-indigo-600',
                                'absolute inset-y-0 left-0 flex items-center pl-3'
                              )}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  );
                })}
              </Listbox.Options>
            </Transition>
          </div>
        </div>
      )}
    </Listbox>
  );
}
