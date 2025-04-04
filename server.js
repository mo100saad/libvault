const express = require('express');
const { engine } = require('express-handlebars');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const http = require('http');

// Import route modules
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Connect to database with better error handling
let db;
try {
  // Check if database file exists, if not, run the initialization script
  const dbFilePath = path.join(__dirname, 'database/bookshelf.db');
  
  if (!fs.existsSync(dbFilePath)) {
    console.log('Database file not found, initializing new database...');
    // CLEANUP: Fixed incorrect module path
    require('./database/init-db');
  }
  
  // Connect to the database
  db = new sqlite3.Database(dbFilePath, (err) => {
    if (err) {
      console.error('Database connection error:', err.message);
    } else {
      console.log('Connected to the bookshelf database.');
    }
  });
  
  app.locals.db = db;
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Configure middleware with detailed options
app.use(bodyParser.urlencoded({ 
  extended: false,
  limit: '10mb'
}));
app.use(bodyParser.json({
  limit: '10mb'
}));
app.use(cookieParser());
// FIX: Don't use hardcoded secret in production
const sessionSecret = process.env.SESSION_SECRET || 'community-bookshelf-secret-dev-only';
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn('WARNING: Using default session secret in production. Set SESSION_SECRET env variable.');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 3600000, // 1 hour
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    sameSite: 'lax' // FIX: Added SameSite attribute to prevent CSRF
  }
}));

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Set up handlebars with all the helpers
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    // Equal comparison helper
    eq: function (a, b) {
      return a === b;
    },
    // Not equal comparison helper
    neq: function (a, b) {
      return a !== b;
    },
    // Greater than helper
    gt: function (a, b) {
      return a > b;
    },
    // Less than helper
    lt: function (a, b) {
      return a < b;
    },
    // Iterate from start to end with increment
    for: function(from, to, incr, block) {
      let accum = '';
      for(let i = from; i <= to; i += incr)
        accum += block.fn(i);
      return accum;
    },
    // Format date helper
    formatDate: function(date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString();
    },
    // Format time helper
    formatTime: function(date) {
      if (!date) return '';
      return new Date(date).toLocaleTimeString();
    },
    // Truncate text helper
    truncate: function(text, length) {
      if (text === null || text === undefined) return '';
      // Convert to string to ensure substring works for numbers
      const textStr = String(text);
      if (textStr.length <= length) return textStr;
      return textStr.substring(0, length) + '...';
    },
    // JSON stringify helper
    json: function(context) {
      return JSON.stringify(context);
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d' // Cache static assets for 1 day for better performance
}));

// FIX: Add security headers
app.use((req, res, next) => {
  // Helps prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Helps prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// FIX: Session expiration check middleware
app.use((req, res, next) => {
  if (req.session && req.session.created) {
    // Check if session has expired (24 hours)
    const sessionAge = Date.now() - req.session.created;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (sessionAge > maxAge) {
      // Session has expired, destroy it
      return req.session.destroy(() => {
        res.redirect('/login');
      });
    }
  }
  next();
});

// Custom session logging middleware
app.use((req, res, next) => {
  if (req.session.user) {
    console.log(`User ${req.session.user.username} accessed: ${req.path}`);
  }
  next();
});

// Authentication middleware
const authMiddleware = (req, res, next) => {
  if (req.session.user) {
    // Add user to all rendered views
    res.locals.user = req.session.user;
    next();
  } else {
    // Remember the requested URL for redirect after login
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  }
};

// Admin middleware with detailed error
const adminMiddleware = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).render('error', { 
      title: 'Access Denied',
      message: 'You need administrator privileges to access this page.',
      user: req.session.user
    });
  }
};

// Apply routes with additional options
app.use('/', authRoutes);
app.use('/books', authMiddleware, bookRoutes);
app.use('/api', authMiddleware, apiRoutes);
app.use('/admin', authMiddleware, adminMiddleware, adminRoutes);

// Home route with redirection
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/books/dashboard');
  } else {
    res.redirect('/login');
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you requested does not exist.',
    user: req.session.user
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Handle CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF token validation failed');
    return res.status(403).render('error', {
      title: 'Security Error',
      message: 'Form submission failed due to security validation. Please try again.',
      user: req.session.user
    });
  }
  
  console.error('Application error:', err);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'An unexpected error occurred. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err : {},
    user: req.session.user
  });
});

// Create HTTP server
const server = http.createServer(app);

// Start server with more detailed logging
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Community Bookshelf Server`);
  console.log(`COMP 2406 Assignment 5 (Option B)`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Default credentials:`);
  console.log(`  Admin: admin / admin123`);
  console.log(`  Guest: guest / guest123`);
  console.log(`Initialize database (if needed): npm run init-db`);
  console.log(`Press Ctrl+C to stop`);
  console.log(`========================================`);
});

// Handle graceful shutdown - prevent multiple listeners
process.removeAllListeners('SIGINT');
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  
  // Prevent multiple close handlers
  server.removeAllListeners('close');
  
  server.close(() => {
    console.log('HTTP server closed.');
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed.');
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Attempt graceful shutdown
  if (server) server.close();
  if (db) db.close();
  process.exit(1);
});