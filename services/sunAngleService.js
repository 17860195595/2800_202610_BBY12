const SunCalc = require("suncalc");

/**
 * Added by @Markus
 * 
 * a simple service function that fetches sun position data for a inputted coordinate and time.
 */
function getSunPosition(lat, lng, time) {

    return SunCalc.getPosition(time, lat, lng);
}

module.exports = {getSunPosition};