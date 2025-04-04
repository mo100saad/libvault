const express = require('express');
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

// User dashboard
router.get('/dashboard', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const db = req.app.locals.db;
  const userId = req.session.user.id;
  
  // Get user's most recent books
  db.all(`
    SELECT b.*, bi.rating, bi.review, bi.date_added
    FROM books b
    JOIN bookshelf_items bi ON b.id = bi.book_id
    WHERE bi.user_id = ?
    ORDER BY bi.date_added DESC
    LIMIT 5
  `, [userId], (err, recentBooks) => {
    if (err) {
      console.error('Database error:', err);
      return res.render('dashboard', { 
        user: req.session.user,
        error: 'Error loading recent books'
      });
    }
    
    // Get highest rated books
    db.all(`
      SELECT b.*, bi.rating, bi.review
      FROM books b
      JOIN bookshelf_items bi ON b.id = bi.book_id
      WHERE bi.user_id = ? AND bi.rating IS NOT NULL
      ORDER BY bi.rating DESC
      LIMIT 5
    `, [userId], (err, topRatedBooks) => {
      if (err) {
        console.error('Database error:', err);
        return res.render('dashboard', { 
          user: req.session.user,
          recentBooks,
          error: 'Error loading top rated books'
        });
      }
      
      res.render('dashboard', { 
        user: req.session.user,
        recentBooks,
        topRatedBooks
      });
    });
  });
});

// User's bookshelf
router.get('/bookshelf', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const db = req.app.locals.db;
  const userId = req.session.user.id;
  
  db.all(`
    SELECT b.*, bi.rating, bi.review, bi.date_added
    FROM books b
    JOIN bookshelf_items bi ON b.id = bi.book_id
    WHERE bi.user_id = ?
    ORDER BY bi.date_added DESC
  `, [userId], (err, books) => {
    if (err) {
      console.error('Database error:', err);
      return res.render('bookshelf', { 
        user: req.session.user,
        error: 'Error loading bookshelf'
      });
    }
    
    res.render('bookshelf', { 
      user: req.session.user,
      books
    });
  });
});

// Add book form
router.get('/add', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  res.render('addBook', { user: req.session.user });
});

// Add book to shelf
router.post('/add', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const { title, author, year, isbn, rating, review } = req.body;
  const userId = req.session.user.id;
  const db = req.app.locals.db;
  
  // FIX: Basic validation for required fields
  if (!title || !author) {
    return res.render('addBook', {
      user: req.session.user,
      error: 'Title and author are required',
      book: req.body
    });
  }
  
  // FIX: Validate rating if provided
  if (rating && (isNaN(rating) || rating < 1 || rating > 5)) {
    return res.render('addBook', {
      user: req.session.user,
      error: 'Rating must be between 1 and 5',
      book: req.body
    });
  }
  
  // FIX: Validate year if provided
  if (year && (isNaN(year) || year < 1000 || year > 2025)) {
    return res.render('addBook', {
      user: req.session.user,
      error: 'Year must be a valid year between 1000 and 2025',
      book: req.body
    });
  }
  
  // Sanitize inputs to prevent XSS
  const sanitizedTitle = sanitizeInput(title);
  const sanitizedAuthor = sanitizeInput(author);
  const sanitizedReview = sanitizeInput(review);
  
  // Check if book already exists
  db.get('SELECT * FROM books WHERE title = ? AND author = ?', [sanitizedTitle, sanitizedAuthor], (err, book) => {
    if (err) {
      console.error('Database error:', err);
      return res.render('addBook', { 
        user: req.session.user,
        error: 'Database error occurred',
        book: req.body
      });
    }
    
    // If book exists, add to user's bookshelf
    if (book) {
      // Check if user already has this book
      db.get(
        'SELECT * FROM bookshelf_items WHERE user_id = ? AND book_id = ?',
        [userId, book.id],
        (err, item) => {
          if (err) {
            console.error('Database error:', err);
            return res.render('addBook', { 
              user: req.session.user,
              error: 'Database error occurred',
              book: req.body
            });
          }
          
          if (item) {
            return res.render('addBook', { 
              user: req.session.user,
              error: 'This book is already in your bookshelf',
              book: req.body
            });
          }
          
          // Add to bookshelf
          db.run(
            'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
            [userId, book.id, rating || null, sanitizedReview || null],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.render('addBook', { 
                  user: req.session.user,
                  error: 'Error adding book to bookshelf',
                  book: req.body
                });
              }
              
              res.redirect('/books/bookshelf');
            }
          );
        }
      );
    } else {
      // Create new book and add to user's bookshelf
      db.run(
        'INSERT INTO books (title, author, year, isbn) VALUES (?, ?, ?, ?)',
        [sanitizedTitle, sanitizedAuthor, year || null, isbn || null],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.render('addBook', { 
              user: req.session.user,
              error: 'Error creating book',
              book: req.body
            });
          }
          
          const bookId = this.lastID;
          
          // Add to bookshelf
          db.run(
            'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
            [userId, bookId, rating || null, sanitizedReview || null],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.render('addBook', { 
                  user: req.session.user,
                  error: 'Error adding book to bookshelf',
                  book: req.body
                });
              }
              
              res.redirect('/books/bookshelf');
            }
          );
        }
      );
    }
  });
});

