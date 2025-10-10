// Environmental Impact Calculations for AI Model Inference
// Based on peer-reviewed research and industry standards

/**
 * Calculate water usage for AI model inference
 *
 * Uses hybrid methodology combining:
 * 1. WUE (Water Usage Effectiveness) based calculation
 * 2. Per-token estimation adjusted for model size
 *
 * @param energyKwh - Energy consumed in kilowatt-hours
 * @param tokensTotal - Total number of tokens processed
 * @param modelSizeB - Model size in billions of parameters (default: 17 for Llama-4-Maverick-17B)
 * @returns Water usage in milliliters
 */
export function calculateWaterUsage(
  energyKwh: number,
  tokensTotal: number,
  modelSizeB: number = 17
): number {
  // Method 1: WUE-based calculation
  // Illinois data centers typically use evaporative cooling in Midwest climate
  // Conservative estimate between industry average (1.8) and best-in-class (0.3)
  const WUE_ILLINOIS_CONSERVATIVE = 1.5; // L/kWh
  const waterUsageConservative = energyKwh * WUE_ILLINOIS_CONSERVATIVE * 1000; // Convert L to ml

  // Method 2: Per-token calculation
  // Based on Nature Scientific Reports study (Nov 2024) for Meta Llama-3-70B: 0.4 ml/token
  // Adjust for smaller model size (17B vs 70B parameters)
  const MODEL_SIZE_REFERENCE = 70; // Llama-3-70B from study
  const WATER_PER_TOKEN_BASE = 0.4; // ml per token for 70B model
  const modelSizeFactor = modelSizeB / MODEL_SIZE_REFERENCE;
  const waterPerToken = WATER_PER_TOKEN_BASE * modelSizeFactor;
  const waterUsagePerToken = tokensTotal * waterPerToken;

  // Return average of both methods (hybrid approach)
  return (waterUsageConservative + waterUsagePerToken) / 2;
}

/**
 * Format water usage for display
 * @param milliliters - Water usage in milliliters
 * @returns Formatted string with appropriate units
 */
export function formatWaterUsage(milliliters: number): string {
  if (milliliters < 1) {
    return `${milliliters.toFixed(2)} ml`;
  } else if (milliliters < 1000) {
    return `${milliliters.toFixed(1)} ml`;
  } else {
    return `${(milliliters / 1000).toFixed(2)} L`;
  }
}

/**
 * Format carbon emissions for display
 * @param grams - Carbon emissions in grams
 * @returns Formatted string with appropriate units
 */
export function formatCarbonEmissions(grams: number): string {
  if (grams < 1) {
    return `${grams.toFixed(2)} g CO₂e`;
  } else if (grams < 1000) {
    return `${grams.toFixed(1)} g CO₂e`;
  } else {
    return `${(grams / 1000).toFixed(2)} kg CO₂e`;
  }
}

/**
 * Get explanation text for water usage calculation methodology
 */
export const WATER_CALCULATION_EXPLANATION = `
**Water Usage Calculation Methodology**

Water consumption is estimated using a hybrid approach combining two peer-reviewed methodologies:

1. **WUE-Based Calculation**: Uses Water Usage Effectiveness (WUE) metrics for Illinois-hosted data centers.
   We assume 1.5 L/kWh based on Midwest climate conditions and evaporative cooling systems (between industry
   average of 1.8 L/kWh and best-in-class of 0.3 L/kWh).

2. **Per-Token Estimation**: Based on a November 2024 study published in *Nature Scientific Reports* examining
   Meta's Llama-3-70B model, which found approximately 0.4 ml of water consumption per token (including both
   operational and embodied environmental footprints). This is adjusted proportionally for the Llama-4-Maverick-17B
   model (17B/70B = ~0.097 ml/token).

The final estimate is the average of both methods to provide a defensible, conservative estimate. Water usage
includes both direct cooling water consumption and indirect water footprint from electricity generation.

**Carbon Emissions**: Calculated based on the energy consumption of the inference request and the carbon intensity
of the electrical grid serving the data center.

**Data Sources**:
- Nature Scientific Reports (2024): "Reconciling the contrasting narratives on the environmental impact of large language models"
- ISO/IEC 30134-9 WUE Standard
- Regional data center efficiency benchmarks (AWS, Microsoft, Equinix)
`;
