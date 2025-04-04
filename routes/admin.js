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

// Admin dashboard
router.get('/dashboard', (req, res) => {
  // FIX: Added session and role validation
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You must be an administrator to access this page',
      user: req.session.user
    });
  }
  
  const db = req.app.locals.db;
  
  // Get all users
  db.all('SELECT id, username, email, role, created_at FROM users', [], (err, users) => {
    if (err) {
      console.error('Database error:', err);
      return res.render('admin', { 
        user: req.session.user,
        error: 'Error loading users'
      });
    }
    
    // Get total book count
    db.get('SELECT COUNT(*) as count FROM books', [], (err, bookCount) => {
      if (err) {
        console.error('Database error:', err);
        return res.render('admin', { 
          user: req.session.user,
          users,
          error: 'Error loading book count'
        });
      }
      
      // Get total reviews count
      db.get(`
        SELECT COUNT(*) as count 
        FROM bookshelf_items 
        WHERE review IS NOT NULL AND review != ''
      `, [], (err, reviewCount) => {
        if (err) {
          console.error('Database error:', err);
          return res.render('admin', { 
            user: req.session.user,
            users,
            bookCount: bookCount.count,
            error: 'Error loading review count'
          });
        }
        
        res.render('admin', { 
          user: req.session.user,
          users,
          bookCount: bookCount.count,
          reviewCount: reviewCount.count
        });
      });
    });
  });
});

// View user details - Fixed to have only one route handler
router.get('/user/:id', (req, res) => {
  // FIX: Added session and role validation
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You must be an administrator to access this page',
      user: req.session.user
    });
  }
  
  const userId = req.params.id;
  const db = req.app.locals.db;
  
  // FIX: Added validation for userId
  if (!userId || isNaN(parseInt(userId))) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Invalid user ID',
      user: req.session.user
    });
  }
  
  db.get('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error fetching user:', err.message);
      return res.status(500).render('error', {
        title: 'Database Error',
        message: 'An error occurred while fetching user data',
        user: req.session.user
      });
    }
    
    if (!user) {
      return res.status(404).render('error', {
        title: 'User Not Found',
        message: 'The requested user does not exist',
        user: req.session.user
      });
    }
    
    // Query to handle cases where a user might not have any books
    db.all(`
      SELECT b.*, bi.rating, bi.review, bi.date_added
      FROM bookshelf_items bi
      LEFT JOIN books b ON b.id = bi.book_id
      WHERE bi.user_id = ?
      ORDER BY bi.date_added DESC
    `, [userId], (err, books) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.render('adminUserView', { 
          user: req.session.user,
          viewUser: user,
          error: 'Error loading user books',
          books: [] 
        });
      }
      
      // Get user statistics
      db.get('SELECT COUNT(*) as bookCount FROM bookshelf_items WHERE user_id = ?', [userId], (err, stats) => {
        if (err) {
          console.error('Error getting user stats:', err.message);
        }
        
        // Get average user rating
        db.get('SELECT AVG(rating) as avgRating FROM bookshelf_items WHERE user_id = ? AND rating IS NOT NULL', [userId], (err, ratingStats) => {
          const avgRating = ratingStats && ratingStats.avgRating ? parseFloat(ratingStats.avgRating).toFixed(1) : 'N/A';
          
          res.render('adminUserView', { 
            user: req.session.user,
            viewUser: user,
            books: books || [],
            stats: {
              bookCount: stats ? stats.bookCount : 0,
              avgRating: avgRating
            }
          });
        });
      });
    });
  });
});

// Add books to user's bookshelf from admin panel
router.get('/user/:id/add-book', (req, res) => {
  // FIX: Added session and role validation
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You must be an administrator to access this page',
      user: req.session.user
    });
  }
  
  const userId = req.params.id;
  const db = req.app.locals.db;
  
  // FIX: Added validation for userId
  if (!userId || isNaN(parseInt(userId))) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Invalid user ID',
      user: req.session.user
    });
  }
  
  db.get('SELECT id, username FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', {
        title: 'Database Error',
        message: 'An error occurred while fetching user data',
        user: req.session.user
      });
    }
    
    if (!user) {
      return res.status(404).render('error', {
        title: 'User Not Found',
        message: 'The requested user does not exist',
        user: req.session.user
      });
    }
    
    res.render('adminAddBook', {
      user: req.session.user,
      viewUser: user
    });
  });
});

