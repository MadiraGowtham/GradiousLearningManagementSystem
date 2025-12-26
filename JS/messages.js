// Dynamic Messaging System for LearnEdge LMS - Client Side
class MessagingSystem {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.selectedMessage = null;
        this.blockedUsers = new Set();
        this.apiBase = '/api';
        this.refreshInterval = null;
        this.contacts = [];
        this.courses = [];
        
        this.init();
    }

    async init() {
        try {
            // Check authentication
            const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
            if (!loggedInUser) {
                this.redirectToLogin();
                return;
            }

            this.currentUser = loggedInUser;
            
            // Initialize UI
            this.initializeUI();
            
            // Load blocked users
            await this.loadBlockedUsers();
            
            // Load contacts from server
            await this.loadContacts();
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
            console.log('Messaging system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize messaging system:', error);
            this.showNotification('Failed to initialize messaging system', 'error');
        }
    }

    initializeUI() {
        // Initialize UI elements
        this.elements = {
            courseFilter: document.getElementById('courseFilter'),
            contactsList: document.getElementById('contactsList'),
            chatUserDetails: document.getElementById('chatUserDetails'),
            chatUserAvatar: document.getElementById('chatUserAvatar'),
            chatMessages: document.getElementById('chatMessages'),
            replyInput: document.getElementById('replyInput'),
            sendBtn: document.getElementById('sendBtn'),
            forwardBtn: document.getElementById('forwardBtn'),
            deleteBtn: document.getElementById('deleteBtn'),
            blockBtn: document.getElementById('blockBtn')
        };

        // Legacy UI elements
        this.legacyElements = {
            legacyReplyInput: document.querySelector('.reply input'),
            legacySendBtn: document.querySelector('.reply .btn')
        };

        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize empty state
        this.showEmptyState();
    }

    setupEventListeners() {
        // Send message functionality
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.elements.replyInput) {
            this.elements.replyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Action buttons
        if (this.elements.forwardBtn) {
            this.elements.forwardBtn.addEventListener('click', () => this.forwardMessage());
        }

        if (this.elements.deleteBtn) {
            this.elements.deleteBtn.addEventListener('click', () => this.deleteMessage());
        }

        if (this.elements.blockBtn) {
            this.elements.blockBtn.addEventListener('click', () => this.toggleBlockUser());
        }

        // Course filter
        if (this.elements.courseFilter) {
            this.elements.courseFilter.addEventListener('change', () => this.onCourseFilterChange());
        }

        // Legacy compatibility
        if (this.legacyElements.legacySendBtn) {
            this.legacyElements.legacySendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.legacyElements.legacyReplyInput) {
            this.legacyElements.legacyReplyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    async loadContacts(course = null) {
        try {
            const url = course 
                ? `${this.apiBase}/messages/contacts?course=${encodeURIComponent(course)}`
                : `${this.apiBase}/messages/contacts`;
            
            const response = await fetch(url, {
                headers: {
                    'x-user': JSON.stringify(this.currentUser)
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load contacts');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load contacts');
            }

            this.contacts = data.contacts || [];
            this.courses = data.courses || [];

            // Handle empty states
            if (this.courses.length === 0) {
                this.showNoCoursesMessage();
                return;
            }

            // Show course filter if multiple courses
            if (this.courses.length > 1) {
                this.showCourseFilter(this.courses, data.selectedCourse);
            } else {
                this.hideCourseFilter();
            }

            // Display contacts
            this.clearContacts();
            
            if (this.contacts.length === 0) {
                this.showNoContactsMessage();
            } else {
                this.contacts.forEach(contact => this.addContactToUI(contact));
            }

            console.log('Contacts loaded:', this.contacts.length);
        } catch (error) {
            console.error('Failed to load contacts:', error);
            this.showNotification('Failed to load contacts', 'error');
        }
    }

    addContactToUI(contact) {
        // Add to new UI
        if (this.elements.contactsList) {
            const contactElement = this.createContactElement(contact);
            this.elements.contactsList.appendChild(contactElement);
        }
    }

    createContactElement(contact) {
        const contactDiv = document.createElement('div');
        contactDiv.className = 'contact';
        contactDiv.setAttribute('data-id', contact.id);
        contactDiv.setAttribute('data-course', contact.course);
        
        contactDiv.innerHTML = `
            <img src="${contact.avatar}" alt="Contact" class="img">
            <div class="details">
                <h3>${this.escapeHtml(contact.name)}</h3>
                <p>${contact.id}</p>
                <small>${this.escapeHtml(contact.course)}</small>
            </div>
        `;

        contactDiv.addEventListener('click', () => this.openChat(contact));
        return contactDiv;
    }

    async openChat(contact) {
        try {
            // Update UI to show selected contact
            this.selectContact(contact);
            
            // Get or create chat from server
            const response = await fetch(`${this.apiBase}/messages/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(this.currentUser)
                },
                body: JSON.stringify({
                    contactId: contact.id,
                    course: contact.course
                })
            });

            if (!response.ok) {
                throw new Error('Failed to open chat');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to open chat');
            }

            this.currentChat = data.chat;
            
            // Load messages
            await this.loadChatMessages(data.chat);
            
            // Enable input
            this.enableChatInput();
            
            // Update chat header
            this.updateChatHeader(contact);
            
            // Update block button state
            this.updateBlockButtonState(contact.id);
            
            console.log('Chat opened:', contact);
        } catch (error) {
            console.error('Failed to open chat:', error);
            this.showNotification('Failed to open chat', 'error');
        }
    }

    async loadChatMessages(chat) {
        this.clearChatMessages();
        
        if (!chat.messages || chat.messages.length === 0) {
            this.showEmptyChatState();
            return;
        }

        const messagesContainer = this.elements.chatMessages;
        const chatHistory = document.createElement('div');
        chatHistory.className = 'chat-history';

        chat.messages.forEach((message, index) => {
            const messageElement = this.createMessageElement(message, index);
            chatHistory.appendChild(messageElement);
        });

        messagesContainer.appendChild(chatHistory);
        this.scrollToBottom();
    }

    createMessageElement(message, index) {
        const isOwnMessage = message.senderId === this.currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-bubble ${isOwnMessage ? 'sent' : 'received'}`;
        messageDiv.setAttribute('data-message-id', message.id);
        messageDiv.setAttribute('data-index', index);
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            ${message.forwardedFrom ? '<div class="forwarded-indicator"><i class="fas fa-share"></i> Forwarded</div>' : ''}
            <div class="message-text">${this.escapeHtml(message.text)}</div>
            <div class="message-timestamp">${timestamp}</div>
        `;

        messageDiv.addEventListener('click', () => this.selectMessage(message, messageDiv));
        return messageDiv;
    }

    async sendMessage() {
        if (!this.currentChat) {
            this.showNotification('Please select a contact to chat with', 'error');
            return;
        }

        const input = this.elements.replyInput || this.legacyElements.legacyReplyInput;
        const text = input.value.trim();

        if (!text) {
            return;
        }

        try {
            // Disable send button and show loading
            this.setSendButtonLoading(true);

            // Send message to server
            const response = await fetch(`${this.apiBase}/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(this.currentUser)
                },
                body: JSON.stringify({
                    chatId: this.currentChat.id,
                    text: text
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to send message');
            }

            // Update current chat
            this.currentChat = data.chat;
            
            // Clear input
            input.value = '';
            
            // Add message to UI
            this.addMessageToUI(data.message);
            
            // Scroll to bottom
            this.scrollToBottom();
            
            console.log('Message sent successfully');
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showNotification('Failed to send message', 'error');
        } finally {
            this.setSendButtonLoading(false);
        }
    }

    addMessageToUI(message) {
        const messagesContainer = this.elements.chatMessages;
        let chatHistory = messagesContainer.querySelector('.chat-history');
        
        if (!chatHistory) {
            // Remove empty state if present
            messagesContainer.innerHTML = '';
            chatHistory = document.createElement('div');
            chatHistory.className = 'chat-history';
            messagesContainer.appendChild(chatHistory);
        }

        const messageElement = this.createMessageElement(message, chatHistory.children.length);
        chatHistory.appendChild(messageElement);
    }

    async deleteMessage() {
        if (!this.selectedMessage) {
            this.showNotification('Please select a message to delete', 'error');
            return;
        }

        if (this.selectedMessage.senderId !== this.currentUser.id) {
            this.showNotification('You can only delete your own messages', 'error');
            return;
        }

        try {
            const response = await fetch(
                `${this.apiBase}/messages/${this.currentChat.id}/${this.selectedMessage.id}`, 
                {
                    method: 'DELETE',
                    headers: {
                        'x-user': JSON.stringify(this.currentUser)
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to delete message');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to delete message');
            }

            // Remove message from UI
            const messageElement = document.querySelector(`[data-message-id="${this.selectedMessage.id}"]`);
            if (messageElement) {
                messageElement.remove();
            }

            // Update current chat messages
            this.currentChat.messages = this.currentChat.messages.filter(
                m => m.id !== this.selectedMessage.id
            );

            this.selectedMessage = null;
            this.updateActionButtons();
            this.showNotification('Message deleted successfully', 'success');
        } catch (error) {
            console.error('Failed to delete message:', error);
            this.showNotification(error.message || 'Failed to delete message', 'error');
        }
    }

    async forwardMessage() {
        if (!this.selectedMessage) {
            this.showNotification('Please select a message to forward', 'error');
            return;
        }

        // Show forward modal
        this.showForwardModal();
    }

    async toggleBlockUser() {
        if (!this.currentChat) {
            return;
        }

        const contactId = this.currentChat.participants.find(p => p !== this.currentUser.id);
        const isBlocked = this.blockedUsers.has(contactId);

        try {
            if (isBlocked) {
                // Unblock user
                const response = await fetch(`${this.apiBase}/messages/block/${contactId}`, {
                    method: 'DELETE',
                    headers: {
                        'x-user': JSON.stringify(this.currentUser)
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to unblock user');
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to unblock user');
                }

                this.blockedUsers.delete(contactId);
                this.elements.blockBtn.innerHTML = '<i class="fas fa-ban"></i> Block';
                this.showNotification('User unblocked successfully', 'success');
            } else {
                // Block user
                const response = await fetch(`${this.apiBase}/messages/block`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user': JSON.stringify(this.currentUser)
                    },
                    body: JSON.stringify({
                        blockedId: contactId
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to block user');
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to block user');
                }

                this.blockedUsers.add(contactId);
                this.elements.blockBtn.innerHTML = '<i class="fas fa-user-check"></i> Unblock';
                this.showNotification('User blocked successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to toggle block:', error);
            this.showNotification(error.message || 'Failed to update block status', 'error');
        }
    }

    async loadBlockedUsers() {
        try {
            const response = await fetch(`${this.apiBase}/messages/blocked`, {
                headers: {
                    'x-user': JSON.stringify(this.currentUser)
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.blockedUsers = new Set(data.blocked || []);
                }
            }
        } catch (error) {
            console.error('Failed to load blocked users:', error);
        }
    }

    // UI Helper Methods
    selectContact(contact) {
        // Remove active class from all contacts
        document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
        
        // Add active class to selected contact
        const contactElement = document.querySelector(`[data-id="${contact.id}"]`);
        if (contactElement) {
            contactElement.classList.add('active');
        }
    }

    selectMessage(message, element) {
        // Remove selected class from all messages
        document.querySelectorAll('.message-bubble').forEach(m => m.classList.remove('selected'));
        
        // Add selected class to clicked message
        element.classList.add('selected');
        this.selectedMessage = message;
        
        this.updateActionButtons();
    }

    updateActionButtons() {
        const hasSelectedMessage = this.selectedMessage !== null;
        const isOwnMessage = this.selectedMessage && this.selectedMessage.senderId === this.currentUser.id;

        if (this.elements.forwardBtn) {
            this.elements.forwardBtn.disabled = !hasSelectedMessage;
        }

        if (this.elements.deleteBtn) {
            this.elements.deleteBtn.disabled = !hasSelectedMessage || !isOwnMessage;
        }
    }

    updateBlockButtonState(contactId) {
        if (!this.elements.blockBtn) return;
        
        const isBlocked = this.blockedUsers.has(contactId);
        this.elements.blockBtn.innerHTML = isBlocked 
            ? '<i class="fas fa-user-check"></i> Unblock'
            : '<i class="fas fa-ban"></i> Block';
    }

    enableChatInput() {
        if (this.elements.replyInput) {
            this.elements.replyInput.disabled = false;
        }
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = false;
        }
        if (this.legacyElements.legacyReplyInput) {
            this.legacyElements.legacyReplyInput.disabled = false;
        }
        if (this.legacyElements.legacySendBtn) {
            this.legacyElements.legacySendBtn.disabled = false;
        }
    }

    updateChatHeader(contact) {
        if (this.elements.chatUserDetails) {
            this.elements.chatUserDetails.innerHTML = `
                <h3>${this.escapeHtml(contact.name)}</h3>
                <p>${contact.id} • ${this.escapeHtml(contact.course)}</p>
            `;
        }

        if (this.elements.chatUserAvatar) {
            // Remove "(Instructor)" or "(Student)" from name for initials
            const cleanName = contact.name.replace(/\s*\([^)]*\)/g, '');
            const names = cleanName.split(' ').filter(name => name.length > 0);
            
            let initials;
            if (names.length >= 2) {
                initials = `${names[0][0]}${names[names.length - 1][0]}`;
            } else if (names.length === 1) {
                initials = names[0].substring(0, 2);
            } else {
                initials = cleanName.substring(0, 2);
            }
            
            this.elements.chatUserAvatar.textContent = initials.toUpperCase();
        }
    }

    showEmptyState() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to Messages</h3>
                    <p>Select a contact from the sidebar to start chatting</p>
                </div>
            `;
        }
    }

    showEmptyChatState() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Start the conversation by sending a message</p>
                </div>
            `;
        }
    }

    clearContacts() {
        if (this.elements.contactsList) {
            this.elements.contactsList.innerHTML = '';
        }
    }

    clearChatMessages() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
    }

    showCourseFilter(courses, selectedCourse) {
        if (this.elements.courseFilter) {
            this.elements.courseFilter.style.display = 'block';
            this.elements.courseFilter.innerHTML = `
                <option disabled ${!selectedCourse ? 'selected' : ''}>Filter By Course</option>
                ${courses.map(course => 
                    `<option value="${this.escapeHtml(course)}" ${course === selectedCourse ? 'selected' : ''}>${this.escapeHtml(course)}</option>`
                ).join('')}
            `;
        }
    }

    hideCourseFilter() {
        if (this.elements.courseFilter) {
            this.elements.courseFilter.style.display = 'none';
        }
    }

    showNoCoursesMessage() {
        this.clearContacts();
        if (this.elements.contactsList) {
            this.elements.contactsList.innerHTML = `
                <div class="contact">
                    <div class="details">
                        <h3>No courses found</h3>
                        <p>Please enroll in a course to start messaging</p>
                    </div>
                </div>
            `;
        }
    }

    showNoContactsMessage() {
        if (this.elements.contactsList) {
            this.elements.contactsList.innerHTML = `
                <div class="contact">
                    <div class="details">
                        <h3>No contacts found</h3>
                        <p>No one is enrolled in this course yet</p>
                    </div>
                </div>
            `;
        }
    }

    setSendButtonLoading(loading) {
        const sendBtn = this.elements.sendBtn || this.legacyElements.legacySendBtn;
        if (sendBtn) {
            if (loading) {
                sendBtn.innerHTML = '<span class="loading"></span> Sending...';
                sendBtn.disabled = true;
            } else {
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
                sendBtn.disabled = false;
            }
        }
    }

    scrollToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    // Real-time updates
    startRealTimeUpdates() {
        this.refreshInterval = setInterval(() => {
            if (this.currentChat) {
                this.refreshChat();
            }
        }, 3000); // Refresh every 3 seconds
    }

    async refreshChat() {
        if (!this.currentChat) return;
        
        try {
            const response = await fetch(`${this.apiBase}/messages/chat/${this.currentChat.id}`, {
                headers: {
                    'x-user': JSON.stringify(this.currentUser)
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.chat.messages.length !== this.currentChat.messages.length) {
                    this.currentChat = data.chat;
                    await this.loadChatMessages(data.chat);
                }
            }
        } catch (error) {
            console.error('Failed to refresh chat:', error);
        }
    }

    // Utility methods
    showNotification(message, type = 'success') {
        // Use the notification system from the HTML if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#28a745' : '#dc3545'};
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                z-index: 10000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    redirectToLogin() {
        alert('Please log in to access messages.');
        window.location.href = '/HTML/login.html';
    }

    // Event handlers
    async onCourseFilterChange() {
        const selectedCourse = this.elements.courseFilter.value;
        if (selectedCourse && selectedCourse !== 'Filter By Course') {
            try {
                await this.loadContacts(selectedCourse);
                
                // Clear current chat
                this.currentChat = null;
                this.showEmptyState();
            } catch (error) {
                console.error('Failed to load contacts for course:', error);
                this.showNotification('Failed to load contacts for selected course', 'error');
            }
        }
    }

    // Modal methods
    showForwardModal() {
        // Implementation for forward modal
        this.showNotification('Forward feature coming soon', 'info');
    }

    // Cleanup
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize messaging system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    
    if (!loggedInUser) {
        alert('Please log in to access messages.');
        window.location.href = '/HTML/login.html';
        return;
    }
    
    // Check if user is a student or teacher
    if (loggedInUser.type !== 'student' && loggedInUser.type !== 'teacher') {
        alert('Messages are only available for students and teachers.');
        if (loggedInUser.type === 'admin') {
            window.location.href = '/HTML/adminIndex.html';
        } else {
            window.location.href = '/HTML/login.html';
        }
        return;
    }
    
    // Initialize the messaging system
    window.messagingSystem = new MessagingSystem();
});

// Export for global access
window.MessagingSystem = MessagingSystem;