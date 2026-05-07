
/**
 * Added by @Markus
 * 
 * service function that computes a shade score for a given location based on the number of nearby trees, buildings, and sun position.
 * the shade score is a value between 0 and 1, where 0 means no shade and 1 means full shade.
 */
function computeShade(trees, buildings, isday, sun) {

    if(!isday) {
        return 1;
    }

    const treeCount = trees.results.length;
    const buildingCount = buildings.results.length;

    const density = (treeCount * 1) + (buildingCount * 2);

    const densityScore = Math.min(1, density / 100);

    let timeFactor = 0;

    if (sun.altitude <= 0) {
        timeFactor = 0.2;
    } 
    else {
        const normalizedAltitude = sun.altitude / (Math.PI / 2);

        timeFactor = 1 - normalizedAltitude;
        timeFactor = 0.3 + (timeFactor * 0.7);

    }
    
    const shade = densityScore * timeFactor;

    return Math.min(1, shade);
}

module.exports = {computeShade};