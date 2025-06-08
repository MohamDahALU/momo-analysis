document.addEventListener('DOMContentLoaded', () => {
    // Initialize date pickers with default values (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // document.getElementById('dateFrom').valueAsDate = thirtyDaysAgo;
    // document.getElementById('dateTo').valueAsDate = today;
    
    // Fetch and display transactions
    fetchTransactions();
    
    // Setup event listeners for filtering
    document.getElementById('searchInput').addEventListener('input', filterTransactions);
    document.getElementById('typeFilter').addEventListener('change', filterTransactions);
    document.getElementById('applyFilters').addEventListener('click', () => {
        fetchTransactions();
    });
    
    // Setup modal close button
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('transactionModal').style.display = 'none';
    });
    
    // Close modal when clicking outside the content
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('transactionModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Fetch all transactions from the API with date filters
async function fetchTransactions() {
    try {
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        
        const url = new URL('/momo-app/api/transactions', window.location.origin);
        if (dateFrom) url.searchParams.append('from', dateFrom);
        if (dateTo) url.searchParams.append('to', dateTo);
        
        const response = await fetch(url);
        const transactions = await response.json();
        
        // Populate transaction types filter
        populateTransactionTypes(transactions);
        
        // Display transactions in the table
        displayTransactions(transactions);
        
        // Generate charts
        generateCharts(transactions);
        
        // Display summary
        displaySummary(transactions);
        
    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
}

// Display summary information directly from transactions
function displaySummary(transactions) {
    const summaryContainer = document.getElementById('summary');
    summaryContainer.innerHTML = '';
    
    // Calculate summary data
    const totalIncoming = transactions
        .filter(t => t.transaction_type.includes('Incoming') || t.transaction_type.includes('Deposit'))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
        
    const totalOutgoing = transactions
        .filter(t => !t.transaction_type.includes('Incoming') && !t.transaction_type.includes('Deposit') && t.amount)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
        
    const totalFees = transactions.reduce((sum, t) => sum + (t.fee || 0), 0);
    
    // Create summary items
    const summaryItems = [
        { title: 'Total Transactions', value: transactions.length },
        { title: 'Total Incoming', value: formatAmount(totalIncoming) + ' RWF' },
        { title: 'Total Outgoing', value: formatAmount(totalOutgoing) + ' RWF' },
        { title: 'Total Fees', value: formatAmount(totalFees) + ' RWF' },
        { title: 'Net Balance', value: formatAmount(totalIncoming - totalOutgoing) + ' RWF' },
    ];
    
    summaryItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 px-6 py-4 rounded-lg shadow-sm m-2';
        div.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-700">${item.title}</h3>
            <p class="text-2xl font-bold ${item.title === 'Net Balance' ? (totalIncoming - totalOutgoing >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'}">${item.value}</p>
        `;
        summaryContainer.appendChild(div);
    });
}

// Populate transaction types dropdown
function populateTransactionTypes(transactions) {
    const typeFilter = document.getElementById('typeFilter');
    const types = new Set();
    
    transactions.forEach(transaction => {
        if (transaction.transaction_type) {
            types.add(transaction.transaction_type);
        }
    });
    
    // Clear existing options
    typeFilter.innerHTML = '';
    
    // Add a default "All" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All';
    typeFilter.appendChild(allOption);
    
    // Add options to select element
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });
}

// Display transactions in the table
function displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        // Format date
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleString();
        
        // Determine who is the counterparty (recipient or sender)
        let counterparty = transaction.recipient || transaction.sender || 'N/A';
        
        // Format amount with color coding
        const amountClass = transaction.transaction_type.includes('Incoming') || transaction.transaction_type.includes("Deposit") ? 'text-green-600 font-semibold' : 'text-red-600';
        
        row.className = "hover:bg-gray-50";
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap">${transaction.transaction_type}</td>
            <td class="px-6 py-4 whitespace-nowrap ${amountClass}">${formatAmount(transaction.amount)} RWF</td>
            <td class="px-6 py-4 whitespace-nowrap">${counterparty}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatAmount(transaction.balance)} RWF</td>
            <td class="px-6 py-4 whitespace-nowrap">${transaction.transaction_id || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm view-details" data-id="${transaction.id}">
                    Details
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Add event listeners to detail buttons
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', () => {
            const transactionId = button.getAttribute('data-id');
            showTransactionDetails(transactionId, transactions);
        });
    });
}

// Show transaction details in modal
function showTransactionDetails(id, transactions) {
    const transaction = transactions.find(t => t.id.toString() === id);
    if (!transaction) return;
    
    const detailsContainer = document.getElementById('transactionDetails');
    const date = new Date(transaction.date).toLocaleString();
    
    detailsContainer.innerHTML = `
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Date</p>
            <p class="font-medium">${date}</p>
        </div>
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Type</p>
            <p class="font-medium">${transaction.transaction_type}</p>
        </div>
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Amount</p>
            <p class="font-medium">${formatAmount(transaction.amount)} RWF</p>
        </div>
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Transaction ID</p>
            <p class="font-medium">${transaction.transaction_id || 'N/A'}</p>
        </div>
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Balance After</p>
            <p class="font-medium">${formatAmount(transaction.balance)} RWF</p>
        </div>
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Recipient</p>
            <p class="font-medium">${transaction.recipient || 'N/A'}</p>
        </div>
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Sender</p>
            <p class="font-medium">${transaction.sender || 'N/A'}</p>
        </div>
        <div class="bg-gray-50 p-4 rounded">
            <p class="text-sm text-gray-500">Fee</p>
            <p class="font-medium">${formatAmount(transaction.fee)} RWF</p>
        </div>
        <div class="bg-gray-50 p-4 rounded col-span-2">
            <p class="text-sm text-gray-500">Raw Message</p>
            <p class="font-mono text-xs mt-1 bg-white p-2 rounded border">${transaction.raw_message}</p>
        </div>
    `;
    
    document.getElementById('transactionModal').style.display = 'flex';
}

// Filter transactions based on search input and type filter
function filterTransactions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedType = document.getElementById('typeFilter').value;
    
    const rows = document.getElementById('transactionsBody').getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const typeCell = row.getElementsByTagName('td')[1]; // Type is in the second column
        const rowText = row.textContent.toLowerCase();
        
        // Check if row matches both search term and selected type
        const matchesSearch = searchTerm === '' || rowText.includes(searchTerm);
        const matchesType = selectedType === '' || (typeCell && typeCell.textContent === selectedType);
        
        // Show or hide row based on filters
        if (matchesSearch && matchesType) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}

// Format amount to display with commas for thousands
function formatAmount(amount) {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US').format(amount);
}

// Generate charts based on transaction data - simplified to use only bar charts
function generateCharts(transactions) {
    generateTransactionTypesChart(transactions);
    generateMonthlySummaryChart(transactions);
}

// Generate transaction types chart (now bar chart)
function generateTransactionTypesChart(transactions) {
    // Count transactions by type
    const typeCounts = {};
    transactions.forEach(transaction => {
        const type = transaction.transaction_type;
        if (!typeCounts[type]) typeCounts[type] = 0;
        typeCounts[type]++;
    });
    
    // Prepare data for chart
    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);
    
    // Create the chart
    const ctx = document.getElementById('transactionTypesChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.transactionTypesChart && window.transactionTypesChart.destroy) window.transactionTypesChart.destroy();
    
    window.transactionTypesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Transactions',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.6)', // blue-500 with opacity
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Transaction Count by Type'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Generate monthly summary chart (already using bar chart)
function generateMonthlySummaryChart(transactions) {
    // Group transactions by month
    const monthlyData = {};
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = {
                inflow: 0,
                outflow: 0
            };
        }
        
        if (transaction.amount) {
            if (transaction.transaction_type.includes('Incoming') || 
                transaction.transaction_type.includes('Deposit')) {
                monthlyData[monthYear].inflow += transaction.amount;
            } else {
                monthlyData[monthYear].outflow += transaction.amount;
            }
        }
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort();
    
    // Prepare data for chart
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('default', { month: 'short', year: 'numeric' });
    });
    
    const inflowData = sortedMonths.map(month => monthlyData[month].inflow);
    const outflowData = sortedMonths.map(month => monthlyData[month].outflow);
    
    // Create the chart
    const ctx = document.getElementById('monthlySummaryChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.monthlySummaryChart && window.monthlySummaryChart.destroy) window.monthlySummaryChart.destroy();
    
    window.monthlySummaryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Inflow',
                    data: inflowData,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)', // green-500
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Outflow',
                    data: outflowData,
                    backgroundColor: 'rgba(239, 68, 68, 0.6)', // red-500
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Transaction Summary'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount (RWF)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}
