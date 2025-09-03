class DatabaseQueryApp {
    constructor() {
        this.selectedDB = null;
        this.credentials = null;
        this.availableTables = [];
        this.selectedTables = [];
        this.currentQuery = null;
        this.currentResults = null;
        this.tableSchemas = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updatePortPlaceholder();
    }

    bindEvents() {
        // Database selection
        document.querySelectorAll('.db-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectDatabase(e.currentTarget.dataset.db);
            });
        });

        // Credentials form
        document.getElementById('credentials-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCredentials();
        });

        // Query submission
        document.getElementById('submit-query').addEventListener('click', () => {
            this.generateQuery();
        });

        // Query execution
        document.getElementById('execute-query').addEventListener('click', () => {
            this.executeQuery();
        });

        // Edit query
        document.getElementById('edit-query').addEventListener('click', () => {
            this.editQuery();
        });

        // Download results
        document.getElementById('download-results').addEventListener('click', () => {
            this.downloadResults();
        });

        // Table selection events
        document.getElementById('select-all-tables').addEventListener('click', () => {
            this.selectAllTables();
        });

        document.getElementById('proceed-to-query').addEventListener('click', () => {
            this.proceedToQuery();
        });

        // Back button events
        document.getElementById('back-to-db-selection').addEventListener('click', () => {
            this.showStep('db-selection');
        });

        document.getElementById('back-to-credentials').addEventListener('click', () => {
            this.showStep('db-credentials');
        });

        document.getElementById('back-to-tables').addEventListener('click', () => {
            this.showStep('table-selection');
        });

        document.getElementById('new-query').addEventListener('click', () => {
            this.resetQuery();
        });

        document.getElementById('back-to-query').addEventListener('click', () => {
            this.resetResults();
        });
    }

    selectDatabase(dbType) {
        this.selectedDB = dbType;
        this.showStep('db-credentials');
        this.updatePortPlaceholder();
        
        // Update form based on database type
        if (dbType === 'mongodb') {
            document.getElementById('database-group').style.display = 'block'; // MongoDB also needs database name
            document.getElementById('port').value = '27017';
            document.getElementById('database').placeholder = 'Database name (optional, defaults to "test")';
            document.getElementById('database').required = false;
            
            // Show auth database field for MongoDB
            const authDbGroup = document.getElementById('auth-database-group');
            if (authDbGroup) {
                authDbGroup.style.display = 'block';
            }
        } else {
            document.getElementById('database-group').style.display = 'block';
            document.getElementById('port').value = '3306';
            document.getElementById('database').placeholder = 'Database name';
            document.getElementById('database').required = true;
            
            // Hide auth database field for MySQL
            const authDbGroup = document.getElementById('auth-database-group');
            if (authDbGroup) {
                authDbGroup.style.display = 'none';
            }
        }
    }

    updatePortPlaceholder() {
        const portInput = document.getElementById('port');
        if (this.selectedDB === 'mongodb') {
            portInput.placeholder = '27017';
        } else {
            portInput.placeholder = '3306';
        }
    }

    async handleCredentials() {
        const formData = new FormData(document.getElementById('credentials-form'));
        this.credentials = {
            host: formData.get('host'),
            port: formData.get('port'),
            username: formData.get('username'),
            password: formData.get('password'),
            database: formData.get('database'),
            authDatabase: formData.get('authDatabase') // For MongoDB authentication
        };

        this.showLoading();
        
        try {
            // Test connection and get tables
            await this.testConnection();
            await this.loadTables();
            this.showStep('table-selection');
        } catch (error) {
            alert('Connection failed: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async testConnection() {
        const response = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dbType: this.selectedDB,
                credentials: this.credentials
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }
    }

    async loadTables() {
        const response = await fetch('/api/get-tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dbType: this.selectedDB,
                credentials: this.credentials
            })
        });

        const result = await response.json();
        if (result.success) {
            this.availableTables = result.tables;
            this.displayTables();
        } else {
            throw new Error(result.error);
        }
    }

    displayTables() {
        const tablesContainer = document.getElementById('tables-list');
        
        if (this.availableTables.length === 0) {
            tablesContainer.innerHTML = '<div class="loading-tables">No tables found</div>';
            return;
        }

        let html = '';
        this.availableTables.forEach((table, index) => {
            const tableName = table.name || table;
            const tableInfo = table.type ? `(${table.type})` : '';
            
            html += `
                <div class="table-item" data-table="${tableName}">
                    <input type="checkbox" class="table-checkbox" id="table-${index}" value="${tableName}">
                    <label for="table-${index}" class="table-name">${tableName}</label>
                    <span class="table-info">${tableInfo}</span>
                </div>
            `;
        });

        tablesContainer.innerHTML = html;

        // Add event listeners to checkboxes
        tablesContainer.querySelectorAll('.table-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedTables();
            });
        });
    }

    updateSelectedTables() {
        const checkboxes = document.querySelectorAll('.table-checkbox:checked');
        this.selectedTables = Array.from(checkboxes).map(cb => cb.value);
        
        const proceedBtn = document.getElementById('proceed-to-query');
        proceedBtn.disabled = this.selectedTables.length === 0;
    }

    selectAllTables() {
        const checkboxes = document.querySelectorAll('.table-checkbox');
        const allSelected = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = !allSelected;
        });
        
        this.updateSelectedTables();
    }

    async proceedToQuery() {
        if (this.selectedTables.length === 0) {
            alert('Please select at least one table');
            return;
        }

        this.showLoading();
        
        try {
            this.displaySelectedTables();
            await this.loadTableSchemas();
            this.showStep('query-interface');
        } catch (error) {
            alert('Error loading table information: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    displaySelectedTables() {
        const display = document.getElementById('selected-tables-display');
        display.innerHTML = this.selectedTables.map(table => 
            `<span class="selected-table-tag">${table}</span>`
        ).join('');
    }

    async loadTableSchemas() {
        try {
            console.log('Loading table schemas for:', this.selectedTables);
            
            const response = await fetch('/api/get-table-schemas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dbType: this.selectedDB,
                    credentials: this.credentials,
                    selectedTables: this.selectedTables
                })
            });

            const result = await response.json();
            console.log('Schema response:', result);
            
            if (result.success) {
                this.tableSchemas = result.schemas;
                console.log('Loaded schemas:', this.tableSchemas);
                this.displayTableSchemas();
            } else {
                console.error('Failed to load schemas:', result.error);
                // Show error in the schema container
                const schemaContainer = document.getElementById('table-schemas-info');
                if (schemaContainer) {
                    schemaContainer.innerHTML = `<div class="error-message">Failed to load table structure: ${result.error}</div>`;
                }
            }
        } catch (error) {
            console.error('Error loading table schemas:', error);
            // Show error in the schema container
            const schemaContainer = document.getElementById('table-schemas-info');
            if (schemaContainer) {
                schemaContainer.innerHTML = `<div class="error-message">Error loading table structure: ${error.message}</div>`;
            }
        }
    }

    displayTableSchemas() {
        console.log('Displaying table schemas:', this.tableSchemas);
        
        if (!this.tableSchemas || Object.keys(this.tableSchemas).length === 0) {
            console.log('No table schemas to display');
            return;
        }

        const schemasHtml = Object.keys(this.tableSchemas).map(tableName => {
            const columns = this.tableSchemas[tableName];
            console.log(`Columns for ${tableName}:`, columns);
            
            if (!columns || columns.length === 0) {
                return `
                    <div class="table-schema">
                        <h4>${tableName}</h4>
                        <div class="columns-list">
                            <div class="column-info">No columns found</div>
                        </div>
                    </div>
                `;
            }
            
            const columnsHtml = columns.map(col => 
                `<div class="column-info">
                    <span class="column-name">${col.name}</span>
                    <span class="column-type">${col.type}</span>
                    ${col.key === 'PRI' ? '<span class="primary-key">PK</span>' : ''}
                </div>`
            ).join('');

            return `
                <div class="table-schema">
                    <h4>${tableName}</h4>
                    <div class="columns-list">${columnsHtml}</div>
                </div>
            `;
        }).join('');

        // Add schema info to the query interface
        const schemaContainer = document.getElementById('table-schemas-info');
        console.log('Schema container found:', !!schemaContainer);
        
        if (schemaContainer) {
            schemaContainer.innerHTML = schemasHtml;
            console.log('Schema HTML set:', schemasHtml);
        } else {
            console.error('table-schemas-info element not found!');
        }
    }

    async generateQuery() {
        const naturalQuery = document.getElementById('natural-query').value.trim();
        if (!naturalQuery) {
            alert('Please enter your question');
            return;
        }

        this.showLoading();

        try {
            // Simulate Gemini AI API call
            const generatedQuery = await this.callGeminiAPI(naturalQuery);
            this.currentQuery = generatedQuery;
            
            document.getElementById('query-display').textContent = generatedQuery;
            document.getElementById('generated-query').classList.remove('hidden');
            
        } catch (error) {
            alert('Error generating query: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async callGeminiAPI(naturalQuery) {
        console.log('Sending request to Gemini with:', {
            naturalLanguage: naturalQuery,
            dbType: this.selectedDB,
            selectedTables: this.selectedTables
        });

        const response = await fetch('/api/generate-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                naturalLanguage: naturalQuery,
                dbType: this.selectedDB,
                credentials: this.credentials,
                selectedTables: this.selectedTables
            })
        });

        const result = await response.json();
        console.log('Received response from Gemini:', result);
        
        if (result.success) {
            return result.query;
        } else {
            throw new Error(result.error);
        }
    }

    generateMySQLQuery(naturalQuery) {
        // Simple query generation based on keywords (in real app, use Gemini API)
        const lower = naturalQuery.toLowerCase();
        
        if (lower.includes('all users') || lower.includes('show users')) {
            return 'SELECT * FROM users;';
        } else if (lower.includes('count') && lower.includes('users')) {
            return 'SELECT COUNT(*) as total_users FROM users;';
        } else if (lower.includes('recent') || lower.includes('last month')) {
            return 'SELECT * FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH);';
        } else if (lower.includes('orders')) {
            return 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;';
        } else {
            return 'SELECT * FROM users LIMIT 10;';
        }
    }

    generateMongoQuery(naturalQuery) {
        // Simple query generation for MongoDB
        const lower = naturalQuery.toLowerCase();
        
        if (lower.includes('all users') || lower.includes('show users')) {
            return 'db.users.find({})';
        } else if (lower.includes('count') && lower.includes('users')) {
            return 'db.users.countDocuments({})';
        } else if (lower.includes('recent') || lower.includes('last month')) {
            return 'db.users.find({"createdAt": {"$gte": new Date(Date.now() - 30*24*60*60*1000)}})';
        } else if (lower.includes('orders')) {
            return 'db.orders.find({}).sort({"createdAt": -1}).limit(10)';
        } else {
            return 'db.users.find({}).limit(10)';
        }
    }

    async executeQuery() {
        if (!this.currentQuery) return;

        this.showLoading();

        try {
            const response = await fetch('/api/execute-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: this.currentQuery,
                    dbType: this.selectedDB,
                    credentials: this.credentials
                })
            });

            const result = await response.json();
            if (result.success) {
                this.currentResults = result.results;
                this.displayResults(result.results);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            alert('Error executing query: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayResults(results) {
        const resultsContent = document.getElementById('results-content');
        const outputFormat = document.getElementById('output-format').value;

        if (outputFormat === 'chat') {
            resultsContent.innerHTML = this.formatAsChat(results);
        } else if (outputFormat === 'table') {
            resultsContent.innerHTML = this.formatAsTable(results);
        } else {
            resultsContent.innerHTML = this.formatAsJSON(results);
        }

        document.getElementById('results').classList.remove('hidden');
        
        if (outputFormat === 'json' || outputFormat === 'csv') {
            document.getElementById('download-results').classList.remove('hidden');
        }
    }

    formatAsChat(results) {
        let html = '<div class="chat-results">';
        html += `<div class="chat-result"><strong>Found ${results.length} results:</strong></div>`;
        
        results.forEach((row, index) => {
            html += '<div class="chat-result">';
            html += `<strong>Record ${index + 1}:</strong><br>`;
            Object.entries(row).forEach(([key, value]) => {
                html += `${key}: ${value}<br>`;
            });
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }

    formatAsTable(results) {
        if (!results.length) return '<p>No results found</p>';

        const headers = Object.keys(results[0]);
        let html = '<table class="results-table"><thead><tr>';
        
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr></thead><tbody>';

        results.forEach(row => {
            html += '<tr>';
            headers.forEach(header => {
                html += `<td>${row[header] || ''}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    formatAsJSON(results) {
        return `<pre>${JSON.stringify(results, null, 2)}</pre>`;
    }

    editQuery() {
        const newQuery = prompt('Edit your query:', this.currentQuery);
        if (newQuery && newQuery.trim()) {
            this.currentQuery = newQuery.trim();
            document.getElementById('query-display').textContent = this.currentQuery;
        }
    }

    downloadResults() {
        if (!this.currentResults) return;

        const outputFormat = document.getElementById('output-format').value;
        let content, filename, mimeType;

        if (outputFormat === 'json') {
            content = JSON.stringify(this.currentResults, null, 2);
            filename = 'query_results.json';
            mimeType = 'application/json';
        } else if (outputFormat === 'csv') {
            content = this.convertToCSV(this.currentResults);
            filename = 'query_results.csv';
            mimeType = 'text/csv';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    convertToCSV(data) {
        if (!data.length) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');

        return csvContent;
    }

    showStep(stepId) {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(stepId).classList.add('active');
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    resetQuery() {
        // Clear the query input and hide generated query
        document.getElementById('natural-query').value = '';
        document.getElementById('generated-query').classList.add('hidden');
        document.getElementById('results').classList.add('hidden');
        this.currentQuery = null;
        this.currentResults = null;
    }

    resetResults() {
        // Hide results but keep the generated query
        document.getElementById('results').classList.add('hidden');
        this.currentResults = null;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new DatabaseQueryApp();
});