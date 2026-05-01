require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const healthRouter = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/health', healthRouter);

(async function start() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/project_template';
  const skipMongo = String(process.env.SKIP_MONGODB || '').toLowerCase() === '1' || process.env.SKIP_MONGODB === 'true';

  if (skipMongo) {
    console.warn('SKIP_MONGODB set — server starting without database.');
  } else {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB connected');
    } catch (err) {
      console.warn('MongoDB unavailable:', err.message);
      console.warn('Server will still run (static files / routes that do not need DB).');
      console.warn('Fix MONGODB_URI or start MongoDB, then restart to connect.');
    }
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
})();
