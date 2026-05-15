//Express stuff
const express = require("express");
const session = require("express-session");

//Database and .env file stuff
const { MongoStore } = require("connect-mongo");
const mongoose = require("mongoose");
require("dotenv").config();

//Encrypting and hashing stuff
const bcrypt = require("bcrypt");
const saltRounds = 12;
const Joi = require('joi');

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
const { fetchWaterFountainData } = require("./services/waterFountainService.js");
const { fetchWeatherGrid } = require("./services/weatherGridService.js");

//setup express app
const app = express();
const PORT = process.env.PORT || 3001;

//some other stuff
const cors = require("cors");
const path = require("path");

const MONGODB_URL = process.env.MONGODB_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_BASE = "https://api.clod.io/v1";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//setup routes
const healthRouter = require("./routes/health");
app.use("/api/health", healthRouter);

// User-submitted "what does it feel like here" reports (Mongo-backed).
const reportsRouter = require('./routes/reports');
app.use('/api/reports', reportsRouter);


/**
 * This is the session middleware.
 * 
 * @author Adam
 */
app.use(session(
{
    secret: SESSION_SECRET,
    store: MongoStore.create({mongoUrl : MONGODB_URL}),
    saveUninitialized : false,
    resave : true,
    cookie:
    {
      maxAge: 1000 * 60 * 60 * 1          //delets cookie (wristband) after 1 hour  
    }
}));

//Middle ware to check if user is logged in
function isAuthenticated(req, res, next)
{
  //if logged in
  if(req.session && req.session.user)
  {
    next();
  }
  //not logged in
  else
  {
    return res.redirect('/login.html');
  }
}


/**
 * Added by @Adam
 * 
 * This protects from just typing "page.html" in browser.
 */
app.use((req, res, next) =>
{
  // allow APIs to pass through
  if (req.path.startsWith('/api'))
  {
    return next();
  }

  // allow login + signup pages always
  const publicPages = ['/login.html', '/signup.html'];

  if (publicPages.includes(req.path))
  {
    return next();
  }

  // block ALL other html files unless logged in
  if (req.path.endsWith('.html'))
  {
    if (req.session && req.session.user)
    {
      return next();
    }

    return res.redirect('/login.html');
  }

  if (req.path === '/index.html')
{
  if (req.session && req.session.user)
  {
    return next();
  }

  return res.redirect('/login.html');
}

  next();
});


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '/public')));


/**
 * Setup user schema
 *
 * @author Adam.S
 * @credit I did use chat gpt for the mongoose part because i never done this before
 */
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  userFirstLog: { type: Number, default: 0 } 

});
const User = mongoose.model("User", userSchema);


/**
 * This is the session middleware.
 *
 * @author Adam
 */
app.use(
  session({
    secret: SESSION_SECRET,
    store: MongoStore.create({ mongoUrl: MONGODB_URL }),
    saveUninitialized: false,
    resave: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 1, //delets cookie (wristband) after 1 hour
    },
  }),
);


/**
 * added by @Adam
 * 
 * Joi validation schemas
 */
const signupSchema = Joi.object(
{
  username: Joi.string().min(3).max(20).required(),
  password: Joi.string().min(6).max(20).required()
});

const loginSchema = Joi.object(
{
  username: Joi.string().required(),
  password: Joi.string().required()
});


/**
 * Added by @Adam
 *
 * Hey guys i did this just so the server can
 * start so that way it has a default route.
 */
app.get('/', isAuthenticated, (req, res) => 
{
  res.redirect('/index.html')
});


/**
 * Added by @Adam
 *
 * I did this just so i can test and see
 * the login page i am working on.
 */
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/login.html"));
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
 * the post function handler for signup.
 * It takes in req object from client side js.
 *
 * @author Adam.s
 */
