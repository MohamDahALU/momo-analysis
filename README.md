# MoMo App - Mobile Money Transaction Viewer

A simple web application for viewing and analyzing Mobile Money transactions. This application allows you to track, filter, and manage your mobile money transaction history through an easy-to-use interface.

## Features

- View all mobile money transactions
- Filter transactions by date range
- RESTful API for transaction data
- Responsive web interface

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/MohamDahALU/momo-analysis.git
   cd momo-analysis
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Make sure you have a SQLite database file named `momo_transactions.db` in the project root with a `transactions` table containing your transaction data.

## Usage

1. Start the server:
   ```
   npm start
   ```

2. Access the application in your browser at:
   ```
   http://localhost:5000/momo-app
   ```

## Video Demonstration

Watch a demonstration of the MoMo App in action:
[View Demo on YouTube](https://youtu.be/sOwnRSPsEhw) 

## Database Schema

The application expects a SQLite database with a table structure similar to:

```sql
CREATE TABLE transactions (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   transaction_type TEXT,
   date TEXT,
   amount REAL,
   recipient TEXT,
   sender TEXT,
   balance REAL,
   transaction_id TEXT,
   fee REAL,
   raw_message TEXT
);
```

## API Endpoints

### GET /momo-app/api/transactions

Retrieve transaction data with optional date filtering.

**Query Parameters:**
- `from` (optional): Start date for filtering (format: YYYY-MM-DD)
- `to` (optional): End date for filtering (format: YYYY-MM-DD)

**Example Request:**
```
GET /momo-app/api/transactions?from=2023-01-01&to=2023-12-31
```

**Response:** JSON array of transaction objects.

## Technologies Used

- Backend: Node.js, Express
- Database: SQLite3
- Frontend: Pure HTML, CSS, JavaScript (served from the `/public` directory)

## Dependencies

- express: Fast, simple web framework for Node.js
- sqlite3: SQLite database driver for Node.js
- xml2js: XML to JavaScript object converter

## Development

Feel free to contribute to this project by submitting pull requests or opening issues for any bugs or feature requests.

## License

This project is licensed under the MIT License - see below for details:


## Credits

- **Mohamed Dahab** - *Development and maintenance*
- **Claude** - *Assisted in code direction, documentation and small help with UI at the beginning*
- **African Leadership University** - *Project support and resources*
