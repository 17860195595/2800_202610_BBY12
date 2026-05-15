/**
 * Added by @Markus
 *
 * service function that computes a risk score for a given location based on the temperature, direct radiation, UV index, and shade score.
 * the risk score is a value between 0 and 1, where 0 means no risk and 1 means high risk.
 * 
 * modified in sprint 3 to include humidity and windspeed in the calculations based on client feedback
 */
function computeRisk(temperature, directRadiation, uv, humidity, windSpeed_km, shade) 
{
  const tempScore = Math.min(1, temperature / 35);
  const uvScore = Math.min(1, uv / 10);
  const radiationScore = Math.min(1, directRadiation / 800);

  const exposure = radiationScore * (1 - shade * 1.2);

  const humidityFactor = humidity / 100;
  const adjustedTemp = tempScore * (1 + humidityFactor * 0.1);

  const windFactor = Math.min(Math.sqrt(windSpeed_km) / 6, 1);
  const coolingEffect = 1 - windFactor * 0.2;

  var risk = (adjustedTemp * 0.40) + 
             (radiationScore * 0.45) + 
             (uvScore * 0.15);


  risk *= coolingEffect;

  return Math.min(1, risk);
}

module.exports = { computeRisk };
