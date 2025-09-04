// Sample demo data for testing step visualizations
import { 
  StepPoint, 
  StepResultPerformDMAs, 
  StepResultConscienceExecution,
  StepResultFinalizeTasksQueue,
  EthicalDMAResult,
  CSDMAResult,
  DSDMAResult,
  ActionSelectionDMAResult,
  ConscienceResult,
  QueuedTask
} from '../../../lib/ciris-sdk/types';

// Sample Ethical DMA result
export const sampleEthicalDMA: EthicalDMAResult = {
  ethical_assessment: "Action appears to respect user autonomy and privacy while providing helpful assistance.",
  concerns: [
    "Potential for misinterpretation of user intent",
    "Risk of providing information that could be misused"
  ],
  recommendations: [
    "Confirm user intent before proceeding",
    "Provide information with appropriate context and warnings",
    "Respect user's right to decline assistance"
  ],
  confidence_level: 0.87
};

// Sample Common Sense DMA result
export const sampleCommonSenseDMA: CSDMAResult = {
  common_sense_assessment: "Request follows normal patterns of human-AI interaction with reasonable expectations.",
  practical_considerations: [
    "User likely expects a direct, helpful response",
    "Information should be accurate and up-to-date",
    "Response should be appropriate for the communication channel"
  ],
  potential_issues: [
    "Information might be incomplete without additional context",
    "User may need follow-up clarification"
  ],
  confidence_level: 0.92
};

// Sample Domain DMA result
export const sampleDomainDMA: DSDMAResult = {
  domain_specific_assessment: "Request falls within established guidelines for AI assistance in this domain.",
  domain_knowledge_applied: [
    "Technical accuracy requirements for this domain",
    "Standard practices for information presentation",
    "Appropriate level of detail for the user's apparent expertise"
  ],
  domain_constraints: [
    "Must not provide potentially harmful technical details",
    "Should include appropriate disclaimers",
    "Must respect intellectual property boundaries"
  ],
  confidence_level: 0.89
};

// Sample action selection result
export const sampleActionSelection: ActionSelectionDMAResult = {
  selected_action: "SPEAK",
  action_parameters: {
    message: "I'd be happy to help you with that. Here's the information you requested...",
    channel_id: "web_ui",
    response_type: "helpful_response",
    confidence_level: 0.85
  },
  reasoning: "User has made a clear, reasonable request for information that I can safely and helpfully provide. A direct, informative response is most appropriate.",
  confidence_level: 0.85
};

// Sample conscience results
export const sampleConscienceResults: ConscienceResult[] = [
  {
    conscience_name: "Safety Conscience",
    passed: true,
    reasoning: "Action poses no safety risks and follows established safety guidelines.",
    recommendations: [
      "Continue with proposed action",
      "Monitor for any unexpected safety concerns"
    ]
  },
  {
    conscience_name: "Privacy Conscience", 
    passed: true,
    reasoning: "Action respects user privacy and does not request or expose personal information inappropriately.",
    recommendations: [
      "Proceed with action as planned",
      "Maintain privacy-conscious approach"
    ]
  },
  {
    conscience_name: "Ethical Conscience",
    passed: true,
    reasoning: "Action aligns with ethical principles and respects human autonomy and dignity.",
    recommendations: [
      "Action is ethically sound and can proceed",
      "Continue to prioritize ethical considerations"
    ]
  },
  {
    conscience_name: "Legal Conscience",
    passed: true,
    reasoning: "Action complies with applicable legal requirements and does not facilitate illegal activity.",
    recommendations: [
      "No legal concerns identified",
      "Proceed with confidence"
    ]
  }
];

// Sample tasks
export const sampleTasks: QueuedTask[] = [
  {
    task_id: "task_001",
    priority: "HIGH",
    channel: "web_ui",
    content: "User requesting information about AI safety practices",
    created_at: "2024-09-04T16:00:00Z"
  },
  {
    task_id: "task_002", 
    priority: "MEDIUM",
    channel: "discord",
    content: "Help with technical documentation question",
    created_at: "2024-09-04T15:58:30Z"
  },
  {
    task_id: "task_003",
    priority: "LOW", 
    channel: "api",
    content: "Routine system status check",
    created_at: "2024-09-04T15:55:00Z"
  }
];

// Sample complete DMA step result
export const sampleDMAStepResult: StepResultPerformDMAs = {
  step_point: StepPoint.PERFORM_DMAS,
  success: true,
  thought_id: "thought_demo_123",
  ethical_dma: sampleEthicalDMA,
  common_sense_dma: sampleCommonSenseDMA,
  domain_dma: sampleDomainDMA,
  dmas_executed: ["ethical", "common_sense", "domain"],
  dma_failures: {},
  longest_dma_time_ms: 245,
  total_time_ms: 378,
  processing_time_ms: 378
};

// Sample conscience execution step result
export const sampleConscienceStepResult: StepResultConscienceExecution = {
  step_point: StepPoint.CONSCIENCE_EXECUTION,
  success: true,
  thought_id: "thought_demo_123",
  aspdma_result: sampleActionSelection,
  conscience_evaluations: sampleConscienceResults,
  all_passed: true,
  failures: [],
  override_required: false,
  longest_conscience_time_ms: 156,
  total_time_ms: 298,
  processing_time_ms: 298
};

// Sample task queue finalization step result
export const sampleTaskQueueStepResult: StepResultFinalizeTasksQueue = {
  step_point: StepPoint.FINALIZE_TASKS_QUEUE,
  success: true,
  thought_id: "thought_demo_000",
  tasks_to_process: sampleTasks.slice(0, 2), // First 2 tasks selected
  tasks_deferred: {
    "task_003": "Low priority, deferred to next round"
  },
  selection_criteria: {
    priority_threshold: "MEDIUM",
    max_batch_size: 2,
    channel_filters: ["web_ui", "discord"]
  },
  total_pending_tasks: 3,
  total_active_tasks: 0,
  tasks_selected_count: 2,
  round_number: 7,
  current_state: "WORK",
  processing_time_ms: 23
};

// Demo mode flag - in real implementation this could be controlled via query param
export const isDemoMode = () => {
  if (typeof window !== 'undefined') {
    return window.location.search.includes('demo=true');
  }
  return false;
};

// Get demo data based on step point
export const getDemoStepResult = (stepPoint: StepPoint) => {
  switch (stepPoint) {
    case StepPoint.FINALIZE_TASKS_QUEUE:
      return sampleTaskQueueStepResult;
    case StepPoint.PERFORM_DMAS:
      return sampleDMAStepResult;
    case StepPoint.CONSCIENCE_EXECUTION:
      return sampleConscienceStepResult;
    default:
      return null;
  }
};