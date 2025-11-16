# EventHub API 🎉

API REST per la gestione di eventi con sistema di approvazione admin, notifiche real-time e chat.

## 🚀 Features

- ✅ Autenticazione JWT
- 👥 Gestione utenti e ruoli (user/admin)
- 📅 CRUD eventi con approvazione admin
- 🔔 Notifiche real-time con Socket.io
- 💬 Chat per eventi
- 📊 Dashboard admin
- 🗄️ MongoDB Atlas
- 📚 Documentazione Swagger

## 🛠️ Stack Tecnologico

- **Backend**: Node.js + Express
- **Database**: MongoDB Atlas
- **Real-time**: Socket.io
- **Auth**: JWT + bcryptjs
- **Validation**: express-validator
- **API Docs**: Swagger (swagger-ui-express)

## 📦 Installazione Locale

```bash
# Installa dipendenze
cd backend
npm install

# Configura .env
cp .env.example .env
# Modifica MONGODB_URI e JWT_SECRET

# Avvia server
npm run dev
```

## 🔑 Account di Test

### 👤 Utente
- Email: `mario.rossi@example.com`
- Password: `User123`

### 👨‍💼 Admin
- Email: `pepocavaliere@gmail.com`
- Password: `Password123`

## 📖 API Documentation

Una volta avviato il server, accedi alla documentazione Swagger:
```
http://localhost:5000/api-docs
```

## 🌐 Deploy su Render

1. Push su GitHub
2. Crea nuovo Web Service su [Render](https://render.com)
3. Connetti il repository
4. Configura:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node backend/src/server.js`
5. Aggiungi variabili d'ambiente:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `PORT` (auto-configurato da Render)
   - `NODE_ENV=production`

## 📁 Struttura Progetto

```
EventHub/
├── backend/
│   ├── src/
│   │   ├── config/         # Configurazioni (DB, Swagger)
│   │   ├── controllers/    # Logica business
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API routes
│   │   ├── utils/          # Utilities
│   │   ├── app.js          # Express app
│   │   └── server.js       # Entry point
│   ├── .env.example
│   └── package.json
├── render.yaml
└── README.md
```

## 🔗 Endpoints Principali

### Auth
- `POST /api/auth/register` - Registrazione
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Profilo utente

### Events
- `GET /api/events` - Lista eventi
- `POST /api/events` - Crea evento
- `GET /api/events/:id` - Dettagli evento
- `POST /api/events/:id/join` - Iscrizione
- `GET /api/events/user/created` - Miei eventi

### Admin
- `GET /api/admin/events/pending` - Eventi da approvare
- `PUT /api/admin/events/:id/approve` - Approva evento
- `PUT /api/admin/events/:id/reject` - Rifiuta evento
- `GET /api/admin/users` - Gestione utenti

### Notifications
- `GET /api/notifications` - Lista notifiche
- `PUT /api/notifications/:id/read` - Marca come letta

### Chat
- `GET /api/chat/events/:id/messages` - Messaggi evento
- `POST /api/chat/events/:id/messages` - Invia messaggio

## 📝 License

MIT
