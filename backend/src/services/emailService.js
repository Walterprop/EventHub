const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.setupTransporter();
  }

  setupTransporter() {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.warn('⚠️ Email configuration missing. Email service disabled.');
      return;
    }

    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verificare connessione
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Errore configurazione email:', error);
      } else {
        console.log('✅ Email service pronto');
      }
    });
  }

  async sendPasswordReset(email, resetToken) {
    if (!this.transporter) {
      throw new Error('Email service non configurato');
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'EventHub - Reset Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Password - EventHub</h2>
          <p>Hai richiesto il reset della tua password.</p>
          <p>Clicca sul link sottostante per reimpostare la password:</p>
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
          <p style="margin-top: 20px; color: #666;">
            Se non hai richiesto questo reset, ignora questa email.<br>
            Il link scadrà tra 1 ora.
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            EventHub Team<br>
            Questa è una email automatica, non rispondere.
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email reset password inviata:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Errore invio email reset:', error);
      throw error;
    }
  }

  async sendEventApproved(email, eventTitle) {
    if (!this.transporter) {
      throw new Error('Email service non configurato');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'EventHub - Evento Approvato',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">🎉 Evento Approvato!</h2>
          <p>Il tuo evento "<strong>${eventTitle}</strong>" è stato approvato ed è ora pubblico.</p>
          <p>Gli utenti possono ora visualizzarlo e iscriversi.</p>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Vai alla Dashboard
          </a>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            EventHub Team<br>
            Questa è una email automatica, non rispondere.
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email approvazione evento inviata:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Errore invio email approvazione:', error);
      throw error;
    }
  }

  async sendEventRejected(email, eventTitle, reason) {
    if (!this.transporter) {
      throw new Error('Email service non configurato');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'EventHub - Evento Rifiutato',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">❌ Evento Rifiutato</h2>
          <p>Il tuo evento "<strong>${eventTitle}</strong>" è stato rifiutato.</p>
          ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
          <p>Puoi modificare l'evento e riprovare oppure contattare il supporto per maggiori informazioni.</p>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Vai alla Dashboard
          </a>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            EventHub Team<br>
            Questa è una email automatica, non rispondere.
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email rifiuto evento inviata:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Errore invio email rifiuto:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email, name) {
    if (!this.transporter) {
      throw new Error('Email service non configurato');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Benvenuto in EventHub!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007bff;">🎉 Benvenuto in EventHub, ${name}!</h2>
          <p>Grazie per esserti registrato alla nostra piattaforma.</p>
          <p>Con EventHub puoi:</p>
          <ul>
            <li>Creare e gestire i tuoi eventi</li>
            <li>Partecipare agli eventi di altri utenti</li>
            <li>Chattare con gli altri partecipanti</li>
            <li>Ricevere notifiche in tempo reale</li>
          </ul>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Inizia Subito
          </a>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            EventHub Team<br>
            Questa è una email automatica, non rispondere.
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email benvenuto inviata:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Errore invio email benvenuto:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();