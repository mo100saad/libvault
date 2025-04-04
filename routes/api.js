const express = require('express');
const axios = require('axios');
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

// Search for books using Google Books API
router.get('/search', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const { query } = req.query;
  
  if (!query) {
    return res.render('search', { 
      user: req.session.user
    });
  }
  
  // SECURITY: Limit query length to prevent abuse
  const limitedQuery = query.substring(0, 100);
  const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(limitedQuery)}&maxResults=10`;
  
  axios.get(searchUrl)
    .then(response => {
      // Handle case where no results are found
      if (!response.data.items || response.data.items.length === 0) {
        return res.render('search', { 
          user: req.session.user,
          query,
          error: 'No books found with that search term. Try a different search.'
        });
      }
      
      const books = response.data.items.map(item => {
        const book = {
          id: item.id,
          title: item.volumeInfo.title || 'Unknown Title',
          author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown Author',
          year: item.volumeInfo.publishedDate ? item.volumeInfo.publishedDate.substring(0, 4) : null,
          isbn: item.volumeInfo.industryIdentifiers ? 
            item.volumeInfo.industryIdentifiers[0].identifier : null,
          description: item.volumeInfo.description || 'No description available',
          coverUrl: item.volumeInfo.imageLinks ? 
            item.volumeInfo.imageLinks.thumbnail : null
        };
        return book;
      });
      
      res.render('search', { 
        user: req.session.user,
        query,
        books
      });
    })
    .catch(error => {
      console.error('API error:', error);
      res.render('search', { 
        user: req.session.user,
        query,
        error: 'Error searching for books. Please try again later.'
      });
    });
});

// Add book from API to shelf
router.post('/add-to-shelf', (req, res) => {
  const { 
    title, 
    author, 
    year, 
    isbn, 
    apiId, 
    coverUrl, 
    rating, 
    review 
  } = req.body;
  
  // FIX: Added proper session validation to prevent security issues
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).render('error', {
      title: 'Unauthorized',
      message: 'You must be logged in to add books to your bookshelf'
    });
  }
  
  // FIX: Basic validation for required fields
  if (!title || !author) {
    return res.status(400).render('error', {
      title: 'Invalid Book Data',
      message: 'Title and author are required',
      user: req.session.user
    });
  }
  
  // FIX: Validate rating if provided (ensure it's a proper value)
  if (rating && (isNaN(rating) || rating < 1 || rating > 5)) {
    return res.status(400).render('error', {
      title: 'Invalid Rating',
      message: 'Rating must be between 1 and 5',
      user: req.session.user
    });
  }
  
  const userId = req.session.user.id;
  const db = req.app.locals.db;
  
  // Sanitize inputs to prevent XSS
  const sanitizedTitle = sanitizeInput(title);
  const sanitizedAuthor = sanitizeInput(author);
  const sanitizedReview = sanitizeInput(review);
  
  // Check if book exists in our database
  db.get('SELECT * FROM books WHERE api_id = ? OR (title = ? AND author = ?)', 
    [apiId, sanitizedTitle, sanitizedAuthor], 
    (err, book) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).render('error', {
          title: 'Database Error',
          message: 'An error occurred when accessing the database',
          user: req.session.user
        });
      }
      
      if (book) {
        // Check if user already has this book
        db.get(
          'SELECT * FROM bookshelf_items WHERE user_id = ? AND book_id = ?',
          [userId, book.id],
          (err, item) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).render('error', {
                title: 'Database Error',
                message: 'An error occurred when checking your bookshelf',
                user: req.session.user
              });
            }
            
            if (item) {
              // Book already in user's bookshelf
              return res.render('search', {
                user: req.session.user,
                error: 'This book is already in your bookshelf'
              });
            }
            
            // Add to bookshelf
            db.run(
              'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
              [userId, book.id, rating || null, sanitizedReview || null],
              (err) => {
                if (err) {
                  console.error('Database error adding book to shelf:', err);
                  return res.status(500).render('error', {
                    title: 'Database Error',
                    message: 'An error occurred when adding the book to your shelf',
                    user: req.session.user
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
          'INSERT INTO books (title, author, year, isbn, cover_url, api_id) VALUES (?, ?, ?, ?, ?, ?)',
          [sanitizedTitle, sanitizedAuthor, year || null, isbn || null, coverUrl || null, apiId || null],
          function(err) {
            if (err) {
              console.error('Database error creating book:', err);
              return res.status(500).render('error', {
                title: 'Database Error',
                message: 'An error occurred when creating the book',
                user: req.session.user
              });
            }
            
            const bookId = this.lastID;
            
            // Add to bookshelf
            db.run(
              'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
              [userId, bookId, rating || null, sanitizedReview || null],
              (err) => {
                if (err) {
                  console.error('Database error adding book to shelf:', err);
                  return res.status(500).render('error', {
                    title: 'Database Error',
                    message: 'An error occurred when adding the book to your shelf',
                    user: req.session.user
                  });
                }
                
                res.redirect('/books/bookshelf');
              }
            );
          }
        );
      }
    }
  );
});

// Get book recommendations
router.get('/recommendations', (req, res) => {
  // FIX: Added session validation check
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/login');
  }
  
  const userId = req.session.user.id;
  const db = req.app.locals.db;
  
  // Get user's genres/authors based on their books
  // CLEANUP: Fixed SQL syntax for SQLite (NULLS LAST isn't supported)
  db.all(`
    SELECT DISTINCT b.author
    FROM books b
    JOIN bookshelf_items bi ON b.id = bi.book_id
    WHERE bi.user_id = ?
    ORDER BY CASE WHEN bi.rating IS NULL THEN 0 ELSE 1 END DESC, bi.rating DESC
    LIMIT 3
  `, [userId], (err, authors) => {
    if (err) {
      console.error('Database error:', err);
      return res.render('recommendations', { 
        user: req.session.user,
        error: 'Error generating recommendations'
      });
    }
    
    // Use favorite authors to get recommendations
    if (authors && authors.length > 0) {
      const authorQueries = authors.map(author => {
        if (author && author.author) {
          // SECURITY: Limit query length to prevent abuse
          const sanitizedAuthor = author.author.substring(0, 100);
          return axios.get(`https://www.googleapis.com/books/v1/volumes?q=inauthor:${encodeURIComponent(sanitizedAuthor)}&maxResults=3`)
            .catch(error => {
              console.error(`Error fetching author recommendations for ${author.author}:`, error);
              return { data: { items: [] } }; // Return empty result on error
            });
        } else {
          return Promise.resolve({ data: { items: [] } }); // Handle null author case
        }
      });
      
      Promise.all(authorQueries)
        .then(results => {
          let recommendations = [];
          
          results.forEach(response => {
            if (response.data && response.data.items) {
              const books = response.data.items.map(item => ({
                id: item.id,
                title: item.volumeInfo.title || 'Unknown Title',
                author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown Author',
                year: item.volumeInfo.publishedDate ? item.volumeInfo.publishedDate.substring(0, 4) : null,
                isbn: item.volumeInfo.industryIdentifiers ? 
                  item.volumeInfo.industryIdentifiers[0].identifier : null,
                description: item.volumeInfo.description || 'No description available',
                coverUrl: item.volumeInfo.imageLinks ? 
                  item.volumeInfo.imageLinks.thumbnail : null
              }));
              
              recommendations = [...recommendations, ...books];
            }
          });
          
          // Deduplicate by title
          recommendations = recommendations.filter((book, index, self) =>
            index === self.findIndex((b) => b.title === book.title)
          );
          
          res.render('recommendations', {
            user: req.session.user,
            recommendations
          });
        })
        .catch(error => {
          console.error('API error:', error);
          res.render('recommendations', { 
            user: req.session.user,
            error: 'Error fetching recommendations'
          });
        });
    } else {
      // If no authors found, get general popular books
      axios.get('https://www.googleapis.com/books/v1/volumes?q=subject:fiction&orderBy=relevance&maxResults=10')
        .then(response => {
          if (response.data && response.data.items) {
            const recommendations = response.data.items.map(item => ({
              id: item.id,
              title: item.volumeInfo.title || 'Unknown Title',
              author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown Author',
              year: item.volumeInfo.publishedDate ? item.volumeInfo.publishedDate.substring(0, 4) : null,
              isbn: item.volumeInfo.industryIdentifiers ? 
                item.volumeInfo.industryIdentifiers[0].identifier : null,
              description: item.volumeInfo.description || 'No description available',
              coverUrl: item.volumeInfo.imageLinks ? 
                item.volumeInfo.imageLinks.thumbnail : null
            }));
            
            res.render('recommendations', {
              user: req.session.user,
              recommendations
            });
          } else {
            res.render('recommendations', { 
              user: req.session.user,
              error: 'No recommendations available'
            });
          }
        })
        .catch(error => {
          console.error('API error:', error);
          res.render('recommendations', { 
            user: req.session.user,
            error: 'Error fetching recommendations'
          });
        });
    }
  });
});

module.exports = router;