require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

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


app.get("/alert", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/alert.html"));
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
