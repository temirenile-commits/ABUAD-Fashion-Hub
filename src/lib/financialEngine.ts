export type FinancialEngineConfig = {
  deliveryTiers: { min: number; max: number | null; fee: number }[];
  commissionTiers: { min: number; max: number | null; fee?: number; percentage?: number; cap?: number }[];
};

export const defaultFinancialEngineConfig: FinancialEngineConfig = {
  deliveryTiers: [
    { min: 0, max: 1500, fee: 200 }, // Including 0-599 as 200 to be safe
    { min: 1501, max: 3000, fee: 300 },
    { min: 3001, max: 6000, fee: 400 },
    { min: 6001, max: null, fee: 600 },
  ],
  commissionTiers: [
    { min: 0, max: 1500, fee: 100 }, // Including 0-599 as 100
    { min: 1501, max: 3000, fee: 200 },
    { min: 3001, max: 6000, fee: 350 },
    { min: 6001, max: 15000, fee: 600 },
    { min: 15001, max: 40000, fee: 1000 },
    { min: 40001, max: null, percentage: 2, cap: 5000 },
  ],
};

export function calculateItemFinances(
  unitPrice: number,
  quantity: number,
  config: FinancialEngineConfig = defaultFinancialEngineConfig
) {
  // 1. Calculate Per-Unit Delivery Fee
  let unitDeliveryFee = 0;
  for (const tier of config.deliveryTiers) {
    if (unitPrice >= tier.min && (tier.max === null || unitPrice <= tier.max)) {
      unitDeliveryFee = tier.fee;
      break;
    }
  }

  // 2. Calculate Per-Unit Commission
  let unitCommission = 0;
  for (const tier of config.commissionTiers) {
    if (unitPrice >= tier.min && (tier.max === null || unitPrice <= tier.max)) {
      if (tier.fee !== undefined) {
        unitCommission = tier.fee;
      } else if (tier.percentage !== undefined) {
        const rawCommission = (unitPrice * tier.percentage) / 100;
        unitCommission = tier.cap ? Math.min(rawCommission, tier.cap) : rawCommission;
      }
      break;
    }
  }

  // 3. Apply Bulk Discount (Halve commission if quantity > 5)
  if (quantity > 5) {
    unitCommission = unitCommission / 2;
  }

  // 4. Calculate Totals
  const totalSubtotal = unitPrice * quantity;
  const totalDeliveryFee = unitDeliveryFee * quantity;
  const totalCommission = unitCommission * quantity;
  const totalCustomerCharge = totalSubtotal + totalDeliveryFee + totalCommission;
  const totalVendorEarning = totalSubtotal; // Vendor gets exact item price
  
  return {
    unitDeliveryFee,
    unitCommission,
    totalSubtotal,
    totalDeliveryFee,
    totalCommission,
    totalCustomerCharge,
    totalVendorEarning,
  };
}
