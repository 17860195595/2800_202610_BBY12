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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//setup routes
const healthRouter = require('./routes/health');
app.use('/api/health', healthRouter);

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


app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/about.html"));
});


app.get("/alert", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/alert.html"));
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
