class DashboardApp {
    constructor() {
        this.user = null;
        this.connections = [];
        this.currentEditingConnection = null;
        this.init();
    }

    init() {
        console.log('🚀 Initializing Dashboard App...');

        // Clear any stored connection data when dashboard loads
        localStorage.removeItem('selectedConnectionId');
        localStorage.removeItem('selectedDatabase');

        this.checkAuth();
        this.bindEvents();

        // Show the page after initialization
        setTimeout(() => {
            const container = document.querySelector('.auth-check');
            if (container) {
                container.classList.add('ready');
                console.log('✅ Dashboard container marked as ready');
            } else {
                console.error('❌ Dashboard container not found');
            }
        }, 200);
    }

    async checkAuth() {
        console.log('🔍 Checking authentication...');

        // Check Supabase session
        if (window.supabaseClient) {
            console.log('✅ Supabase client found');
            try {
                const session = await window.supabaseClient.getSession();
                console.log('📋 Session:', session);

                if (session && session.user) {
                    console.log('✅ User authenticated:', session.user.email);
                    this.user = session.user;
                    // Ensure token is stored for API calls
                    localStorage.setItem('supabase_token', session.access_token);
                    this.showAuthenticatedState();
                    this.loadConnections();
                    return;
                } else {
                    console.log('❌ No valid session found');
                }
            } catch (error) {
                console.error('❌ Error checking session:', error);
            }
        } else {
            console.log('❌ Supabase client not found');
        }

        // Show unauthenticated state instead of redirecting immediately
        console.log('👤 Showing unauthenticated state');
        this.showUnauthenticatedState();
    }

