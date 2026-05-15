/**
 * @file mapSpotDetailRisk.js
 * Risk tier buckets for spot detail badge + 24h chart bar colour (0–1 score from /api/risk).
 * Loaded before mapSpotDetailRender.js / mapSpotDetailPanel.js.
 * @author Jiahao
 */

/** Upper bound (exclusive) of LOW tier on the 0–1 risk score scale. */
var MAP_RISK_MID_MIN = 0.5;
/** Lower bound (inclusive) of HIGH tier on the 0–1 risk score scale. */
var MAP_RISK_HIGH_MIN = 0.8;

/**
 * @param {number} score 0–1 risk score; non-numeric / NaN → unknown tier.
 * @returns {{ tier: string, label: string }}
 */
export function mapRiskTierFromScore(score) {
    if (typeof score !== "number" || isNaN(score)) {
        return { tier: "unknown", label: "—" };
    }
    if (score < MAP_RISK_MID_MIN) {
        return { tier: "low", label: "LOW" };
    }
    if (score < MAP_RISK_HIGH_MIN) {
        return { tier: "mid", label: "MID" };
    }
    return { tier: "high", label: "HIGH" };
}
