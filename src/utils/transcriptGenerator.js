const fs = require('fs').promises;
const path = require('path');

class TranscriptGenerator {
  /**
   * Generate HTML transcript for a ticket
   * @param {Object} ticket - Ticket object with messages
   * @returns {String} HTML content of transcript
   */
  static generateHTML(ticket) {
    const { ticketId, category, creator, createdAt, closedAt, closedBy, closeReason, messages } = ticket;
    
    const formatDate = (date) => {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };

    const formatTime = (date) => {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };

    const categoryColor = category === 'support' ? '#3b82f6' : '#8b5cf6';
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

    let messagesHTML = '';
    if (messages && messages.length > 0) {
      messagesHTML = messages.map(msg => {
        const avatarUrl = msg.author.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const displayName = msg.author.displayName || msg.author.username;
        const isBot = msg.author.isBot ? '<span class="bot-badge">BOT</span>' : '';
        
        let attachmentsHTML = '';
        if (msg.attachments && msg.attachments.length > 0) {
          attachmentsHTML = msg.attachments.map(att => 
            `<div class="attachment">
              <a href="${att.url}" target="_blank">📎 ${att.name}</a>
            </div>`
          ).join('');
        }

        return `
          <div class="message">
            <img src="${avatarUrl}" alt="${displayName}" class="avatar">
            <div class="message-content">
              <div class="message-header">
                <span class="author-name">${displayName}</span>
                ${isBot}
                <span class="timestamp">${formatTime(msg.timestamp)}</span>
              </div>
              <div class="message-text">${this.escapeHtml(msg.content)}</div>
              ${attachmentsHTML}
            </div>
          </div>
        `;
      }).join('');
    } else {
      messagesHTML = '<div class="no-messages">No messages recorded in this ticket.</div>';
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Transcript - ${ticketId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}dd 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    
    .header .logo {
      width: 50px;
      height: 50px;
      border-radius: 50%;
    }
    
    .ticket-info {
      background: #f8f9fa;
      padding: 25px 30px;
      border-bottom: 2px solid #e9ecef;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .info-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #6c757d;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    
    .info-value {
      font-size: 16px;
      color: #212529;
      font-weight: 500;
    }
    
    .category-badge {
      display: inline-block;
      padding: 4px 12px;
      background: ${categoryColor};
      color: white;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }
    
    .messages-container {
      padding: 30px;
      max-height: 600px;
      overflow-y: auto;
    }
    
    .message {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      transition: background 0.2s;
    }
    
    .message:hover {
      background: #e9ecef;
    }
    
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .message-content {
      flex: 1;
    }
    
    .message-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    
    .author-name {
      font-weight: 600;
      color: #212529;
      font-size: 15px;
    }
    
    .bot-badge {
      background: #5865f2;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    
    .timestamp {
      color: #6c757d;
      font-size: 12px;
      margin-left: auto;
    }
    
    .message-text {
      color: #495057;
      line-height: 1.6;
      word-wrap: break-word;
    }
    
    .attachment {
      margin-top: 10px;
      padding: 8px 12px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      display: inline-block;
    }
    
    .attachment a {
      color: #0d6efd;
      text-decoration: none;
      font-size: 14px;
    }
    
    .attachment a:hover {
      text-decoration: underline;
    }
    
    .no-messages {
      text-align: center;
      color: #6c757d;
      padding: 40px;
      font-size: 16px;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 2px solid #e9ecef;
      color: #6c757d;
      font-size: 14px;
    }
    
    .footer a {
      color: ${categoryColor};
      text-decoration: none;
      font-weight: 600;
    }
    
    .footer a:hover {
      text-decoration: underline;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      .header {
        padding: 20px;
      }
      
      .header h1 {
        font-size: 22px;
      }
      
      .ticket-info {
        padding: 20px;
      }
      
      .messages-container {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <img src="https://opsicos.onrender.com/images/opsicos_circle.avif" alt="Opsicos" class="logo">
        Ticket Transcript
      </h1>
      <p>Opsicos Support System</p>
    </div>
    
    <div class="ticket-info">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Ticket ID</span>
          <span class="info-value">${ticketId}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Category</span>
          <span class="info-value"><span class="category-badge">${categoryName}</span></span>
        </div>
        <div class="info-item">
          <span class="info-label">Created By</span>
          <span class="info-value">${creator.displayName || creator.username}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Created At</span>
          <span class="info-value">${formatDate(createdAt)}</span>
        </div>
        ${closedAt ? `
        <div class="info-item">
          <span class="info-label">Closed By</span>
          <span class="info-value">${closedBy?.displayName || closedBy?.username || 'Unknown'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Closed At</span>
          <span class="info-value">${formatDate(closedAt)}</span>
        </div>
        ` : ''}
        ${closeReason ? `
        <div class="info-item" style="grid-column: 1 / -1;">
          <span class="info-label">Close Reason</span>
          <span class="info-value">${this.escapeHtml(closeReason)}</span>
        </div>
        ` : ''}
      </div>
    </div>
    
    <div class="messages-container">
      ${messagesHTML}
    </div>
    
    <div class="footer">
      <p>Generated by <a href="https://opsicos.onrender.com" target="_blank">Opsicos</a> Ticket System</p>
      <p>© ${new Date().getFullYear()} Opsicos. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Escape HTML special characters
   * @param {String} text 
   * @returns {String}
   */
  static escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Save transcript to file system
   * @param {String} ticketId 
   * @param {String} html 
   * @returns {String} File path
   */
  static async saveToFile(ticketId, html) {
    const transcriptDir = path.join(__dirname, '../../public/transcripts');
    
    // Create directory if it doesn't exist
    try {
      await fs.mkdir(transcriptDir, { recursive: true });
    } catch (err) {
      console.error('Error creating transcript directory:', err);
    }
    
    const fileName = `${ticketId}.html`;
    const filePath = path.join(transcriptDir, fileName);
    
    await fs.writeFile(filePath, html, 'utf8');
    
    return `/transcripts/${fileName}`;
  }
}

module.exports = TranscriptGenerator;