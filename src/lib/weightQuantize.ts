/**
 * Weight quantization helpers (gym-friendly plate increments).
 *
 * Requirement: for auto-computed loads shown to students, quantize to the NEAREST
 * 2.5kg increment (common smallest plate increment in gyms).
 *
 * Notes:
 * - For positive values: nearest means standard rounding to the increment.
 * - For negative values (used to represent assistance / counterweight as negative external load):
 *   nearest is computed symmetrically by rounding the absolute value, then restoring the sign.
 */

export type QuantizeMode = "nearest" | "floor" | "ceil";

export function quantizeKgForGym(
	valueKg: number,
	incrementKg = 2.5,
	mode: QuantizeMode = "nearest",
): number {
	if (!Number.isFinite(valueKg)) return valueKg;
	if (!Number.isFinite(incrementKg) || incrementKg <= 0) return valueKg;

	// Avoid floating noise by working on a scaled integer grid.
	const steps = valueKg / incrementKg;

	let quantizedSteps: number;
	if (mode === "floor") {
		// "floor" always rounds down for positives; for negatives, round toward 0 (ceil) to avoid "more negative".
		quantizedSteps = valueKg >= 0 ? Math.floor(steps) : Math.ceil(steps);
	} else if (mode === "ceil") {
		// "ceil" always rounds up for positives; for negatives, round away from 0 (floor).
		quantizedSteps = valueKg >= 0 ? Math.ceil(steps) : Math.floor(steps);
	} else {
		// "nearest" rounding, symmetric for negatives
		const absSteps = Math.abs(steps);
		quantizedSteps = Math.sign(valueKg) * Math.round(absSteps);
	}

	const quantized = quantizedSteps * incrementKg;

	// Normalize to 2 decimals to avoid 7.499999999 style artifacts.
	return Math.round(quantized * 100) / 100;
}

export function formatKgValueForGym(valueKg: number, incrementKg = 2.5, mode: QuantizeMode = "nearest"): string {
	const q = quantizeKgForGym(valueKg, incrementKg, mode);
	if (!Number.isFinite(q)) return String(q);
	// strip trailing zeros: 10.00 -> 10, 7.50 -> 7.5
	return q.toFixed(2).replace(/\.?0+$/, '');
}

export function formatKgForGym(valueKg: number, incrementKg = 2.5, mode: QuantizeMode = "nearest"): string {
	return `${formatKgValueForGym(valueKg, incrementKg, mode)}kg`;
}