// Process adding a book to user's bookshelf
router.post('/user/:id/add-book', (req, res) => {
  // FIX: Added session and role validation
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You must be an administrator to access this page',
      user: req.session.user
    });
  }
  
  const userId = req.params.id;
  const { title, author, year, isbn, rating, review } = req.body;
  const db = req.app.locals.db;
  
  // FIX: Added validation for userId
  if (!userId || isNaN(parseInt(userId))) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Invalid user ID',
      user: req.session.user
    });
  }
  
  // FIX: Basic validation for required fields
  if (!title || !author) {
    return res.render('adminAddBook', {
      user: req.session.user,
      viewUser: { id: userId },
      error: 'Title and author are required',
      book: req.body
    });
  }
  
  // FIX: Validate rating if provided
  if (rating && (isNaN(rating) || rating < 1 || rating > 5)) {
    return res.render('adminAddBook', {
      user: req.session.user,
      viewUser: { id: userId },
      error: 'Rating must be between 1 and 5',
      book: req.body
    });
  }
  
  // FIX: Validate year if provided
  if (year && (isNaN(year) || year < 1000 || year > 2025)) {
    return res.render('adminAddBook', {
      user: req.session.user,
      viewUser: { id: userId },
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
      return res.status(500).render('error', {
        title: 'Database Error',
        message: 'An error occurred when accessing the database',
        user: req.session.user
      });
    }
    
    if (book) {
      // Book exists, add to user's bookshelf
      db.run(
        'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
        [userId, book.id, rating || null, sanitizedReview || null],
        (err) => {
          if (err) {
            console.error('Error adding book to user:', err);
            return res.status(500).render('error', {
              title: 'Database Error',
              message: 'An error occurred when adding the book to bookshelf',
              user: req.session.user
            });
          }
          res.redirect(`/admin/user/${userId}`);
        }
      );
    } else {
      // Create new book
      db.run(
        'INSERT INTO books (title, author, year, isbn) VALUES (?, ?, ?, ?)',
        [sanitizedTitle, sanitizedAuthor, year || null, isbn || null],
        function(err) {
          if (err) {
            console.error('Error creating book:', err);
            return res.status(500).render('error', {
              title: 'Database Error',
              message: 'An error occurred when creating the book',
              user: req.session.user
            });
          }
          
          const bookId = this.lastID;
          
          // Add to user's bookshelf
          db.run(
            'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
            [userId, bookId, rating || null, sanitizedReview || null],
            (err) => {
              if (err) {
                console.error('Error adding book to user:', err);
                return res.status(500).render('error', {
                  title: 'Database Error',
                  message: 'An error occurred when adding the book to bookshelf',
                  user: req.session.user
                });
              }
              res.redirect(`/admin/user/${userId}`);
            }
          );
        }
      );
    }
  });
});

