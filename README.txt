# Community Bookshelf - COMP 2406 Assignment 5 (Option B)

Affidavit Statement:
"I attest that I am the sole author of this submitted work and any code borrowed from other sources has been identified by comments placed in my submitted code.
Mohammad Saad, 101306472"

## Project Description
Community Bookshelf is a web application that allows users to create personal bookshelves, add books manually or via the Google Books API, rate and review books, and get personalized recommendations based on their reading history.

## Features
- User authentication system with guest and admin roles
- User registration and login functionality
- Book search via Google Books API
- Persistent user-generated content (bookshelves, ratings, reviews)
- Personalized book recommendations
- Admin dashboard with user management
- System statistics and analytics

## Technical Stack
- Node.js and Express.js for server-side processing
- SQLite for data persistence
- Handlebars for template rendering
- Client-side JavaScript for dynamic interactions
- Google Books API for book information

## Install Instructions
1. Ensure you have Node.js installed on your system (verify with `node -v`)
2. Navigate to the project directory and install dependencies:
   ```
   npm install
   ```
   This will install all required packages including:
   - Express and middleware (express-session, body-parser, cookie-parser)
   - Handlebars templating (express-handlebars)
   - Database (sqlite3)
   - Security (bcrypt, csurf)
   - HTTP client (axios)

## Launch Instructions
1. Start the server by running:
   ```
   npm start
   ```
   OR
   ```
   node server.js
   ```
2. The server will start and listen on port 3000.

## Testing Instructions
1. Initialize the database (if not already created) by running:
   ```
   npm run init-db
   ```
   OR
   ```
   node database/init-db.js
   ```
2. Open your web browser (Chrome recommended) and navigate to:
   ```
   http://localhost:3000
   ```
3. Log in with one of the default accounts:
   - Admin: username=admin, password=admin123
   - Guest: username=guest, password=guest123
   
   Or create your own account by clicking "Register"

## Assignment Requirements Satisfied
- R1.1: User authentication with guest and admin roles
- R1.2: New user registration
- R1.3: Admin dashboard to view current users
- R1.4: Integration with Google Books API
- R1.5: Single-page app functionality via client-side JavaScript
- R1.6: Template rendering with Handlebars
- R1.7: User content contribution via book reviews and ratings

Thank you TA for an amazing semester!

## YOUTUBE DEMONSTRATION:
