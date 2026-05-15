const weatherAPI = require("openmeteo");

/**
 * code adapted from: open-meteo code generator from the API documentation, 
 * but the code was only provided in typescript by the generator
 * so, i converted it to javascript and modified it slightly to fit our needs.
 * 
 * source: https://open-meteo.com/en/docs
 * 
 * Added by @Markus
 * 
 * service function that fetches weather data for a inputted coordinate from open-meteo API.
 * Allows for fetching of past weather data by using the past_days parameter in the API call.
 */
async function fetchWeatherData(lat, lng, past_days) {
    try {
    const params = {
        latitude: lat,
        longitude: lng,
        hourly: ["temperature_2m", "direct_radiation", "relative_humidity_2m", "uv_index", "is_day", "wind_speed_10m"],
        timezone: "auto",
        past_days: past_days,
        forecast_days: 1,
        temporal_resolution: "hourly_3",
    };

    const url = `https://api.open-meteo.com/v1/forecast`;
    const responses = await weatherAPI.fetchWeatherApi(url, params);
    const response = responses[0];

    const hourly = response.hourly();

    const utcOffsetSeconds = response.utcOffsetSeconds();

    const start = Number(hourly.time());
    const end = Number(hourly.timeEnd());

    const interval = hourly.interval();
    const count = (end - start) / interval;

    const times = [];

    for (let i = 0; i < count; i++) {
        const timestamp = start + (i * interval);
        times.push(new Date(timestamp * 1000));
    }

    const weatherData = {

        hourly: {

            time: times,
            temperature_2m: hourly.variables(0).valuesArray(),
            direct_radiation: hourly.variables(1).valuesArray(),
            relative_humidity_2m: hourly.variables(2).valuesArray(),
            uv_index: hourly.variables(3).valuesArray(),
            is_day: hourly.variables(4).valuesArray(),
            wind_speed_10m: hourly.variables(5).valuesArray()
        }
    };

    return weatherData;

    } 
    catch (err) {
        console.error('Service error:', err);
        throw err; 
    }
}

module.exports = {fetchWeatherData};
