const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Helper function to sanitize user inputs
// FIX: Added sanitization to prevent XSS attacks
function sanitizeInput(input) {
  if (!input) return null;
  // Basic sanitization - convert HTML special characters
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// FIX: Added password strength validation
function isPasswordStrong(password) {
  // Require at least 8 characters with at least one number and one letter
  const minLength = 8;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  
  return password.length >= minLength && hasNumber && hasLetter;
}

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/books/dashboard');
  }
  res.render('login');
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/books/dashboard');
  }
  res.render('register');
});

// Login process
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = req.app.locals.db;
  
  // FIX: Added input validation
  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required' });
  }
  
  // Sanitize input
  const sanitizedUsername = sanitizeInput(username);
  
  db.get('SELECT * FROM users WHERE username = ?', [sanitizedUsername], (err, user) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.render('login', { error: 'Database error occurred' });
    }
    
    if (!user) {
      return res.render('login', { error: 'Invalid username or password' });
    }
    
    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        console.error('Password comparison error:', err);
        return res.render('login', { error: 'Authentication error occurred' });
      }
      
      if (!result) {
        return res.render('login', { error: 'Invalid username or password' });
      }
      
      // FIX: Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.render('login', { error: 'Session error occurred' });
        }
        
        // Store user in session (excluding password)
        req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        };
        
        // FIX: Set absolute session timeout (24 hours)
        req.session.created = Date.now();
        
        // Determine redirect URL (keep original destination if it was saved)
        const redirectUrl = req.session.returnTo || '/books/dashboard';
        delete req.session.returnTo;
        
        res.redirect(redirectUrl);
      });
    });
  });
});

// Register process
router.post('/register', (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  const db = req.app.locals.db;
  
  // Basic validation
  if (!username || !email || !password) {
    return res.render('register', { 
      error: 'All fields are required', 
      username, 
      email 
    });
  }
  
  if (password !== confirmPassword) {
    return res.render('register', { 
      error: 'Passwords do not match', 
      username, 
      email 
    });
  }
  
  // FIX: Added password strength validation
  if (!isPasswordStrong(password)) {
    return res.render('register', { 
      error: 'Password must be at least 8 characters long and contain at least one letter and one number', 
      username, 
      email 
    });
  }
  
  // FIX: Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render('register', { 
      error: 'Please enter a valid email address', 
      username 
    });
  }
  
  // Sanitize inputs
  const sanitizedUsername = sanitizeInput(username);
  const sanitizedEmail = sanitizeInput(email);
  
  // Check if username or email already exists
  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?', 
    [sanitizedUsername, sanitizedEmail], 
    (err, user) => {
      if (err) {
        console.error('Database error during registration:', err);
        return res.render('register', { 
          error: 'Database error occurred', 
          username, 
          email 
        });
      }
      
      if (user) {
        return res.render('register', { 
          error: 'Username or email already exists', 
          username, 
          email 
        });
      }
      
      // Create new user with higher workfactor for password hashing
      bcrypt.hash(password, 12, (err, hash) => {
        if (err) {
          console.error('Password hashing error:', err);
          return res.render('register', { 
            error: 'Error creating account', 
            username, 
            email 
          });
        }
        
        db.run(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [sanitizedUsername, sanitizedEmail, hash, 'guest'],
          function(err) {
            if (err) {
              console.error('Database error during user creation:', err);
              return res.render('register', { 
                error: 'Error creating account', 
                username, 
                email 
              });
            }
            
            // FIX: Regenerate session to prevent session fixation
            req.session.regenerate((err) => {
              if (err) {
                console.error('Session regeneration error:', err);
                return res.render('register', { error: 'Session error occurred' });
              }
              
              // Auto login after registration
              req.session.user = {
                id: this.lastID,
                username: sanitizedUsername,
                email: sanitizedEmail,
                role: 'guest'
              };
              
              // FIX: Set absolute session timeout (24 hours)
              req.session.created = Date.now();
              
              res.redirect('/books/dashboard');
            });
          }
        );
      });
    }
  );
});

// Logout form page (GET)
router.get('/logout', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  // Display a logout confirmation page with CSRF token
  res.render('logout', {
    user: req.session.user
  });
});

// Actual logout process (POST with CSRF protection)
router.post('/logout', (req, res) => {
  // FIX: Save return URL before destroying session
  const returnUrl = '/login';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.redirect(returnUrl);
  });
});

module.exports = router;