app.post('/login', async (req, res) => 
{
  //takes only error property in the object
  const {error} = loginSchema.validate(req.body);

  if(error)
  {
    //first error, and 400 = bad request
    return res.status(400).json(
    {
      message: error.details[0].message
    })
  }

  const username = req.body.username;
  const password = req.body.password;

  const user = await User.findOne({ username });

  if (!user) {
    //400 = client sent somthing wrong
    return res.status(400).json({
      message: "User not Found",
    });
  }

  const validPassy = await bcrypt.compare(password, user.password);

  if (!validPassy) {
    //400 = client sent somthing wrong
    return res.status(400).json({
      message: "Invalid Password",
    });
  }

  //set sessions user as the user in colection
  req.session.user = {
    username: user.username,
  };

  //make it know user has logged in more than once
  user.userFirstLog = 1;
  await user.save();

  //send res to client 
  res.json(
  {
    message: 'Login sucessfull'
  });
});

/**
 * Added by @Adam
 *
 * I did this just so i can test and see
 * the signup page i am working on.
 */
app.get("/signup", (req, res) => 
{
  res.sendFile(path.join(__dirname, "/public/signup.html"));
});

/**
 * the post function handler for signup.
 * It takes in req object from client side js.
 *
 * @author Adam.S
 */
app.post('/signup', async (req, res) => 
{
  //takes only error property in the object
  const {error} = signupSchema.validate(req.body);

  if(error)
  {
    //first error, and 400 = bad request
    return res.status(400).json(
    {
      message: error.details[0].message
    })
  }

  const username = req.body.username;
  const password = req.body.password;
  const userFirstLog = 0;

  const existingUser = await User.findOne({ username });

  if (existingUser) 
  {
    //400 = client sent somthing wrong
    return res.status(400).json({
      message: "User already exisits",
    });
  }

  const hashedPassy = await bcrypt.hash(password, saltRounds);

  //makes new User object
  const newUser = new User(
  {
    username,
    password: hashedPassy,
    //0 = only signed up 1 = logged in atleast once
    userFirstLog: 0
  });

  //save sends to mongo dv
  await newUser.save();

  //get username from DB and make session user = to that
  req.session.user = 
  {
    username: newUser.username
  };
    
  //res.json sends back json object back to client response
  res.json(
  {
    message: "Signup sucessfull",
  });
});

/**
 * Added by @Adam
 *
 * I did this just so i can test and see
 * the analytics page i am working on.
 */
app.get("/analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/analytics.html"));
});


app.get("/ai-chat", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/ai-chat.html"));
});
app.get("/analytics", isAuthenticated, (req, res) => 
{
  res.sendFile(path.join(__dirname, '/public/analytics.html'));
});

/**
 * Added by @Edward
 *
 * Adds routes for the Me, Profile, Settings, and About pages.
 * These pages support the user profile/settings flow from the Me page.
 */

app.get("/about", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "/public/about.html"));
});
app.get("/me", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "/public/me.html"));
});

app.get("/settings", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "/public/settings.html"));
});

app.get("/profile", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "/public/profile.html"));
});