    showAuthenticatedState() {
        const userEmail = this.user.email || this.user.user_metadata?.email || 'User';
        const displayName = userEmail.split('@')[0]; // Use part before @ as display name

        document.getElementById('welcome-title').textContent = `Welcome back, ${displayName}!`;
        document.getElementById('welcome-subtitle').textContent = 'Manage your database connections and start querying';

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                this.logout();
            };
        } else {
            console.error('Logout button not found');
        }
    }

    showUnauthenticatedState() {
        // If not authenticated, redirect to signin
        window.location.href = '/signin';
    }

    onUserSignedOut() {
        console.log('User signed out, cleaning up...');
        // Clear user data
        this.user = null;
        // Clear local storage
        localStorage.removeItem('selectedConnectionId');
        localStorage.removeItem('selectedDatabase');
        localStorage.removeItem('supabase_token');
        // Redirect to signin page
        window.location.href = '/signin';
    }



    bindEvents() {
        // Header actions
        document.getElementById('add-connection-btn').addEventListener('click', () => {
            this.showAddConnectionModal();
        });

        // Auth button is handled dynamically in showAuthenticatedState/showUnauthenticatedState

        // Modal events
        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('connection-modal').addEventListener('click', (e) => {
            if (e.target.id === 'connection-modal') {
                this.hideModal();
            }
        });

        // Database selection modal events
        document.getElementById('close-database-modal').addEventListener('click', () => {
            this.hideDatabaseModal();
        });

        document.getElementById('database-modal').addEventListener('click', (e) => {
            if (e.target.id === 'database-modal') {
                this.hideDatabaseModal();
            }
        });

        document.getElementById('cancel-database-btn').addEventListener('click', () => {
            this.hideDatabaseModal();
        });

        document.getElementById('database-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.connectWithDatabase();
        });

        // Removed login/register modal events - using dedicated signin page

        // Form events
        document.getElementById('db-type').addEventListener('change', () => {
            this.updateFormForDbType();
        });

        document.getElementById('test-connection-btn').addEventListener('click', () => {
            this.testConnection();
        });

        document.getElementById('connection-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConnection();
        });
    }

    async loadConnections() {
        const token = localStorage.getItem('supabase_token');

        if (!token) {
            window.location.href = '/signin';
            return;
        }

        try {
            const response = await fetch('/api/connections', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.connections = result.connections;
                this.displayConnections();
            } else {
                throw new Error('Failed to load connections');
            }
        } catch (error) {
            console.error('Error loading connections:', error);
            this.displayError('Failed to load connections');
        }
    }

    displayConnections() {
        const container = document.getElementById('connections-container');

        if (this.connections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No database connections yet</h3>
                    <p>Add your first database connection to get started</p>
                    <button class="btn btn-primary" onclick="dashboardApp.showAddConnectionModal()">+ Add Connection</button>
                </div>
            `;
            return;
        }

        const connectionsHtml = this.connections.map(conn => `
            <div class="connection-card" onclick="dashboardApp.connectToDatabase('${conn.id}')">
                <div class="connection-header">
                    <div class="connection-info">
                        <h3>${conn.connection_name}</h3>
                        <p>Created: ${new Date(conn.created_at).toLocaleDateString()}</p>
                    </div>
                    <span class="db-type-badge db-type-${conn.db_type}">${conn.db_type.toUpperCase()}</span>
                </div>
                <div class="connection-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-small btn-secondary" onclick="dashboardApp.editConnection('${conn.id}')">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="dashboardApp.deleteConnection('${conn.id}')">Delete</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="connections-grid">${connectionsHtml}</div>`;
    }

    showAddConnectionModal() {
        // Check if user is authenticated first
        if (!this.user) {
            window.location.href = '/signin';
            return;
        }

        this.currentEditingConnection = null;
        document.getElementById('modal-title').textContent = 'Add New Connection';
        document.getElementById('connection-form').reset();
        document.getElementById('db-type').value = '';
        this.updateFormForDbType();
        this.clearModalMessages();
        document.getElementById('connection-modal').style.display = 'block';
    }

    async editConnection(connectionId) {
        const token = localStorage.getItem('supabase_token');

        try {
            const response = await fetch(`/api/connections/${connectionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                const conn = result.connection;

                this.currentEditingConnection = connectionId;
                document.getElementById('modal-title').textContent = 'Edit Connection';

                // Populate form
                document.getElementById('connection-name').value = conn.connectionName;
                document.getElementById('db-type').value = conn.dbType;
                document.getElementById('host').value = conn.credentials.host;
                document.getElementById('port').value = conn.credentials.port;
                document.getElementById('username-input').value = conn.credentials.username;
                document.getElementById('password-input').value = conn.credentials.password;

                if (conn.credentials.authDatabase) {
                    document.getElementById('auth-database').value = conn.credentials.authDatabase;
                }

                this.updateFormForDbType();
                this.clearModalMessages();
                document.getElementById('connection-modal').style.display = 'block';
            } else {
                throw new Error('Failed to load connection details');
            }
        } catch (error) {
            console.error('Error loading connection:', error);
            alert('Failed to load connection details');
        }
    }

    async deleteConnection(connectionId) {
        if (!confirm('Are you sure you want to delete this connection?')) {
            return;
        }

        const token = localStorage.getItem('supabase_token');

        try {
            const response = await fetch(`/api/connections/${connectionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.loadConnections(); // Reload connections
            } else {
                throw new Error('Failed to delete connection');
            }
        } catch (error) {
            console.error('Error deleting connection:', error);
            alert('Failed to delete connection');
        }
    }

    async connectToDatabase(connectionId) {
        // Show database selection modal
        this.showDatabaseSelectionModal(connectionId);
    }

    updateFormForDbType() {
        const dbType = document.getElementById('db-type').value;
        const authDbGroup = document.getElementById('auth-database-group');
        const portInput = document.getElementById('port');

        if (dbType === 'mongodb') {
            authDbGroup.style.display = 'block';
            portInput.value = portInput.value || '27017';
        } else if (dbType === 'mysql') {
            authDbGroup.style.display = 'none';
            portInput.value = portInput.value || '3306';
        } else {
            authDbGroup.style.display = 'none';
            portInput.value = '';
        }
    }

    async testConnection() {
        const formData = new FormData(document.getElementById('connection-form'));
        const dbType = formData.get('dbType');

        // Use appropriate default database for testing
        let testDatabase;
        if (dbType === 'mysql') {
            testDatabase = 'information_schema'; // Always exists in MySQL
        } else if (dbType === 'mongodb') {
            testDatabase = 'admin'; // Always exists in MongoDB
        } else {
            testDatabase = 'test';
        }

        const credentials = {
            host: formData.get('host'),
            port: formData.get('port'),
            username: formData.get('username'),
            password: formData.get('password'),
            authDatabase: formData.get('authDatabase'),
            database: testDatabase
        };

        if (!dbType) {
            this.showModalMessage('Please select a database type', 'error');
            return;
        }

        this.setModalLoading(true);
        this.clearModalMessages();

        try {
            const response = await fetch('/api/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dbType: dbType,
                    credentials: credentials
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showModalMessage('Connection successful! You can now save this connection.', 'success');
            } else {
                this.showModalMessage(`Connection failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showModalMessage('Network error during connection test', 'error');
        } finally {
            this.setModalLoading(false);
        }
    }

    async saveConnection() {
        const formData = new FormData(document.getElementById('connection-form'));
        const connectionData = {
            connectionName: formData.get('connectionName'),
            dbType: formData.get('dbType'),
            credentials: {
                host: formData.get('host'),
                port: formData.get('port'),
                username: formData.get('username'),
                password: formData.get('password'),
                authDatabase: formData.get('authDatabase')
            }
        };

        if (!connectionData.dbType) {
            this.showModalMessage('Please select a database type', 'error');
            return;
        }

        this.setModalLoading(true);
        this.clearModalMessages();

        // Get fresh token from Supabase session
        let token = localStorage.getItem('supabase_token');

        // Try to get fresh session if token seems invalid
        if (window.supabaseClient) {
            try {
                const session = await window.supabaseClient.getSession();
                if (session && session.access_token) {
                    token = session.access_token;
                    localStorage.setItem('supabase_token', token);
                }
            } catch (error) {
                console.error('Error refreshing session:', error);
            }
        }

        if (!token) {
            this.showModalMessage('Authentication required. Please sign in again.', 'error');
            setTimeout(() => window.location.href = '/signin', 2000);
            return;
        }

        const url = this.currentEditingConnection
            ? `/api/connections/${this.currentEditingConnection}`
            : '/api/connections';
        const method = this.currentEditingConnection ? 'PUT' : 'POST';

        try {
            console.log('🔄 Saving connection:', { url, method, token: token ? 'present' : 'missing' });

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(connectionData)
            });

            console.log('📡 Response status:', response.status);
            const result = await response.json();
            console.log('📋 Response data:', result);

            if (result.success) {
                this.showModalMessage(
                    this.currentEditingConnection ? 'Connection updated successfully!' : 'Connection saved successfully!',
                    'success'
                );

                setTimeout(() => {
                    this.hideModal();
                    this.loadConnections();
                }, 1500);
            } else {
                this.showModalMessage(`Failed to save connection: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Save connection error:', error);
            this.showModalMessage('Network error while saving connection', 'error');
        } finally {
            this.setModalLoading(false);
        }
    }

    hideModal() {
        document.getElementById('connection-modal').style.display = 'none';
        this.currentEditingConnection = null;
    }

    setModalLoading(loading) {
        const testBtn = document.getElementById('test-connection-btn');
        const saveBtn = document.getElementById('save-connection-btn');

        if (loading) {
            testBtn.disabled = true;
            saveBtn.disabled = true;
            testBtn.textContent = 'Testing...';
            saveBtn.textContent = 'Saving...';
        } else {
            testBtn.disabled = false;
            saveBtn.disabled = false;
            testBtn.textContent = 'Test Connection';
            saveBtn.textContent = this.currentEditingConnection ? 'Update Connection' : 'Save Connection';
        }
    }

    showModalMessage(message, type) {
        const container = document.getElementById('modal-message-container');
        const className = type === 'error' ? 'error-message' : 'success-message';
        container.innerHTML = `<div class="${className}">${message}</div>`;
    }

    clearModalMessages() {
        document.getElementById('modal-message-container').innerHTML = '';
    }

    displayError(message) {
        const container = document.getElementById('connections-container');
        container.innerHTML = `
            <div class="error-message">
                ${message}
                <button class="btn btn-secondary" onclick="dashboardApp.loadConnections()" style="margin-left: 1rem;">Retry</button>
            </div>
        `;
    }

    showDatabaseSelectionModal(connectionId) {
        this.selectedConnectionId = connectionId;

        // Get connection info to show helpful text
        const connection = this.connections.find(conn => conn.id == connectionId);
        if (connection) {
            const helpText = document.getElementById('database-help-text');
            if (connection.db_type === 'mongodb') {
                helpText.textContent = 'Enter the MongoDB database name (e.g., "myapp", "test")';
                document.getElementById('database-name').placeholder = 'e.g., myapp, test, admin';
            } else {
                helpText.textContent = 'Enter the MySQL database name';
                document.getElementById('database-name').placeholder = 'e.g., myapp_db, company_data';
            }
        }

        document.getElementById('database-name').value = '';
        this.clearDatabaseModalMessages();
        document.getElementById('database-modal').style.display = 'block';
    }

    hideDatabaseModal() {
        document.getElementById('database-modal').style.display = 'none';
        this.selectedConnectionId = null;
    }

    async connectWithDatabase() {
        const databaseName = document.getElementById('database-name').value.trim();

        if (!databaseName) {
            this.showDatabaseModalMessage('Please enter a database name', 'error');
            return;
        }

        // Store both connection ID and database name
        localStorage.setItem('selectedConnectionId', this.selectedConnectionId);
        localStorage.setItem('selectedDatabase', databaseName);

        // Redirect to query interface
        window.location.href = '/query';
    }

    showDatabaseModalMessage(message, type) {
        const container = document.getElementById('database-modal-message-container');
        const className = type === 'error' ? 'error-message' : 'success-message';
        container.innerHTML = `<div class="${className}">${message}</div>`;
    }

    clearDatabaseModalMessages() {
        document.getElementById('database-modal-message-container').innerHTML = '';
    }

    async logout() {
        try {
            console.log('Logging out...');
            
            if (window.supabaseClient) {
                const result = await window.supabaseClient.signOut();
                if (!result.success) {
                    console.error('Logout error:', result.error);
                    // Still proceed with local cleanup even if server logout fails
                }
            }

            // Clear local storage
            localStorage.removeItem('selectedConnectionId');
            localStorage.removeItem('selectedDatabase');
            localStorage.removeItem('supabase_token');

            // Clear user data
            this.user = null;
            
            // Redirect to signin page
            console.log('Redirecting to signin...');
            window.location.href = '/signin';
        } catch (error) {
            console.error('Logout error:', error);
            // Force cleanup and redirect even if there's an error
            localStorage.clear();
            window.location.href = '/signin';
        }
    }

    // Login Modal Methods
    showLoginModal() {
        document.getElementById('login-form').reset();
        this.clearLoginMessages();
        document.getElementById('login-modal').style.display = 'block';
    }

    hideLoginModal() {
        document.getElementById('login-modal').style.display = 'none';
    }

    async handleLogin() {
        const formData = new FormData(document.getElementById('login-form'));
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        this.setLoginLoading(true);
        this.clearLoginMessages();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('authToken', result.token);
                this.showLoginMessage('Login successful!', 'success');

                setTimeout(() => {
                    this.hideLoginModal();
                    this.checkAuth(); // Refresh the page state
                }, 1000);
            } else {
                this.showLoginMessage(result.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showLoginMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoginLoading(false);
        }
    }

    setLoginLoading(loading) {
        const btn = document.getElementById('login-submit-btn');
        if (loading) {
            btn.disabled = true;
            btn.textContent = 'Signing In...';
        } else {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    }

    showLoginMessage(message, type) {
        const container = document.getElementById('login-modal-message-container');
        const className = type === 'error' ? 'error-message' : 'success-message';
        container.innerHTML = `<div class="${className}">${message}</div>`;
    }

    clearLoginMessages() {
        document.getElementById('login-modal-message-container').innerHTML = '';
    }

    // Register Modal Methods
    showRegisterModal() {
        document.getElementById('register-form').reset();
        this.clearRegisterMessages();
        document.getElementById('register-modal').style.display = 'block';
    }

    hideRegisterModal() {
        document.getElementById('register-modal').style.display = 'none';
    }

    async handleRegister() {
        const formData = new FormData(document.getElementById('register-form'));
        const registerData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword')
        };

        // Client-side validation
        if (!this.validateRegisterForm(registerData)) {
            return;
        }

        this.setRegisterLoading(true);
        this.clearRegisterMessages();

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });

            const result = await response.json();

            if (result.success) {
                this.showRegisterMessage('Account created successfully! You can now sign in.', 'success');

                setTimeout(() => {
                    this.hideRegisterModal();
                    this.showLoginModal();
                }, 2000);
            } else {
                this.showRegisterMessage(result.error || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showRegisterMessage('Network error. Please try again.', 'error');
        } finally {
            this.setRegisterLoading(false);
        }
    }

    validateRegisterForm(data) {
        // Username validation
        if (!/^[a-zA-Z0-9_]{3,50}$/.test(data.username)) {
            this.showRegisterMessage('Username must be 3-50 characters and contain only letters, numbers, and underscores', 'error');
            return false;
        }

        // Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            this.showRegisterMessage('Please enter a valid email address', 'error');
            return false;
        }

        // Password validation
        if (data.password.length < 6) {
            this.showRegisterMessage('Password must be at least 6 characters long', 'error');
            return false;
        }

        // Password match validation
        if (data.password !== data.confirmPassword) {
            this.showRegisterMessage('Passwords do not match', 'error');
            return false;
        }

        return true;
    }

    setRegisterLoading(loading) {
        const btn = document.getElementById('register-submit-btn');
        if (loading) {
            btn.disabled = true;
            btn.textContent = 'Creating Account...';
        } else {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    }

    showRegisterMessage(message, type) {
        const container = document.getElementById('register-modal-message-container');
        const className = type === 'error' ? 'error-message' : 'success-message';
        container.innerHTML = `<div class="${className}">${message}</div>`;
    }

    clearRegisterMessages() {
        document.getElementById('register-modal-message-container').innerHTML = '';
    }
}

// Initialize the dashboard app
let dashboardApp;

// Ensure dashboard initializes even if DOMContentLoaded already fired
function initializeDashboard() {
    console.log('🎯 Initializing dashboard app...');
    if (!dashboardApp) {
        dashboardApp = new DashboardApp();
        window.dashboardApp = dashboardApp; // Make it globally accessible
        
        // Add global logout function for debugging
        window.forceLogout = () => {
            console.log('Force logout called');
            localStorage.clear();
            window.location.href = '/signin';
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    // DOM is already loaded
    initializeDashboard();
}