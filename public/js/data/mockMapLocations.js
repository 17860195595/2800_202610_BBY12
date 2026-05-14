/**
 * Map seed locations for ShadeSafe (Vancouver area).
 *
 * These rows are pure "anchors": only id / name / lat / lng / summary are
 * authoritative here. There is intentionally NO hard-coded weather (tempC,
 * uvIndex, humidityPct, windKmh, shadeScore) — those values are fetched on
 * demand from /api/risk only when the user actually clicks a pin (see
 * services/mapApi.js + map/mapSpotDetail.js).
 *
 * For the heat layer to keep spatial variation across the 100 seeds without
 * touching the API, every spot still gets a synthesized mockHourly[] array
 * derived from a hash of spot.id (see buildMockHourlySeries below). That
 * synthetic data drives mapHeat.js and is NOT shown in the detail panel.
 *
 * @author Jiahao
 */

/**
 * Map a numeric UV index to a coarse label (used by the synthetic mock series
 * only; the detail panel formats real API uvIndex values via mapApi.js).
 * @param {number} uv
 * @returns {string}
 * @author Jiahao
 */
function mockUvLevelFromIndex(uv) {
    if (uv <= 0) return "None";
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very high";
    return "Extreme";
}

/**
 * Synthesize 24 hourly samples for the heat layer ONLY. Each spot gets a
 * deterministic baseline derived from a hash of spot.id so neighbouring pins
 * still produce distinguishable temperature, UV, humidity, wind, and shade
 * patterns — even though the seed objects no longer carry hard-coded weather.
 *
 * The detail panel does NOT consume this array; it waits for /api/risk and
 * uses spot.apiHourly instead. See mapSpotDetail.js for the live data path.
 *
 * @param {Object} spot
 * @returns {Array<Object>}
 * @author Jiahao
 */
function buildMockHourlySeries(spot) {
    var idShift = 0;
    if (spot && spot.id) {
        var sid = String(spot.id);
        for (var ci = 0; ci < sid.length; ci++) {
            idShift = (idShift * 31 + sid.charCodeAt(ci)) | 0;
        }
    }
    var hourPhase = ((idShift % 19) - 9) * 0.11;
    var tShift = ((idShift >> 3) % 13) - 6;
    var uvShift = ((idShift >> 5) % 5) - 2;
    var humShift = ((idShift >> 7) % 11) - 5;
    var windShift = ((idShift >> 9) % 7) - 3;
    var shadeShift = ((idShift >> 11) % 9) - 4;

    var baseT = 18 + tShift * 0.7;
    var baseUv = 5 + uvShift * 0.4;
    var baseHum = 62 + humShift * 0.8;
    var baseWind = 10 + windShift * 0.5;
    var baseShade = Math.max(0.1, Math.min(0.9, 0.45 + shadeShift * 0.04));

    var out = [];

    for (var h = 0; h < 24; h++) {
        var phase = (h - 5.5 + hourPhase) / 13;
        var sun = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, phase))));
        var night = h < 6 || h > 21 ? 1 : 0;

        var tempC =
            Math.round(
                (baseT - 5.8 + sun * 10.5 - night * 3.8 + ((h % 5) - 2) * 0.15) * 10
            ) / 10;

        var uvRaw = baseUv * sun + (sun > 0.15 ? 0.3 : 0);
        var uvIndex = Math.max(0, Math.min(11, Math.round(uvRaw)));
        if (sun < 0.06) uvIndex = 0;

        var humidityPct = Math.max(
            30,
            Math.min(
                95,
                Math.round(baseHum + (1 - sun) * 8 - night * 4 + ((h % 7) - 3) * 0.5)
            )
        );

        var windKmh = Math.max(
            0,
            Math.round(baseWind + (sun > 0.5 ? 2 : 0) + ((h % 6) - 2.5))
        );

        var shadeScore = Math.min(
            1,
            Math.max(0, baseShade + (1 - sun) * 0.06 - sun * 0.04 + ((h % 4) - 1.5) * 0.02)
        );

        out.push({
            hour: h,
            tempC: tempC,
            uvIndex: uvIndex,
            uvLevel: mockUvLevelFromIndex(uvIndex),
            humidityPct: humidityPct,
            windKmh: windKmh,
            shadeScore: shadeScore,
        });
    }
    return out;
}

