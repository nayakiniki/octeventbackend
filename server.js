const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const teamsRoutes = require('./routes/teams');
const ciphergameRoutes = require('./routes/ciphergame');
const submissionsRoutes = require('./routes/submissions');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/cipherquest', ciphergameRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'CipherQuest Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CipherQuest Hackathon Platform',
    endpoints: {
      auth: '/api/auth',
      teams: '/api/teams', 
      cipherquest: '/api/cipherquest',
      submissions: '/api/submissions',
      leaderboard: '/api/leaderboard'
    },
    documentation: '/api/docs'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('CipherQuest Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: 'Please try again later.'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Check the API documentation for available endpoints'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 CipherQuest Backend Server Running!
  📍 Port: ${PORT}
  🌐 Environment: ${process.env.NODE_ENV || 'development'}
  🕒 Started at: ${new Date().toISOString()}
  `);
});

module.exports = app;
