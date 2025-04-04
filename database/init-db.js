const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Create a new database
const db = new sqlite3.Database(path.join(__dirname, 'bookshelf.db'));

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'guest',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Books table
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER,
      isbn TEXT,
      cover_url TEXT,
      api_id TEXT
    )
  `);

  // User bookshelf items
  db.run(`
    CREATE TABLE IF NOT EXISTS bookshelf_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      rating INTEGER,
      review TEXT,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (book_id) REFERENCES books (id)
    )
  `);

  // Create an admin user
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(
    'INSERT OR IGNORE INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
    ['admin', adminPassword, 'admin@bookshelf.com', 'admin'],
    function(err) {
      if (err) {
        console.error('Error creating admin user:', err.message);
      } else {
        console.log('Admin user created successfully');
      }
      
      // Create a guest user after admin creation completes
      createGuestUser();
    }
  );
});

function createGuestUser() {
  const guestPassword = bcrypt.hashSync('guest123', 10);
  db.run(
    'INSERT OR IGNORE INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
    ['guest', guestPassword, 'guest@bookshelf.com', 'guest'],
    function(err) {
      if (err) {
        console.error('Error creating guest user:', err.message);
        closeDatabase();
      } else {
        console.log('Guest user created successfully');
        addSampleBook();
      }
    }
  );
}

function addSampleBook() {
  db.run(
    'INSERT OR IGNORE INTO books (title, author, year, isbn) VALUES (?, ?, ?, ?)',
    ['The Great Gatsby', 'F. Scott Fitzgerald', 1925, '9780743273565'],
    function(err) {
      if (err) {
        console.error('Error creating sample book:', err.message);
        closeDatabase();
      } else {
        const bookId = this.lastID;
        // Find the guest user ID
        db.get('SELECT id FROM users WHERE username = ?', ['guest'], (err, user) => {
          if (err || !user) {
            console.error('Error finding guest user:', err ? err.message : 'User not found');
            closeDatabase();
          } else {
            // Add book to guest's bookshelf
            db.run(
              'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
              [user.id, bookId, 4, 'A classic that captures the essence of the Jazz Age.'],
              (err) => {
                if (err) {
                  console.error('Error adding book to guest bookshelf:', err.message);
                } else {
                  console.log('Sample book added to guest bookshelf');
                }
                
                // Add a second sample book
                addSecondSampleBook(user.id);
              }
            );
          }
        });
      }
    }
  );
}

function addSecondSampleBook(guestId) {
  db.run(
    'INSERT OR IGNORE INTO books (title, author, year, isbn) VALUES (?, ?, ?, ?)',
    ['To Kill a Mockingbird', 'Harper Lee', 1960, '9780061120084'],
    function(err) {
      if (err) {
        console.error('Error creating second sample book:', err.message);
      } else {
        const bookId = this.lastID;
        // Add book to guest's bookshelf
        db.run(
          'INSERT INTO bookshelf_items (user_id, book_id, rating, review) VALUES (?, ?, ?, ?)',
          [guestId, bookId, 5, 'A powerful exploration of racial injustice and moral growth.'],
          (err) => {
            if (err) {
              console.error('Error adding second book to guest bookshelf:', err.message);
            } else {
              console.log('Second sample book added to guest bookshelf');
            }
            
            // Close the database after all operations are complete
            closeDatabase();
          }
        );
      }
    }
  );
}

function closeDatabase() {
  console.log('Database initialized successfully');
  db.close();
}