/**
 * 100 curated seed coordinates across Vancouver. Each row only carries
 * identity + geometry + a human summary — no weather data is shipped from the
 * frontend. Real readings come from GET /api/risk on click.
 *
 * Seed coordinates are accurate to ~10–30 m, which is well within the 50 m
 * search radius used by services/buildingService.js.
 *
 * @type {Array<Object>}
 */
var MOCK_MAP_LOCATIONS = [
    { id: "loc-canada-place", name: "Canada Place", lat: 49.288852740176985, lng: -123.11095825080687,
      summary: "Open waterfront; limited shade except near awnings." },
    { id: "loc-english-bay", name: "English Bay Beach", lat: 49.286377406890026, lng: -123.14312120287617,
      summary: "Sandy beach with scattered trees along the seawall." },
    { id: "loc-pacific-spirit", name: "Pacific Spirit Regional Park", lat: 49.25302658140488, lng: -123.21655261566097,
      summary: "Dense forest canopy; deep shade across most trails." },
    { id: "loc-stanley-park", name: "Stanley Park (central)", lat: 49.305139404202095, lng: -123.14450929576203,
      summary: "Tall conifers shade interior trails; clearings get strong UV." },
    { id: "loc-jericho-beach", name: "Jericho Beach Park", lat: 49.27230755702258, lng: -123.19872693316934,
      summary: "Beachfront grass; tree line at park edge gives partial relief." },
    { id: "loc-queen-elizabeth", name: "Queen Elizabeth Park", lat: 49.24193298097644, lng: -123.11295573620376,
      summary: "Gardens and treelines offer good intermittent shade." },
    { id: "loc-vandusen", name: "VanDusen Botanical Garden", lat: 49.23945760226127, lng: -123.13098284196221,
      summary: "Curated trees and hedges shade most paths." },
    { id: "loc-granville-island", name: "Granville Island (outdoor areas)", lat: 49.27084603635488, lng: -123.13454774151823,
      summary: "Mixed canopy and building shade near market; docks are open." },
    { id: "loc-pne", name: "The PNE", lat: 49.28206819312048, lng: -123.03667498753784,
      summary: "Large open midway; structure shade is patchy mid-day." },
    { id: "loc-everett-crowley", name: "Everett Crowley Park", lat: 49.210772970672686, lng: -123.03634892728893,
      summary: "Reclaimed forest park; mostly shaded interior loops." },
    { id: "loc-kits-beach", name: "Kitsilano Beach", lat: 49.27477451688987, lng: -123.15418606516387,
      summary: "Beach and grass sunny; tree line along Cornwall gives partial relief." },
    { id: "loc-trout-lake", name: "John Hendry Park (Trout Lake)", lat: 49.25583007800526, lng: -123.06344033460587,
      summary: "Lake-side meadows; willows and cedars provide pockets of shade." },
    { id: "loc-vanier-park", name: "Vanier Park", lat: 49.27739812113668, lng: -123.14314877388504,
      summary: "Open lawn next to the bay; limited tree cover." },
    { id: "loc-memorial-south", name: "Memorial South Park", lat: 49.23118480236738, lng: -123.08560612329525,
      summary: "Sports fields plus shaded perimeter trees." },
    { id: "loc-fraser-river-park", name: "Fraser River Park", lat: 49.20787635148828, lng: -123.15093682398403,
      summary: "Riverfront walk with patches of trees and open grass." },
    { id: "loc-spanish-banks", name: "Spanish Banks Beach", lat: 49.27673627888227, lng: -123.21456052252569,
      summary: "Long open beach; tree line set back from sand." },
    { id: "loc-new-brighton", name: "New Brighton Park", lat: 49.29047170142769, lng: -123.03933118817139,
      summary: "Waterfront park with pool; trees on inland edge." },
    { id: "loc-robson-square", name: "Robson Square", lat: 49.281957466671734, lng: -123.12195039042108,
      summary: "Downtown plaza; tall buildings cast directional shade by hour." },
    { id: "loc-langara", name: "Langara", lat: 49.220727510989384, lng: -123.1138750641783,
      summary: "Mixed campus and golf course; intermittent shade." },

    // ----- Downtown / West End / Coal Harbour / Yaletown -----
    { id: "loc-david-lam-park", name: "David Lam Park", lat: 49.2722, lng: -123.1230,
      summary: "False Creek lawn with trees toward Drake St." },
    { id: "loc-george-wainborn", name: "George Wainborn Park", lat: 49.2724, lng: -123.1267,
      summary: "Waterfront park between Pacific and the seawall." },
    { id: "loc-coopers-park", name: "Coopers' Park", lat: 49.2718, lng: -123.1146,
      summary: "Under the Cambie Bridge; partial structural shade." },
    { id: "loc-andy-livingstone", name: "Andy Livingstone Park", lat: 49.2767, lng: -123.1095,
      summary: "Sports fields beside Chinatown; perimeter trees." },
    { id: "loc-sunset-beach", name: "Sunset Beach Park", lat: 49.2795, lng: -123.1394,
      summary: "Open beach lawn; small clusters of trees." },
    { id: "loc-devonian-harbour", name: "Devonian Harbour Park", lat: 49.2932, lng: -123.1318,
      summary: "Coal Harbour green space; mature trees near marina." },
    { id: "loc-harbour-green", name: "Harbour Green Park", lat: 49.2906, lng: -123.1212,
      summary: "Coal Harbour seawall lawn; light tree cover." },
    { id: "loc-cardero-park", name: "Cardero Park", lat: 49.2935, lng: -123.1310,
      summary: "Pocket park beside Coal Harbour; shaded benches." },
    { id: "loc-nelson-park", name: "Nelson Park", lat: 49.2810, lng: -123.1318,
      summary: "West End neighbourhood park; mature shade trees." },
    { id: "loc-victory-square", name: "Victory Square", lat: 49.2818, lng: -123.1077,
      summary: "Downtown triangle plaza; cenotaph and lawn." },
    { id: "loc-cathedral-square", name: "Cathedral Square", lat: 49.2815, lng: -123.1144,
      summary: "Small downtown plaza next to Holy Rosary Cathedral." },
    { id: "loc-art-gallery", name: "Vancouver Art Gallery", lat: 49.2828, lng: -123.1207,
      summary: "Civic landmark and surrounding plaza." },
    { id: "loc-library-square", name: "Library Square", lat: 49.2796, lng: -123.1149,
      summary: "Vancouver Public Library central; arched plaza." },
    { id: "loc-pacific-centre", name: "Pacific Centre Mall", lat: 49.2832, lng: -123.1175,
      summary: "Downtown shopping centre; mostly indoor." },
    { id: "loc-hudsons-bay", name: "Hudson's Bay Vancouver", lat: 49.2839, lng: -123.1184,
      summary: "Heritage department store on Granville." },
    { id: "loc-tinseltown", name: "International Village Mall", lat: 49.2807, lng: -123.1075,
      summary: "Mall in Chinatown / Crosstown." },
    { id: "loc-maple-tree-square", name: "Maple Tree Square (Gastown)", lat: 49.2841, lng: -123.1062,
      summary: "Heart of Gastown; cobblestone plaza." },

    // ----- Stanley Park interior + nearby -----
    { id: "loc-lost-lagoon", name: "Lost Lagoon", lat: 49.2962, lng: -123.1402,
      summary: "Wooded lagoon at the edge of Stanley Park." },
    { id: "loc-brockton-point", name: "Brockton Point", lat: 49.3011, lng: -123.1217,
      summary: "Stanley Park headland with totems and lighthouse." },
    { id: "loc-second-beach", name: "Second Beach", lat: 49.2924, lng: -123.1556,
      summary: "Beach and pool on the Stanley Park seawall." },
    { id: "loc-third-beach", name: "Third Beach", lat: 49.3023, lng: -123.1583,
      summary: "Forested beach on Stanley Park's west side." },
    { id: "loc-prospect-point", name: "Prospect Point", lat: 49.3128, lng: -123.1430,
      summary: "Cliff lookout in Stanley Park; ample tree cover." },

    // ----- Kitsilano / Point Grey -----
    { id: "loc-tatlow-park", name: "Tatlow Park", lat: 49.2746, lng: -123.1660,
      summary: "Creekside park with mature trees in Kits." },
    { id: "loc-volunteer-park", name: "Volunteer Park", lat: 49.2740, lng: -123.1768,
      summary: "Kits neighbourhood park with ball diamond." },
    { id: "loc-mcbride-park", name: "McBride Park", lat: 49.2680, lng: -123.1633,
      summary: "Kitsilano park with playground and tree borders." },
    { id: "loc-connaught-park", name: "Connaught Park", lat: 49.2549, lng: -123.1556,
      summary: "South Kits park with tennis and shade trees." },
    { id: "loc-hadden-park", name: "Hadden Park", lat: 49.2767, lng: -123.1499,
      summary: "Open lawn next to Vanier on Kits Point." },
    { id: "loc-locarno-beach", name: "Locarno Beach", lat: 49.2728, lng: -123.1872,
      summary: "Quiet sandy beach beside Jericho." },
    { id: "loc-maritime-museum", name: "Vancouver Maritime Museum", lat: 49.2776, lng: -123.1453,
      summary: "Museum on Kits Point in Vanier Park." },
    { id: "loc-space-centre", name: "HR MacMillan Space Centre", lat: 49.2762, lng: -123.1442,
      summary: "Planetarium and museum complex in Vanier Park." },

    // ----- UBC / Endowment -----
    { id: "loc-ubc-rose-garden", name: "UBC Rose Garden", lat: 49.2691, lng: -123.2562,
      summary: "Coastal viewpoint at UBC with formal beds." },
    { id: "loc-museum-anthropology", name: "Museum of Anthropology (UBC)", lat: 49.2696, lng: -123.2589,
      summary: "Iconic UBC museum with totem grounds." },
    { id: "loc-wreck-beach", name: "Wreck Beach", lat: 49.2627, lng: -123.2628,
      summary: "Forested cliff beach below UBC." },

    // ----- Mount Pleasant / Olympic Village / Main St -----
    { id: "loc-olympic-village-plaza", name: "Olympic Village Plaza", lat: 49.2702, lng: -123.1129,
      summary: "Public plaza by False Creek with bird sculptures." },
    { id: "loc-hinge-park", name: "Hinge Park", lat: 49.2713, lng: -123.1162,
      summary: "Wetland park beside Olympic Village." },
    { id: "loc-mount-pleasant-park", name: "Mount Pleasant Park", lat: 49.2603, lng: -123.1029,
      summary: "Neighbourhood park with seasonal trees." },
    { id: "loc-jonathan-rogers", name: "Jonathan Rogers Park", lat: 49.2620, lng: -123.1071,
      summary: "Mount Pleasant park with trees lining 8th." },
    { id: "loc-china-creek-north", name: "China Creek North Park", lat: 49.2645, lng: -123.0775,
      summary: "Sports fields with mature surrounding trees." },
    { id: "loc-china-creek-south", name: "China Creek South Park", lat: 49.2552, lng: -123.0764,
      summary: "Skate park and tracks with shade trees." },
    { id: "loc-charleson-park", name: "Charleson Park", lat: 49.2700, lng: -123.1235,
      summary: "False Creek pond with hilly green space." },
    { id: "loc-choklit-park", name: "Choklit Park", lat: 49.2654, lng: -123.1396,
      summary: "Tiny terraced Fairview park." },
    { id: "loc-douglas-park", name: "Douglas Park", lat: 49.2509, lng: -123.1235,
      summary: "Cambie corridor park with field house." },
    { id: "loc-hillcrest-park", name: "Hillcrest Park", lat: 49.2451, lng: -123.1095,
      summary: "Park beside the Hillcrest Aquatic Centre." },
    { id: "loc-riley-park", name: "Riley Park", lat: 49.2459, lng: -123.1029,
      summary: "Park beside Nat Bailey Stadium and the curling club." },

    // ----- East Vancouver / Hastings-Sunrise / Renfrew -----
    { id: "loc-strathcona-park", name: "Strathcona Park", lat: 49.2790, lng: -123.0840,
      summary: "Strathcona neighbourhood park with playing fields." },
    { id: "loc-oppenheimer-park", name: "Oppenheimer Park", lat: 49.2823, lng: -123.0939,
      summary: "DTES community park with mature trees." },
    { id: "loc-sun-yat-sen", name: "Dr. Sun Yat-Sen Garden", lat: 49.2799, lng: -123.1037,
      summary: "Classical Chinese garden in Chinatown." },
    { id: "loc-crab-park", name: "CRAB Park at Portside", lat: 49.2862, lng: -123.0997,
      summary: "Waterfront DTES park." },
    { id: "loc-pandora-park", name: "Pandora Park", lat: 49.2792, lng: -123.0567,
      summary: "Hastings-Sunrise park with playground." },
    { id: "loc-mcspadden-park", name: "McSpadden Park", lat: 49.2616, lng: -123.0680,
      summary: "Quiet park east of Commercial Drive." },
    { id: "loc-clinton-park", name: "Clinton Park", lat: 49.2624, lng: -123.0570,
      summary: "Grassland with tree-lined edges." },
    { id: "loc-falaise-park", name: "Falaise Park", lat: 49.2466, lng: -123.0408,
      summary: "Renfrew-Collingwood neighbourhood park." },
    { id: "loc-norquay-park", name: "Norquay Park", lat: 49.2435, lng: -123.0461,
      summary: "Sports park along Kingsway." },
    { id: "loc-slocan-park", name: "Slocan Park", lat: 49.2491, lng: -123.0577,
      summary: "Greenway park with playground." },
    { id: "loc-renfrew-ravine", name: "Renfrew Ravine Park", lat: 49.2511, lng: -123.0376,
      summary: "Forested ravine with creek trails." },
    { id: "loc-hastings-park", name: "Hastings Park", lat: 49.2818, lng: -123.0382,
      summary: "Large urban park inside the PNE grounds." },

    // ----- South Vancouver / Marpole / Sunset -----
    { id: "loc-sunset-park", name: "Sunset Park", lat: 49.2225, lng: -123.0996,
      summary: "Park surrounding the Sunset Community Centre." },
    { id: "loc-kensington-park", name: "Kensington Park", lat: 49.2405, lng: -123.0789,
      summary: "Park beside Kensington Community Centre." },
    { id: "loc-tisdall-park", name: "Tisdall Park", lat: 49.2362, lng: -123.1239,
      summary: "Cambie corridor park with tennis." },
    { id: "loc-oakridge-centre", name: "Oakridge Park (Centre)", lat: 49.2330, lng: -123.1167,
      summary: "Major shopping centre under redevelopment." },
    { id: "loc-marpole-park", name: "Marpole Park", lat: 49.2120, lng: -123.1300,
      summary: "Marpole community green space." },
    { id: "loc-sw-marine-shoreline", name: "Riverfront Park (SW Marine)", lat: 49.2065, lng: -123.1184,
      summary: "Greenway along the Fraser River." },
    { id: "loc-langara-golf", name: "Langara Golf Course", lat: 49.2218, lng: -123.1099,
      summary: "Public course with grass and trees." },

    // ----- Kerrisdale / Shaughnessy / Arbutus -----
    { id: "loc-kerrisdale-park", name: "Kerrisdale Centennial Park", lat: 49.2308, lng: -123.1554,
      summary: "Kerrisdale neighbourhood park with trees." },
    { id: "loc-quilchena-park", name: "Quilchena Park", lat: 49.2459, lng: -123.1565,
      summary: "Forested ravine and tennis park." },
    { id: "loc-shaughnessy-park", name: "Shaughnessy Park", lat: 49.2467, lng: -123.1326,
      summary: "Tree-lined park in Shaughnessy." },
    { id: "loc-granville-park", name: "Granville Park", lat: 49.2604, lng: -123.1377,
      summary: "Small park between Fairview and Shaughnessy." },
    { id: "loc-prince-of-wales-park", name: "Prince of Wales Park", lat: 49.2454, lng: -123.1454,
      summary: "Sports field park with trees." },
    { id: "loc-vandusen-east-lawn", name: "VanDusen Visitor Centre", lat: 49.2393, lng: -123.1283,
      summary: "Entrance plaza of VanDusen Garden." },

    // ----- Killarney / Champlain / Killarney  -----
    { id: "loc-killarney-park", name: "Killarney Park", lat: 49.2188, lng: -123.0414,
      summary: "Park beside Killarney Community Centre." },
    { id: "loc-champlain-heights-park", name: "Champlain Heights Park", lat: 49.2191, lng: -123.0241,
      summary: "Greenway park in Champlain Heights." },
    { id: "loc-killarney-cc", name: "Killarney Community Centre", lat: 49.2193, lng: -123.0432,
      summary: "Community rec centre and surrounding fields." },

    // ----- Community centres + civic outposts -----
    { id: "loc-roundhouse-cc", name: "Roundhouse Community Centre", lat: 49.2735, lng: -123.1226,
      summary: "Historic train roundhouse in Yaletown." },
    { id: "loc-west-end-cc", name: "West End Community Centre", lat: 49.2858, lng: -123.1349,
      summary: "Community centre on Denman St." },
    { id: "loc-coal-harbour-cc", name: "Coal Harbour Community Centre", lat: 49.2916, lng: -123.1267,
      summary: "Waterfront community centre with park." },
    { id: "loc-mount-pleasant-cc", name: "Mount Pleasant Community Centre", lat: 49.2620, lng: -123.1066,
      summary: "Mount Pleasant rec centre with library." },
    { id: "loc-britannia-cc", name: "Britannia Community Centre", lat: 49.2747, lng: -123.0723,
      summary: "Major rec complex on Commercial Dr." },
    { id: "loc-hastings-cc", name: "Hastings Community Centre", lat: 49.2811, lng: -123.0567,
      summary: "Community centre and pool on Hastings." },
    { id: "loc-marpole-cc", name: "Marpole-Oakridge Community Centre", lat: 49.2129, lng: -123.1300,
      summary: "South Vancouver rec centre." },

    // ----- Misc cultural -----
    { id: "loc-bloedel-conservatory", name: "Bloedel Conservatory", lat: 49.2412, lng: -123.1124,
      summary: "Domed indoor garden inside QE Park." },
    { id: "loc-china-creek-skate", name: "China Creek Skate Park", lat: 49.2549, lng: -123.0763,
      summary: "Concrete skate bowl beside the BC Parkway." },
];

/**
 * Attach the synthesized mockHourly array (used by mapHeat.js) to every seed
 * spot. Stored on .mockHourly — never .hourly — so the detail panel never
 * accidentally renders synthetic numbers.
 * @author Jiahao
 */
(function attachMockHourlyToSpots() {
    if (typeof MOCK_MAP_LOCATIONS === "undefined" || !Array.isArray(MOCK_MAP_LOCATIONS)) {
        return;
    }
    for (var i = 0; i < MOCK_MAP_LOCATIONS.length; i++) {
        MOCK_MAP_LOCATIONS[i].mockHourly = buildMockHourlySeries(MOCK_MAP_LOCATIONS[i]);
    }
})();
