'use client';

import React from 'react';
import { 
  StepResult, 
  StepPoint,
  StepResultFinalizeTasksQueue,
  StepResultPopulateThoughtQueue,
  StepResultPopulateRound,
  StepResultBuildContext,
  StepResultPerformDMAs,
  StepResultPerformASPDMA,
  StepResultConscienceExecution,
  StepResultRecursiveASPDMA,
  StepResultRecursiveConscience,
  StepResultActionSelection,
  StepResultHandlerStart,
  StepResultBusOutbound,
  StepResultPackageHandling,
  StepResultBusInbound,
  StepResultHandlerComplete
} from '../../../lib/ciris-sdk/types';

interface StepVisualizationProps {
  stepResult: StepResult;
  stepPoint: StepPoint;
}

export function StepVisualization({ stepResult, stepPoint }: StepVisualizationProps) {
  const renderStepSpecificVisualization = () => {
    switch (stepPoint) {
      case StepPoint.FINALIZE_TASKS_QUEUE:
        return <FinalizeTasksQueueVisualization stepResult={stepResult as StepResultFinalizeTasksQueue} />;
      case StepPoint.POPULATE_THOUGHT_QUEUE:
        return <PopulateThoughtQueueVisualization stepResult={stepResult as StepResultPopulateThoughtQueue} />;
      case StepPoint.POPULATE_ROUND:
        return <PopulateRoundVisualization stepResult={stepResult as StepResultPopulateRound} />;
      case StepPoint.BUILD_CONTEXT:
        return <BuildContextVisualization stepResult={stepResult as StepResultBuildContext} />;
      case StepPoint.PERFORM_DMAS:
        return <PerformDMAsVisualization stepResult={stepResult as StepResultPerformDMAs} />;
      case StepPoint.PERFORM_ASPDMA:
        return <PerformASPDMAVisualization stepResult={stepResult as StepResultPerformASPDMA} />;
      case StepPoint.CONSCIENCE_EXECUTION:
        return <ConscienceExecutionVisualization stepResult={stepResult as StepResultConscienceExecution} />;
      case StepPoint.RECURSIVE_ASPDMA:
        return <RecursiveASPDMAVisualization stepResult={stepResult as StepResultRecursiveASPDMA} />;
      case StepPoint.RECURSIVE_CONSCIENCE:
        return <RecursiveConscienceVisualization stepResult={stepResult as StepResultRecursiveConscience} />;
      case StepPoint.ACTION_SELECTION:
        return <ActionSelectionVisualization stepResult={stepResult as StepResultActionSelection} />;
      case StepPoint.HANDLER_START:
        return <HandlerStartVisualization stepResult={stepResult as StepResultHandlerStart} />;
      case StepPoint.BUS_OUTBOUND:
        return <BusOutboundVisualization stepResult={stepResult as StepResultBusOutbound} />;
      case StepPoint.PACKAGE_HANDLING:
        return <PackageHandlingVisualization stepResult={stepResult as StepResultPackageHandling} />;
      case StepPoint.BUS_INBOUND:
        return <BusInboundVisualization stepResult={stepResult as StepResultBusInbound} />;
      case StepPoint.HANDLER_COMPLETE:
        return <HandlerCompleteVisualization stepResult={stepResult as StepResultHandlerComplete} />;
      default:
        return <DefaultVisualization stepResult={stepResult} />;
    }
  };

  return (
    <div className="space-y-4">
      {renderStepSpecificVisualization()}
    </div>
  );
}

