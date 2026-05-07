require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

/**
 * Added by @Markus
 * 
 * gets all the services we need to compute the shade and risk scores for a location and time.
 */
const { computeShade } = require("./services/ShadeCalculationService.js");
const { computeRisk } = require("./services/riskCalculationService.js");
const { getSunPosition } = require("./services/sunAngleService.js");
const { fetchWeatherData } = require("./services/weatherService.js");
const { fetchTreeData } = require("./services/treeService.js");
const { fetchBuildingData } = require("./services/buildingService.js");

//setup express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

//setup routes
const healthRouter = require('./routes/health');
app.use('/api/health', healthRouter);


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '/public')));

  
/**
 * Added by @Adam
 * 
 * Hey guys i did this just so the server can 
 * start so that way it has a default route.
 */
app.get("/", (req, res) => 
  {
    res.sendFile(path.join(__dirname, '/public/index.html'));
  });

/**
 * Added by @Adam
 * 
 * I did this just so i can test and see 
 * the login page i am working on.
 */
app.get("/login", (req, res) => 
  {
    res.sendFile(path.join(__dirname, '/public/login.html'));
  });

/**
 * Added by @Adam
 * 
 * I did this just so i can test and see 
 * the signup page i am working on.
 */
app.get("/signup", (req, res) => 
  {
    res.sendFile(path.join(__dirname, '/public/signup.html'));
  });

/**
 * Added by @Adam
 * 
 * I did this just so i can test and see 
 * the analytics page i am working on.
 */
app.get("/analytics", (req, res) => 
  {
    res.sendFile(path.join(__dirname, '/public/analytics.html'));
  });

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/about.html"));
});

app.get("/alert", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/alert.html"));
});

/**
 * Added by @Markus
 * 
 * fetchs risk and general data from the various services files and returns it in a json format to be used by the frontend to display the data and analytics.
 * the results look like this
 * result[0] = tree data
 * result[1] = building data
 * result[2] = weather/risk data for oldest day
 * result[last index] = weather/risk data for current day 
 */
app.get("/api/risk", async (req, res) => {
  try {
    const lat = req.query.lat;
    const lng = req.query.lng;
    const past_days = req.query.past_days || 0;

    const weather = await fetchWeatherData(lat, lng, past_days);
    const trees = await fetchTreeData(lat, lng, 50);
    const buildings = await fetchBuildingData(lat, lng, 50);

    const results = [];
    const entriesPerDay = 8;

    results.push(trees);
    results.push(buildings);

    for (let i = 0; i < weather.hourly.time.length; i++) {

        const time = weather.hourly.time[i];

        const sun = getSunPosition(lat, lng, time);

        const shade = computeShade(trees, buildings, weather.hourly.is_day[i], sun);

        const temp = weather.hourly.temperature_2m[i];
        const uv = weather.hourly.uv_index[i];
        const humidity = weather.hourly.relative_humidity_2m[i];
        const directRadiation = weather.hourly.direct_radiation[i];

        const risk = computeRisk(temp, directRadiation, uv, shade);

        const entry = {
            time,
            shade,
            risk,
            temperature_C: weather.hourly.temperature_2m[i],
            direct_radiation_Wm2: weather.hourly.direct_radiation[i],
            uv_index: weather.hourly.uv_index[i],
            humidity_percent: weather.hourly.relative_humidity_2m[i],
            isday: weather.hourly.is_day[i],
            windspeed_KM: weather.hourly.wind_speed_10m[i]
        }

        const dayIndex = Math.floor(i / entriesPerDay) + 2;

        if (!results[dayIndex]) {
         results[dayIndex] = [];
        }

        results[dayIndex].push(entry);
      }
    res.json(results);

  } 
  catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

/**
 * Added by @Markus
 * 
 * fetches all water fountain locations in the city of vancouver, there are around 250 water fountains total
 * we can probably just save this data in the database but for now we will just have this fetch
 */
app.get("/api/fountains", async (req, res) => {
  try {
    const fountains = await fetchWaterFountainData();
    res.json(fountains);
  } 
  catch (error) {
    console.error('Error fetching water fountain data:', error);
    res.status(500).json({ error: 'Failed to fetch water fountain data' });
  }
});

/**
 * Added by @Adam
 * 
 * Just the port listner so we can get
 * server running to test our pages.
 */
app.listen(PORT, () => 
{
  console.log(`Server listening on http://localhost:${PORT}`);
});






// idk what this is but ill just leave it here for now so someone can comment it out for me
// (async function start() 
// {
//   const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/project_template';
//   const skipMongo = String(process.env.SKIP_MONGODB || '').toLowerCase() === '1' || process.env.SKIP_MONGODB === 'true';

//   if (skipMongo) 
//   {
//     console.warn('SKIP_MONGODB set — server starting without database.');
//   } 
//   else 
//   {
//     try 
//     {
//       await mongoose.connect(uri);
//       console.log('MongoDB connected');
//     } 
//     catch (err) 
//     {
//       console.warn('MongoDB unavailable:', err.message);
//       console.warn('Server will still run (static files / routes that do not need DB).');
//       console.warn('Fix MONGODB_URI or start MongoDB, then restart to connect.');
//     }
//   }

//   app.listen(PORT, () => 
//   {
//     console.log(`Server listening on http://localhost:${PORT}`);
//   });
// })();
