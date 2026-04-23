# 🤖 Responsive Custom AI Chatbot App (React + Vite)

A web-based AI chatbot built with **React** and **Vite**, using a custom API endpoint named `SJxAI` for AI responses and an API key for authentication.

---

## 📌 Features

- Real-time chat interface
- Uses custom AI endpoint
- Secure API communication with API key
- Fast development with Vite
- Responsive and clean UI
- Easy to extend and customize

---

## 📦 Project Setup

### 🛠 Prerequisites

- Node.js (v16+)
- npm or yarn (recommended)

### 🚀 Installation

```
npm install
```
or
```
yarn install
```


### 🧪 Development

```
npm run dev
```
or
```
yarn dev
```


This starts the development server at `http://localhost:5173`.

---

## 🤖 How It Works

- The chatbot sends user input to your API endpoint.
- The API processes the input and returns a response.
- The response is displayed in the chat interface.
- API key is used for authentication and is stored securely (e.g., in `.env` file).

---

## 🔒 API Configuration

Make sure to set your API key and endpoint and the Model name in the `.env` file:

```
VITE_API_KEY=your_api_key_here
VITE_API_ENDPOINT=your_ednpoint_here
VITE_AI_MODEL=your_model_name
```

> ⚠️ **Note**: Never commit your `.env` file to version control. Use `.env.example` for reference.
