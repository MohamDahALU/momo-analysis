const fs = require('fs');
const xml2js = require('xml2js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the XML file
const xmlFilePath = path.join(__dirname, 'modified_sms_v2.xml');

// Path to the SQLite database
const dbPath = path.join(__dirname, 'momo_transactions.db');

// Path to the invalid transactions log file
const invalidLogPath = path.join(__dirname, 'invalid_transactions.log');

// Connect to SQLite database (creates it if it doesn't exist)
const db = new sqlite3.Database(dbPath);

// Read the XML file
fs.readFile(xmlFilePath, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading XML file:', err);
    return;
  }

  // Parse the XML data
  const parser = new xml2js.Parser({ explicitArray: false });
  parser.parseString(data, (err, result) => {
    if (err) {
      console.error('Error parsing XML:', err);
      return;
    }

    // Initialize the database
    initializeDatabase(() => {
      // Process the SMS messages
      processSmsMessages(result.smses.sms);
    });
  });
});

// Initialize the database schema
function initializeDatabase(callback) {
  console.log('Initializing database...');

  // Create transactions table
  db.serialize(() => {
    // Drop tables if they exist
    db.run('DROP TABLE IF EXISTS transactions');

    // Create transactions table
    db.run(`CREATE TABLE transactions (
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
    )`, (err) => {
      if (err) {
        console.error('Error creating tables:', err);
        return;
      }
      console.log('Database initialized successfully.');
      callback();
    });
  });
}