// View/edit book
router.get('/edit/:id', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const bookId = req.params.id;
  const userId = req.session.user.id;
  const db = req.app.locals.db;
  
  // FIX: Added validation for bookId
  if (!bookId) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Book ID is required',
      user: req.session.user
    });
  }
  
  db.get(`
    SELECT b.*, bi.rating, bi.review
    FROM books b
    JOIN bookshelf_items bi ON b.id = bi.book_id
    WHERE b.id = ? AND bi.user_id = ?
  `, [bookId, userId], (err, book) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', {
        title: 'Database Error',
        message: 'An error occurred while retrieving the book',
        user: req.session.user
      });
    }
    
    if (!book) {
      return res.status(404).render('error', {
        title: 'Book Not Found',
        message: 'The requested book was not found in your bookshelf',
        user: req.session.user
      });
    }
    
    res.render('editBook', { 
      user: req.session.user,
      book
    });
  });
});

// Update book
router.post('/edit/:id', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const bookId = req.params.id;
  const userId = req.session.user.id;
  const { rating, review } = req.body;
  const db = req.app.locals.db;
  
  // FIX: Added validation for bookId
  if (!bookId) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Book ID is required',
      user: req.session.user
    });
  }
  
  // FIX: Validate rating if provided
  if (rating && (isNaN(rating) || rating < 1 || rating > 5)) {
    return res.render('editBook', { 
      user: req.session.user,
      book: { id: bookId, ...req.body },
      error: 'Rating must be between 1 and 5'
    });
  }
  
  // Sanitize review to prevent XSS
  const sanitizedReview = sanitizeInput(review);
  
  db.run(
    'UPDATE bookshelf_items SET rating = ?, review = ? WHERE book_id = ? AND user_id = ?',
    [rating || null, sanitizedReview || null, bookId, userId],
    (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.render('editBook', { 
          user: req.session.user,
          book: { id: bookId, ...req.body },
          error: 'Error updating book'
        });
      }
      
      res.redirect('/books/bookshelf');
    }
  );
});

// Remove book from shelf
router.post('/remove/:id', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const bookId = req.params.id;
  const userId = req.session.user.id;
  const db = req.app.locals.db;
  
  // FIX: Added validation for bookId
  if (!bookId) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Book ID is required',
      user: req.session.user
    });
  }
  
  db.run(
    'DELETE FROM bookshelf_items WHERE book_id = ? AND user_id = ?',
    [bookId, userId],
    (err) => {
      if (err) {
        console.error('Database error:', err);
        // FIX: Added proper error handling
        return res.status(500).render('error', {
          title: 'Error',
          message: 'An error occurred while removing the book',
          user: req.session.user
        });
      }
      
      res.redirect('/books/bookshelf');
    }
  );
});

// View another user's bookshelf
router.get('/user/:username', (req, res) => {
  const username = req.params.username;
  const db = req.app.locals.db;
  
  db.get('SELECT id, username, email FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(404).render('error', {
        title: 'User Not Found',
        message: 'The requested user profile does not exist.',
        user: req.session.user
      });
    }
    
    db.all(`
      SELECT b.*, bi.rating, bi.review, bi.date_added
      FROM books b
      JOIN bookshelf_items bi ON b.id = bi.book_id
      WHERE bi.user_id = ?
      ORDER BY bi.date_added DESC
    `, [user.id], (err, books) => {
      if (err) {
        console.error('Database error:', err);
        return res.redirect('/books/dashboard');
      }
      
      res.render('userBookshelf', { 
        user: req.session.user,
        viewUser: user,
        books
      });
    });
  });
});

module.exports = router;