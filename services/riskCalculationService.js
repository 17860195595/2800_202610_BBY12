
/**
 * Added by @Markus
 * 
 * service function that computes a risk score for a given location based on the temperature, direct radiation, UV index, and shade score.
 * the risk score is a value between 0 and 1, where 0 means no risk and 1 means high risk.
 */
function computeRisk(temperature, directRadiation, uv, shade) {

    const tempScore = Math.min(1, temperature / 35);
    const uvScore = Math.min(1, uv / 10);
    const radiationScore = Math.min(1, directRadiation / 800);
    
    const exposure = radiationScore * (1 - shade);

    const risk =
        (tempScore * 0.4) +
        (exposure * 0.5) +
        (uvScore * 0.1);

    return Math.min(1, risk);
}

module.exports = {computeRisk};