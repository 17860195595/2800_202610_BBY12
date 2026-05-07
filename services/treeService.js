
/**
 * Added by @Markus
 * 
 * service function that fetches tree data for an inputted coordinate from the Vancouver Open Data API.
 */
async function fetchTreeData(lat, lng) {
    try {
        const url = `https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-trees/records?select=geo_point_2d&where=within_distance(geo_point_2d%2C%20GEOM%27POINT(%20${lng}%20%20${lat})%27%2C%2050m)&limit=-1`;
        const response = await fetch(url);
        const data = await response.json();

        return data;

    } 
    catch (err) {
        console.error('Tree Service error:', err);
        throw err; 
    }
}

module.exports = {fetchTreeData};