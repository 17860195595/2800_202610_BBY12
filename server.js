//Express stuff
const express = require('express');
const session = require('express-session');

//Database and .env file stuff
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');
require('dotenv').config();

//Encrypting and hashing stuff
const bcrypt = require('bcrypt');
const saltRounds = 12;

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

//setup express app
const app = express();
const PORT = process.env.PORT || 3001;

//some other stuff
const cors = require('cors');
const path = require('path');

const MONGODB_URL = process.env.MONGODB_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

// Middleware
app.use(cors());

/*
 * Added by @Edward
 *
 * Gives the Profile page enough JSON body space to save a resized avatar
 * data URL together with the user's profile information.
 */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

//setup routes
const healthRouter = require('./routes/health');
app.use('/api/health', healthRouter);

/*
 * Added by @Edward
 *
 * Loads the user-center API used by the Me and Profile pages for profile
 * fields, settings, and saved profile photos.
 */
const userCenterRouter = require('./routes/userCenter');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '/public')));



/**
 * Setup user schema
 * 
 * @author Adam.S
 * @credit I did use chat gpt for the mongoose part because i never done this before
 */
const userSchema = new mongoose.Schema(
{
  username: String,
  password: String
})
const User = mongoose.model('User', userSchema)

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

/*
 * Added by @Edward
 *
 * Mounts user-center routes after session middleware so avatar/profile saves
 * always use the currently logged-in user's session.
 */
app.use('/api/me', userCenterRouter);


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
 * the post function handler for signup.
 * It takes in req object from client side js.
 * 
 * @author Adam.s
 */
app.post('/login', async (req, res) => 
{
  console.log(req.body);//for testing
  const username = req.body.username;
  const password = req.body.password;

  const user = await User.findOne({ username });

  if(!user)
  {
    //400 = client sent somthing wrong
    return res.status(400).json(
    {
        message: 'User not Found'
    });
  }

  const validPassy = await bcrypt.compare(password, user.password);

  if(!validPassy)
  {
    //400 = client sent somthing wrong
    return res.status(400).json(
    {
        message: 'Invalid Password'
    });
  }

  //set sessions user as the user in colection
  req.session.user = 
  {
    username: user.username
  };

  //send res to client 
  res.json(
  {
    message: 'Login sucessfull'
  })
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
 * @author Adam.S
 */
app.post('/signup', async (req, res) => 
{
  console.log(req.body);//for testing
  const username = req.body.username;
  const password = req.body.password;

  const existingUser = await User.findOne({ username });

  if(existingUser)
  {
    //400 = client sent somthing wrong
    return res.status(400).json(
    {
      message: 'User already exisits'
    });
  }

  const hashedPassy = await bcrypt.hash(password, saltRounds);

  //makes new User object
  const newUser = new User(
  {
    username,
    password: hashedPassy
  });

  //save sends to mongo dv
  await newUser.save();
    
  //res.json sends back json object back to client response
  res.json({
    message: 'Signup sucessfull'
  });

});


/**
 * Added by @Adam
 * 
 * I did this just so i can test and see 
 * the analytics page i am working on.
 */
app.get("/analytics", (req, res) => {
  res.sendFile(path.join(__dirname, '/public/analytics.html'));
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
 * Added by @Edward
 *
 * Adds routes for the Me, Profile, Settings, and About pages.
 * These pages support the user profile/settings flow from the Me page.
 */

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/about.html"));
});
app.get("/me", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/me.html"));
});

app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/settings.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/profile.html"));
});


(async function start() {
  const url = process.env.MONGODB_URL || 'mongodb://localhost:27017/project_template';
  const skipMongo = String(process.env.SKIP_MONGODB || '').toLowerCase() === '1' || process.env.SKIP_MONGODB === 'true';

  if (skipMongo) {
    console.warn('SKIP_MONGODB set — server starting without database.');
  }
  else {
    try {
      await mongoose.connect(url);
      console.log('MongoDB connected');
    }
    catch (err) {
      console.warn('MongoDB unavailable:', err.message);
      console.warn('Server will still run (static files / routes that do not need DB).');
      console.warn('Fix MONGODB_URL or start MongoDB, then restart to connect.');
    }
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
})();
