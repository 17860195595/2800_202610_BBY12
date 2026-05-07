/**
 * Added by @Markus
 * 
 * service function that fetches water fountain data for an inputted coordinate from the Vancouver Open Data API.
 */
async function fetchWaterFountainData() {
    try {
        const url = `/api/explore/v2.1/catalog/datasets/drinking-fountains/records?select=geo_point_2d%2C%20location&limit=-1`;
        const response = await fetch(url);
        const data = await response.json();

        return data;

    } 
    catch (err) {
        console.error('Water Fountain Service error:', err);
        throw err; 
    }
}

module.exports = {fetchWaterFountainData};