// Show system statistics
router.get('/stats', (req, res) => {
  // FIX: Added session and role validation
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You must be an administrator to access this page',
      user: req.session.user
    });
  }
  
  const db = req.app.locals.db;
  
  // Get most popular books
  db.all(`
    SELECT b.title, b.author, COUNT(bi.id) as reader_count, AVG(bi.rating) as avg_rating
    FROM books b
    JOIN bookshelf_items bi ON b.id = bi.book_id
    GROUP BY b.id
    ORDER BY reader_count DESC, avg_rating DESC
    LIMIT 10
  `, [], (err, popularBooks) => {
    if (err) {
      console.error('Error getting popular books:', err);
      return res.status(500).render('error', {
        title: 'Database Error',
        message: 'An error occurred when getting popular books',
        user: req.session.user
      });
    }
    
    // Get top rated books
    db.all(`
      SELECT b.title, b.author, AVG(bi.rating) as avg_rating, COUNT(bi.id) as rating_count
      FROM books b
      JOIN bookshelf_items bi ON b.id = bi.book_id
      WHERE bi.rating IS NOT NULL
      GROUP BY b.id
      HAVING rating_count >= 1
      ORDER BY avg_rating DESC, rating_count DESC
      LIMIT 10
    `, [], (err, topRatedBooks) => {
      if (err) {
        console.error('Error getting top rated books:', err);
        return res.status(500).render('error', {
          title: 'Database Error',
          message: 'An error occurred when getting top rated books',
          user: req.session.user
        });
      }
      
      // Get most active users
      db.all(`
        SELECT u.username, COUNT(bi.id) as book_count
        FROM users u
        JOIN bookshelf_items bi ON u.id = bi.user_id
        GROUP BY u.id
        ORDER BY book_count DESC
        LIMIT 10
      `, [], (err, activeUsers) => {
        if (err) {
          console.error('Error getting active users:', err);
          return res.status(500).render('error', {
            title: 'Database Error',
            message: 'An error occurred when getting active users',
            user: req.session.user
          });
        }
        
        res.render('adminStats', {
          user: req.session.user,
          popularBooks: popularBooks || [],
          topRatedBooks: topRatedBooks || [],
          activeUsers: activeUsers || []
        });
      });
    });
  });
});

// Toggle user role (admin/guest)
router.post('/user/:id/toggle-role', (req, res) => {
  // FIX: Added session and role validation
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You must be an administrator to access this page',
      user: req.session.user
    });
  }
  
  const userId = req.params.id;
  const db = req.app.locals.db;
  
  // FIX: Added validation for userId
  if (!userId || isNaN(parseInt(userId))) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Invalid user ID',
      user: req.session.user
    });
  }
  
  // Don't allow changing own role - convert to Number to ensure correct comparison
  if (parseInt(userId) === parseInt(req.session.user.id)) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'You cannot change your own role',
      user: req.session.user
    });
  }
  
  db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', {
        title: 'Database Error',
        message: 'An error occurred when accessing the database',
        user: req.session.user
      });
    }
    
    if (!user) {
      return res.status(404).render('error', {
        title: 'User Not Found',
        message: 'The requested user does not exist',
        user: req.session.user
      });
    }
    
    const newRole = user.role === 'admin' ? 'guest' : 'admin';
    
    db.run('UPDATE users SET role = ? WHERE id = ?', [newRole, userId], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).render('error', {
          title: 'Database Error',
          message: 'An error occurred when updating user role',
          user: req.session.user
        });
      }
      
      res.redirect('/admin/dashboard');
    });
  });
});

// Delete user
router.post('/user/:id/delete', (req, res) => {
  // FIX: Added session and role validation
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You must be an administrator to access this page',
      user: req.session.user
    });
  }
  
  const userId = req.params.id;
  const db = req.app.locals.db;
  
  // FIX: Added validation for userId
  if (!userId || isNaN(parseInt(userId))) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'Invalid user ID',
      user: req.session.user
    });
  }
  
  // Don't allow deleting self - convert to Number to ensure correct comparison
  if (parseInt(userId) === parseInt(req.session.user.id)) {
    return res.status(400).render('error', {
      title: 'Invalid Request',
      message: 'You cannot delete your own account',
      user: req.session.user
    });
  }
  
  db.run('DELETE FROM bookshelf_items WHERE user_id = ?', [userId], (err) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', {
        title: 'Database Error',
        message: 'An error occurred when deleting user books',
        user: req.session.user
      });
    }
    
    db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).render('error', {
          title: 'Database Error',
          message: 'An error occurred when deleting user account',
          user: req.session.user
        });
      }
      
      res.redirect('/admin/dashboard');
    });
  });
});

module.exports = router;