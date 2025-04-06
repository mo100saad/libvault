# Community Bookshelf

![Logo](/public/images/logo.png)

## Overview
Community Bookshelf is a web application that allows users to create personal bookshelves, add books manually or via the Google Books API, rate and review books, and get personalized recommendations based on their reading history.

## Features
- **User Authentication System**
  - Secure login and registration
  - Role-based access (guest and admin permissions)
  - Password encryption with bcrypt

- **Personal Bookshelf Management**
  - Create and manage personal bookshelves
  - Add books from Google Books API
  - Manually add books with custom details
  - Rate and review books

- **Book Discovery**
  - Search books by title, author, or ISBN
  - Get personalized recommendations based on reading history
  - Browse trending and popular books

- **Admin Dashboard**
  - User management system
  - System statistics and analytics
  - Content moderation tools

## Technical Stack

### Backend
- **Node.js & Express.js** - Server-side application framework
- **SQLite** - Relational database for data persistence
- **express-session** - Session management
- **bcrypt** - Secure password hashing

### Frontend
- **Handlebars** - Templating engine
- **Vanilla JavaScript** - Client-side interactivity
- **CSS3** - Styling and responsive design

### APIs & Integrations
- **Google Books API** - External book information source

### Security
- **CSRF Protection** - Prevention of cross-site request forgery
- **Input Validation** - Client and server-side validation
- **Secure Cookies** - Cookie security implementation

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup
1. Clone the repository
   ```
   git clone https://github.com/yourusername/community-bookshelf.git
   cd community-bookshelf
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Initialize the database
   ```
   npm run init-db
   ```

4. Start the application
   ```
   npm start
   ```

5. Access the application
   ```
   http://localhost:3000
   ```

## Default Accounts
- **Admin:** username=admin, password=admin123
- **Guest:** username=guest, password=guest123

## API Reference

The application provides a RESTful API for accessing book data:

- `GET /api/books` - Retrieve all books
- `GET /api/books/:id` - Retrieve specific book
- `POST /api/books` - Add a new book
- `PUT /api/books/:id` - Update book information
- `DELETE /api/books/:id` - Remove a book

## License

This project is licensed under the Apache License - see the LICENSE file for details.

## Author

Developed by Mohammad Saad