// Step 1: FINALIZE_TASKS_QUEUE
function FinalizeTasksQueueVisualization({ stepResult }: { stepResult: StepResultFinalizeTasksQueue }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <h4 className="text-lg font-medium text-blue-900">📋 Task Queue Finalization</h4>
        <p className="text-blue-700 mt-1">
          Task prioritization and workload management - showing how CIRIS selects tasks fairly
        </p>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Round Number</div>
          <div className="text-xl font-bold text-gray-900">{stepResult.round_number}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Tasks Selected</div>
          <div className="text-xl font-bold text-green-700">{stepResult.tasks_selected_count}</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Total Pending</div>
          <div className="text-xl font-bold text-yellow-700">{stepResult.total_pending_tasks}</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Current State</div>
          <div className="text-xl font-bold text-purple-700">{stepResult.current_state}</div>
        </div>
      </div>

      {/* Selected Tasks */}
      {stepResult.tasks_to_process.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Selected Tasks ({stepResult.tasks_to_process.length})</h5>
          <div className="space-y-2">
            {stepResult.tasks_to_process.map((task, index) => (
              <div key={task.task_id} className="flex items-center justify-between p-2 bg-green-50 rounded border-l-4 border-green-400">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Task {task.task_id}
                  </div>
                  <div className="text-xs text-gray-600 truncate max-w-md">
                    {task.content}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    task.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                    task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.priority}
                  </span>
                  <span className="text-xs text-gray-500">{task.channel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deferred Tasks */}
      {Object.keys(stepResult.tasks_deferred).length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Deferred Tasks ({Object.keys(stepResult.tasks_deferred).length})</h5>
          <div className="space-y-2">
            {Object.entries(stepResult.tasks_deferred).map(([taskId, reason]) => (
              <div key={taskId} className="flex items-center justify-between p-2 bg-gray-50 rounded border-l-4 border-gray-400">
                <div className="text-sm font-medium text-gray-900">Task {taskId}</div>
                <div className="text-xs text-gray-600">{reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Step 2: POPULATE_THOUGHT_QUEUE  
function PopulateThoughtQueueVisualization({ stepResult }: { stepResult: StepResultPopulateThoughtQueue }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border-l-4 border-green-400 p-4">
        <h4 className="text-lg font-medium text-green-900">💭 Thought Generation</h4>
        <p className="text-green-700 mt-1">
          Converting tasks into actionable thoughts - the cognitive bridge from intent to action
        </p>
      </div>

      {/* Generation Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Thoughts Generated</div>
          <div className="text-xl font-bold text-green-700">{stepResult.total_thoughts_generated}</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Generation Errors</div>
          <div className="text-xl font-bold text-red-700">{stepResult.generation_errors.length}</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Processing Time</div>
          <div className="text-xl font-bold text-blue-700">{stepResult.processing_time_ms}ms</div>
        </div>
      </div>

      {/* Task-to-Thought Mapping */}
      {Object.keys(stepResult.task_thought_mapping).length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Task → Thought Mapping</h5>
          <div className="space-y-3">
            {Object.entries(stepResult.task_thought_mapping).map(([taskId, thoughtIds]) => (
              <div key={taskId} className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-24 px-3 py-2 bg-blue-100 text-blue-800 rounded text-sm font-medium text-center">
                  Task {taskId}
                </div>
                <div className="flex-shrink-0 text-gray-400">→</div>
                <div className="flex-1 flex flex-wrap gap-2">
                  {thoughtIds.map((thoughtId) => (
                    <div key={thoughtId} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {thoughtId}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Thoughts */}
      {stepResult.thoughts_generated.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Generated Thoughts ({stepResult.thoughts_generated.length})</h5>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stepResult.thoughts_generated.map((thought) => (
              <div key={thought.thought_id} className="flex items-center justify-between p-2 bg-green-50 rounded border-l-4 border-green-400">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {thought.thought_id} ({thought.thought_type})
                  </div>
                  <div className="text-xs text-gray-600 truncate max-w-md">
                    {thought.content}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Priority: {thought.priority}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Errors */}
      {stepResult.generation_errors.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <h5 className="font-medium text-red-900 mb-2">Generation Errors</h5>
          <ul className="text-sm text-red-700 space-y-1">
            {stepResult.generation_errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Step 5: PERFORM_DMAS - This is the core ethical reasoning step
function PerformDMAsVisualization({ stepResult }: { stepResult: StepResultPerformDMAs }) {
  const allPassed = stepResult.dmas_executed.length === 3 && Object.keys(stepResult.dma_failures).length === 0;
  
  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border-l-4 border-purple-400 p-4">
        <h4 className="text-lg font-medium text-purple-900">🧠 Multi-DMA Ethical Reasoning</h4>
        <p className="text-purple-700 mt-1">
          Parallel execution of Ethical, Common Sense, and Domain DMAs - the heart of CIRIS reasoning
        </p>
      </div>

      {/* DMA Execution Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-3 rounded-lg ${allPassed ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-sm text-gray-600">DMAs Executed</div>
          <div className={`text-xl font-bold ${allPassed ? 'text-green-700' : 'text-red-700'}`}>
            {stepResult.dmas_executed.length}/3
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Total Time</div>
          <div className="text-xl font-bold text-blue-700">{stepResult.total_time_ms}ms</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Longest DMA</div>
          <div className="text-xl font-bold text-yellow-700">{stepResult.longest_dma_time_ms}ms</div>
        </div>
        <div className={`p-3 rounded-lg ${Object.keys(stepResult.dma_failures).length === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-sm text-gray-600">Failures</div>
          <div className={`text-xl font-bold ${Object.keys(stepResult.dma_failures).length === 0 ? 'text-green-700' : 'text-red-700'}`}>
            {Object.keys(stepResult.dma_failures).length}
          </div>
        </div>
      </div>

      {/* DMA Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ethical DMA */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium text-gray-900">🎯 Ethical DMA</h5>
            <div className="text-lg font-bold text-blue-600">
              {(stepResult.ethical_dma.confidence_level * 100).toFixed(0)}%
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-sm text-gray-600">Assessment</div>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {stepResult.ethical_dma.ethical_assessment}
              </div>
            </div>
            {stepResult.ethical_dma.concerns.length > 0 && (
              <div>
                <div className="text-sm text-gray-600">Concerns</div>
                <ul className="text-sm text-red-700 space-y-1">
                  {stepResult.ethical_dma.concerns.map((concern, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stepResult.ethical_dma.recommendations.length > 0 && (
              <div>
                <div className="text-sm text-gray-600">Recommendations</div>
                <ul className="text-sm text-green-700 space-y-1">
                  {stepResult.ethical_dma.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Common Sense DMA */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium text-gray-900">🤔 Common Sense DMA</h5>
            <div className="text-lg font-bold text-green-600">
              {(stepResult.common_sense_dma.confidence_level * 100).toFixed(0)}%
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-sm text-gray-600">Assessment</div>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {stepResult.common_sense_dma.common_sense_assessment}
              </div>
            </div>
            {stepResult.common_sense_dma.practical_considerations.length > 0 && (
              <div>
                <div className="text-sm text-gray-600">Practical Considerations</div>
                <ul className="text-sm text-blue-700 space-y-1">
                  {stepResult.common_sense_dma.practical_considerations.map((consideration, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{consideration}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stepResult.common_sense_dma.potential_issues.length > 0 && (
              <div>
                <div className="text-sm text-gray-600">Potential Issues</div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {stepResult.common_sense_dma.potential_issues.map((issue, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Domain DMA */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium text-gray-900">🎓 Domain DMA</h5>
            <div className="text-lg font-bold text-purple-600">
              {(stepResult.domain_dma.confidence_level * 100).toFixed(0)}%
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-sm text-gray-600">Assessment</div>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {stepResult.domain_dma.domain_specific_assessment}
              </div>
            </div>
            {stepResult.domain_dma.domain_knowledge_applied.length > 0 && (
              <div>
                <div className="text-sm text-gray-600">Domain Knowledge</div>
                <ul className="text-sm text-purple-700 space-y-1">
                  {stepResult.domain_dma.domain_knowledge_applied.map((knowledge, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{knowledge}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stepResult.domain_dma.domain_constraints.length > 0 && (
              <div>
                <div className="text-sm text-gray-600">Domain Constraints</div>
                <ul className="text-sm text-orange-700 space-y-1">
                  {stepResult.domain_dma.domain_constraints.map((constraint, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{constraint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DMA Failures */}
      {Object.keys(stepResult.dma_failures).length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <h5 className="font-medium text-red-900 mb-2">DMA Failures</h5>
          <div className="space-y-1">
            {Object.entries(stepResult.dma_failures).map(([dmaName, error]) => (
              <div key={dmaName} className="text-sm text-red-700">
                <strong>{dmaName}:</strong> {error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Step 7: CONSCIENCE_EXECUTION - Critical ethics demonstration
function ConscienceExecutionVisualization({ stepResult }: { stepResult: StepResultConscienceExecution }) {
  return (
    <div className="space-y-4">
      <div className={`border-l-4 p-4 ${stepResult.all_passed ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
        <h4 className={`text-lg font-medium ${stepResult.all_passed ? 'text-green-900' : 'text-red-900'}`}>
          ⚖️ Conscience Evaluation
        </h4>
        <p className={`mt-1 ${stepResult.all_passed ? 'text-green-700' : 'text-red-700'}`}>
          Safety checks and ethical validation - ensuring actions align with moral principles
        </p>
      </div>

      {/* Conscience Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-3 rounded-lg ${stepResult.all_passed ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-sm text-gray-600">Overall Result</div>
          <div className={`text-xl font-bold ${stepResult.all_passed ? 'text-green-700' : 'text-red-700'}`}>
            {stepResult.all_passed ? 'PASSED' : 'FAILED'}
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Consciences</div>
          <div className="text-xl font-bold text-blue-700">{stepResult.conscience_evaluations.length}</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Failures</div>
          <div className="text-xl font-bold text-red-700">{stepResult.failures.length}</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Override Needed</div>
          <div className="text-xl font-bold text-yellow-700">{stepResult.override_required ? 'YES' : 'NO'}</div>
        </div>
      </div>

      {/* Action Being Evaluated */}
      <div className="bg-white border rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-3">Action Under Review</h5>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Selected Action</div>
              <div className="text-lg font-medium text-gray-900">{stepResult.aspdma_result.selected_action}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Confidence</div>
              <div className="text-lg font-medium text-blue-600">
                {(stepResult.aspdma_result.confidence_level * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-gray-600">Reasoning</div>
            <div className="text-sm text-gray-900 mt-1">{stepResult.aspdma_result.reasoning}</div>
          </div>
          {Object.keys(stepResult.aspdma_result.action_parameters).length > 0 && (
            <div className="mt-3">
              <div className="text-sm text-gray-600">Parameters</div>
              <pre className="text-xs text-gray-700 bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(stepResult.aspdma_result.action_parameters, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Conscience Evaluations */}
      <div className="bg-white border rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-3">Conscience Evaluations</h5>
        <div className="space-y-4">
          {stepResult.conscience_evaluations.map((evaluation, index) => (
            <div 
              key={index} 
              className={`border rounded-lg p-4 ${
                evaluation.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h6 className="font-medium text-gray-900">{evaluation.conscience_name}</h6>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  evaluation.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {evaluation.passed ? '✓ PASSED' : '✗ FAILED'}
                </span>
              </div>
              <div className="text-sm text-gray-700 mb-2">
                <strong>Reasoning:</strong> {evaluation.reasoning}
              </div>
              {evaluation.recommendations.length > 0 && (
                <div>
                  <div className="text-sm text-gray-600 font-medium mb-1">Recommendations:</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {evaluation.recommendations.map((rec, recIndex) => (
                      <li key={recIndex} className="flex items-start space-x-1">
                        <span>•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h5 className="font-medium text-gray-900 mb-2">Performance Metrics</h5>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Time:</span>
            <span className="font-medium text-gray-900 ml-2">{stepResult.total_time_ms}ms</span>
          </div>
          <div>
            <span className="text-gray-600">Longest Conscience:</span>
            <span className="font-medium text-gray-900 ml-2">{stepResult.longest_conscience_time_ms}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Placeholder components for other steps - can be expanded similarly
function PopulateRoundVisualization({ stepResult }: { stepResult: StepResultPopulateRound }) {
  return <DefaultVisualization stepResult={stepResult} title="🎯 Round Population" description="Batch processing and priority-based thought selection" />;
}

function BuildContextVisualization({ stepResult }: { stepResult: StepResultBuildContext }) {
  return <DefaultVisualization stepResult={stepResult} title="🏗️ Context Building" description="Building comprehensive understanding before reasoning" />;
}

function PerformASPDMAVisualization({ stepResult }: { stepResult: StepResultPerformASPDMA }) {
  return <DefaultVisualization stepResult={stepResult} title="🎯 Action Selection" description="LLM decision-making process and action selection reasoning" />;
}

function RecursiveASPDMAVisualization({ stepResult }: { stepResult: StepResultRecursiveASPDMA }) {
  return <DefaultVisualization stepResult={stepResult} title="🔄 Recursive Action Selection" description="Learning and adaptation based on feedback" />;
}

function RecursiveConscienceVisualization({ stepResult }: { stepResult: StepResultRecursiveConscience }) {
  return <DefaultVisualization stepResult={stepResult} title="🔄 Recursive Conscience" description="Persistent ethical validation" />;
}

function ActionSelectionVisualization({ stepResult }: { stepResult: StepResultActionSelection }) {
  return <DefaultVisualization stepResult={stepResult} title="✅ Final Action Selection" description="Complete ethical reasoning outcome" />;
}

function HandlerStartVisualization({ stepResult }: { stepResult: StepResultHandlerStart }) {
  return <DefaultVisualization stepResult={stepResult} title="🚀 Handler Start" description="Transition from reasoning to execution" />;
}

function BusOutboundVisualization({ stepResult }: { stepResult: StepResultBusOutbound }) {
  return <DefaultVisualization stepResult={stepResult} title="📤 Bus Outbound" description="Internal decisions becoming external actions" />;
}

function PackageHandlingVisualization({ stepResult }: { stepResult: StepResultPackageHandling }) {
  return <DefaultVisualization stepResult={stepResult} title="📦 Package Handling" description="Edge/boundary processing and external integration" />;
}

function BusInboundVisualization({ stepResult }: { stepResult: StepResultBusInbound }) {
  return <DefaultVisualization stepResult={stepResult} title="📥 Bus Inbound" description="Processing external operation results" />;
}

function HandlerCompleteVisualization({ stepResult }: { stepResult: StepResultHandlerComplete }) {
  return <DefaultVisualization stepResult={stepResult} title="🏁 Handler Complete" description="Task completion and cascade effects" />;
}

function DefaultVisualization({ stepResult, title, description }: { stepResult: StepResult; title?: string; description?: string }) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
          <h4 className="text-lg font-medium text-gray-900">{title}</h4>
          {description && <p className="text-gray-700 mt-1">{description}</p>}
        </div>
      )}
      <div className="bg-gray-50 rounded-lg p-4">
        <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto">
          {JSON.stringify(stepResult, null, 2)}
        </pre>
      </div>
    </div>
  );
}