// Process SMS messages
function processSmsMessages(messages) {
  console.log(`Processing ${messages.length} SMS messages...`);

  // Create a transaction statement for better performance
  const stmt = db.prepare(`
    INSERT INTO transactions 
    (transaction_type, date, amount, recipient, sender, balance, transaction_id, fee, raw_message) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let processedCount = 0;
  let invalidMessages = [];

  // Process each message
  messages.forEach(sms => {
    const body = sms.$.body;
    const date = new Date(parseInt(sms.$.date)).toISOString();
    const transaction = categorizeTransaction(body);
    
    if (transaction) {
      stmt.run(
        transaction.type,
        date,
        transaction.amount || null,
        transaction.recipient || null,
        transaction.sender || null,
        transaction.balance || null,
        transaction.transactionId || null,
        transaction.fee || null,
        body
      );
      processedCount++;
    } else {
      // Log invalid transactions
      invalidMessages.push({
        date: date,
        body: body
      });
    }
  });

  // Finalize the statement and close the database
  stmt.finalize();
  console.log(`Finished processing ${processedCount} valid messages out of ${messages.length} total messages.`);
  
  // Log invalid messages to file
  if (invalidMessages.length > 0) {
    logInvalidTransactions(invalidMessages);
    console.log(`Found ${invalidMessages.length} invalid messages, logged to ${invalidLogPath}`);
  }

}

// Function to log invalid transactions to a file - simplified version
function logInvalidTransactions(invalidMessages) {
  // Create simple log entries with date and message content
  const logEntries = invalidMessages.map(msg => 
    `${msg.date}: ${msg.body}`
  ).join('\n\n');
  
  // Write to the log file
  fs.writeFileSync(invalidLogPath, logEntries, 'utf8');
}

// Categorize SMS message into transaction type and extract relevant information
function categorizeTransaction(message) {
  // Default transaction
  let transaction = {
    type: 'Unknown',
    amount: extractAmount(message),
    balance: extractBalance(message),
    transactionId: extractTransactionId(message),
    fee: extractFee(message),
  };

  // Check for Incoming Money (Money Received)
  if (message.includes('You have received') && message.includes('RWF') && message.includes('on your mobile money account')) {
    transaction.type = 'Incoming Money';
    transaction.sender = extractSender(message);
    return transaction;
  }

  // Check for Internet and Voice Bundle Purchases
  // There are occurences of sms in kinyarwanda like:
  //              Yello!Umaze kugura 500FRW(800MB) igura 500 RWF
  // It is always accompanied by a Bundles and Packs sms with the same amount,
  // so I'm not counting them. 
  if ((
    message.includes('Data Bundle')
    || (
      message.includes("Bundles and Packs")
      && message.includes("completed")
    )
  )) {
    /*|| message.includes('igura') */
    transaction.type = 'Internet Bundle';
    return transaction;
  }

  // Check for Airtime Bill Payments
  if (message.includes('Your payment of') && message.includes('to Airtime with token')) {
    transaction.type = 'Airtime Purchase';
    return transaction;
  }

  // Check for Cash Power Bill Payments
  if (message.includes('Your payment of') && message.includes('to MTN Cash Power with token')) {
    transaction.type = 'Cash Power Payment';
    return transaction;
  }
  
  // Check for Payments to Code Holders
  if (message.includes('TxId:') && message.includes('Your payment of') && message.includes('has been completed')) {
    transaction.type = 'Payment to Code Holder';
    transaction.recipient = extractRecipient(message);
    return transaction;
  }

  // Check for Transfers to Mobile Numbers
  if ((message.includes('RWF transferred to') && message.includes('from 36521838') || message.includes("You have transferred"))) {
    transaction.type = 'Transfer to Mobile Number';
    transaction.recipient = extractRecipient(message);
    return transaction;
  }

  // Check for Bank Deposits
  if (message.includes('bank deposit') && message.includes('has been added to your mobile money account')) {
    transaction.type = 'Bank Deposit';
    return transaction;
  }

  // Check for Withdrawals from Agents
  if (message.includes('have via agent:') && message.includes('withdrawn') && message.includes('RWF from your mobile money account')) {
    transaction.type = 'Agent Withdrawal';
    transaction.recipient = extractAgentName(message);
    return transaction;
  }


  // Check for Transactions by Third Parties
  if (message.includes('transaction of') && message.includes('on your MOMO account was successfully completed')) {
    transaction.type = 'Third Party Transaction';
    transaction.recipient = extractBusinessName(message);
    return transaction;
  }

  // Return transaction if it's valid, otherwise return null
  return transaction.type !== "Unknown" && (transaction.amount || transaction.balance || transaction.transactionId) ? transaction : null;
}

// Helper functions to extract data from messages
function extractAmount(message) {
  // Extract amount from the message
  let match;

  // Pattern for 'payment of X,XXX RWF' or 'received X,XXX RWF'
  match = message.match(/(?:payment of|received|transferred|deposit of|transaction of|withdrawn|\*165\*S\*)[\s]*([\d,]+)[\s]*RWF/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }

  return null;
}

function extractBalance(message) {
  // Extract balance from the message
  const match = message.match(/(?:NEW BALANCE|new balance)[:\s]*([\d,]+)[\s]*RWF/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

function extractTransactionId(message) {
  // Extract transaction ID from the message
  let match;

  // Pattern for 'TxId: XXXXXXXXXX'
  match = message.match(/TxId:[\s]*([0-9]+)/i);
  if (match) {
    return match[1];
  }

  // Pattern for 'Financial Transaction Id: XXXXXXXXXX'
  match = message.match(/Financial Transaction Id:[\s]*([0-9]+)/i);
  if (match) {
    return match[1];
  }

  return null;
}

function extractFee(message) {
  // Extract fee from the message
  const match = message.match(/Fee(?:\s*was)?:[\s]*([\d,]+)[\s]*RWF/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

function extractSender(message) {
  // Extract sender name from 'received from' pattern
  const match = message.match(/from\s+([^(]+)[\s(]/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function extractRecipient(message) {
  // Extract recipient from various patterns
  let match;

  // Pattern for 'payment of X RWF to Jane Smith'
  match = message.match(/(?:to|transferred to)\s+([A-Za-z]+\s[A-Za-z]+)[\s0-9]/i);
  if (match) {
    return match[1].trim();
  }

  return null;
}

function extractAgentName(message) {
  // Extract agent name
  const match = message.match(/via agent:\s+([^(]+)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function extractBusinessName(message) {
  // Extract business name from third-party transactions
  const match = message.match(/transaction of[\s\d,]+RWF by\s+([^on]+)on your/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

console.log('Starting SMS parsing process...');
