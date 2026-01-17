/**
 * Weight quantization helpers (gym-friendly plate increments).
 *
 * Requirement: for auto-computed loads shown to students, quantize DOWN to the nearest
 * 2.5kg increment (common smallest plate increment in gyms).
 *
 * Notes:
 * - For positive values: "down" means Math.floor to the increment.
 * - For negative values (used to represent assistance / counterweight as negative external load):
 *   we quantize toward 0 (so it doesn't become "more negative" by accident).
 */

export function quantizeKgForGym(valueKg: number, incrementKg = 2.5): number {
	if (!Number.isFinite(valueKg)) return valueKg;
	if (!Number.isFinite(incrementKg) || incrementKg <= 0) return valueKg;

	// Avoid floating noise by working on a scaled integer grid.
	const steps = valueKg / incrementKg;
	const quantizedSteps = valueKg >= 0 ? Math.floor(steps) : Math.ceil(steps);
	const quantized = quantizedSteps * incrementKg;

	// Normalize to 2 decimals to avoid 7.499999999 style artifacts.
	return Math.round(quantized * 100) / 100;
}

export function formatKgValueForGym(valueKg: number, incrementKg = 2.5): string {
	const q = quantizeKgForGym(valueKg, incrementKg);
	if (!Number.isFinite(q)) return String(q);
	// strip trailing zeros: 10.00 -> 10, 7.50 -> 7.5
	return q.toFixed(2).replace(/\.?0+$/, '');
}

export function formatKgForGym(valueKg: number, incrementKg = 2.5): string {
	return `${formatKgValueForGym(valueKg, incrementKg)}kg`;
}