app.get("/alert", isAuthenticated, (req, res) => 
{
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
 * 
 * Modified by AI for sprint 3 popup challenge,
 * seperated the main risk result building into a seperate function 
 * so that the AI chat page can also access the API data.
 */
function parseLatLng(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function buildRiskResults(lat, lng, past_days = 0) {
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
    const windSpeed_km = weather.hourly.wind_speed_10m[i];
    const risk = computeRisk(
      temp,
      directRadiation,
      uv,
      humidity,
      windSpeed_km,
      shade,
    );

    const entry = {
      time,
      shade,
      risk,
      temperature_C: weather.hourly.temperature_2m[i],
      direct_radiation_Wm2: weather.hourly.direct_radiation[i],
      uv_index: weather.hourly.uv_index[i],
      humidity_percent: weather.hourly.relative_humidity_2m[i],
      isday: weather.hourly.is_day[i],
      windspeed_KM: weather.hourly.wind_speed_10m[i],
    };

    const dayIndex = Math.floor(i / entriesPerDay) + 2;
    if (!results[dayIndex]) {
      results[dayIndex] = [];
    }
    results[dayIndex].push(entry);
  }

  return results;
}

app.get("/api/risk", isAuthenticated, async (req, res) => {
  try {
    const lat = parseLatLng(req.query.lat);
    const lng = parseLatLng(req.query.lng);
    const past_days = parseLatLng(req.query.past_days) || 0;

    if (lat === null || lng === null) {
      return res.status(400).json({ error: "Invalid latitude or longitude." });
    }

    const results = await buildRiskResults(lat, lng, past_days);
    res.json(results);
  } catch (error) {
    console.error("Error fetching weather data:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

/**
 * Added by @Jiahao
 *
 * Returns a single batched snapshot of real weather data over a coarse grid
 * covering Vancouver. The frontend heat layer (mapHeat.js) consumes this on
 * page load to draw the heat map from live values instead of the
 * mock-synthesized series in mockMapLocations.js. One HTTP call to
 * open-meteo, 30 stations, 24-hour densified series each.
 */
app.get("/api/weather-grid", async (req, res) => {
  try {
    const stations = await fetchWeatherGrid();
    res.json({ stations: stations, fetchedAt: new Date().toISOString() });
  }
  catch (error) {
    console.error('Error fetching weather grid:', error);
    res.status(500).json({ error: 'Failed to fetch weather grid' });
  }
});

/**
 * Added by @Markus
 *
 * handles all clod AI API contact and connections, used by AI page on the front end with fetch();
 * 
 * AI Generated.
 * for Sprint 3 popup challenge.
 */
app.post("/api/ai-chat", async (req, res) => {
  if (!AI_API_KEY) {
    return res.status(500).json({ error: "AI API key is not configured." });
  }

  const messages = Array.isArray(req.body.messages) ? req.body.messages : null;
  const location = req.body.location || {};
  const lat = parseLatLng(location.lat);
  const lng = parseLatLng(location.lng);

  if (!messages || !messages.length) {
    return res
      .status(400)
      .json({ error: "Request must include a non-empty messages array." });
  }
  if (lat === null || lng === null) {
    return res.status(400).json({
      error:
        "Request must include a valid location please select one below the chat. Or on the map page",
    });
  }

  try {
    const results = await buildRiskResults(lat, lng, 0);
    const current =
      Array.isArray(results[2]) && results[2].length ? results[2][0] : {};

    // Build hourly summary for the current day
    let hourlyText = "";
    if (Array.isArray(results[2]) && results[2].length > 0) {
      const hourlyData = results[2]
        .map((entry) => {
          const time = entry.time.toLocaleTimeString("en-CA", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
          });
          return `${time}: ${entry.temperature_C || "N/A"}°C, Risk ${(entry.risk || "N/A").toFixed ? (entry.risk || 0).toFixed(2) : "N/A"}, Shade ${entry.shade}`;
        })
        .join(" | ");
      hourlyText = "Hourly breakdown: " + hourlyData;
    }

    const locationText = [
      "Location: " + (location.name || "Selected Vancouver location"),
      "Coordinates: " + lat.toFixed(5) + ", " + lng.toFixed(5),
      "Current risk score: " +
        (typeof current.risk === "number"
          ? current.risk.toFixed(2)
          : "unknown"),
      "Current temperature (°C): " +
        (current.temperature_C != null ? current.temperature_C : "unknown"),
      "Current UV index: " +
        (current.uv_index != null ? current.uv_index : "unknown"),
      "Current humidity (%): " +
        (current.humidity_percent != null
          ? current.humidity_percent
          : "unknown"),
      "Current wind speed (km/h): " +
        (current.windspeed_KM != null ? current.windspeed_KM : "unknown"),
      "Current shade score: " +
        (current.shade != null ? current.shade : "unknown"),
      hourlyText,
    ].join(". ");

    const systemPrompt =
      "You are a Vancouver outdoor risk assistant. You have weather and risk data for the current day at 3-hour intervals (e.g., 12:00 AM, 3:00 AM, 6:00 AM, etc.). Answer only about heat risk, shade guidance, sun exposure, and safe outdoor conditions using only the data provided in the request. If a user asks about conditions at a specific time (e.g., 'What about 2pm?' or 'afternoon conditions'), analyze the 3-hour interval data provided and give guidance based on the closest available time slots, also when talking about a specific time convert the time to non military eg- 21:00 to 9:00pm. Use the current location's weather, risk score, and environmental conditions to provide a clear, helpful summary and practical guidance. If the user asks for a summary, include the current risk level, why it matters, and what actions are safest. Do not answer unrelated questions. If the user trys to steer the conversation away from heat risk, reply with: 'Sorry, I cannot speak on that topic.' Keep responses informative, slightly more detailed, and grounded in the latest data.";

    const openAiMessages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: locationText },
      ...messages,
    ];

    const aiResponse = await fetch(`${AI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + AI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Trinity Mini",
        messages: openAiMessages,
        max_tokens: 1000,
        temperature: 0.6,
      }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.json().catch(function () {
        return { error: "AI provider error" };
      });
      console.error("AI provider error:", aiResponse.status, errorBody);

      // Check for rate limit / quota errors
      const errorMsg = (errorBody.error || "").toLowerCase();
      if (
        aiResponse.status === 429 ||
        errorMsg.includes("quota") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("limit exceeded")
      ) {
        return res.status(429).json({
          error:
            "Daily request limit reached. Please try again tomorrow or check your API plan.",
        });
      }

      return res
        .status(502)
        .json({ error: errorBody.error || "AI request failed." });
    }

    const aiData = await aiResponse.json();
    const content =
      aiData && aiData.choices && aiData.choices[0] && aiData.choices[0].message
        ? aiData.choices[0].message.content
        : null;

    if (!content) {
      return res.status(502).json({ error: "AI provider returned no text." });
    }

    res.json({ answer: content });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: "Failed to get AI response." });
  }
});

/**
 * Added by @Markus
 *
 * fetches all water fountain locations in the city of vancouver, there are around 250 water fountains total
 * we can probably just save this data in the database but for now we will just have this fetch
 */
app.get("/api/fountains", isAuthenticated, async (req, res) => {
  try {
    const fountains = await fetchWaterFountainData();
    res.json(fountains);
  } catch (error) {
    console.error("Error fetching water fountain data:", error);
    res.status(500).json({ error: "Failed to fetch water fountain data" });
  }
});


/**
 * Added by @Adam
 * 
 * Logout route. Destroys sessiona and clears cookie and redirects back to login page.
 */
app.get('/logout', (req, res) => 
{
  req.session.destroy();

  //Deletes the cookie that express session makes from browser.
  res.clearCookie('connect.sid');
  res.redirect('/login.html')
});

/**
 * Added by @Adam
 * 
 * Page not found route.
 */
app.use( (req, res) =>
{
    res.status(404);
    res.send("404 Page not found :(");
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/profile.html"));
});


(async function start() 
{
  const url = process.env.MONGODB_URL || 'mongodb://localhost:27017/project_template';
  const skipMongo = String(process.env.SKIP_MONGODB || '').toLowerCase() === '1' || process.env.SKIP_MONGODB === 'true';

  if (skipMongo) 
  {
    console.warn('SKIP_MONGODB set — server starting without database.');
  }
  else 
  {
    try 
    {
      await mongoose.connect(url);
      console.log('MongoDB connected');
    }
    catch (err) 
    {
      console.warn('MongoDB unavailable:', err.message);
      console.warn('Server will still run (static files / routes that do not need DB).');
      console.warn('Fix MONGODB_URL or start MongoDB, then restart to connect.');
    }
  }

  app.listen(PORT, () => 
  {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
})();
