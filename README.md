# 📊 Data Vista — Student Performance Analytics

Data Vista is a student performance analytics platform designed to help users explore academic performance, understand learning trends, and identify students who may need additional academic support.

The project combines a React-based dashboard with a machine-learning prediction service and optional Supabase integration.

## ✨ Features

- **Student Performance Analytics:** Explore academic performance through a dashboard.
- **AI-Based Predictions:** Connect to a Random Forest model through a FastAPI backend.
- **Risk Insights:** Display predicted grades, confidence scores, trends, and at-risk indicators.
- **Data Visualization:** Present performance insights using charts and dashboard components.
- **Backend Integration:** Connect the frontend with Supabase and API services.
- **Android Support:** Package the web application as an Android app using Capacitor.

> Feature availability may depend on environment configuration and the corresponding backend services.

## 🛠 Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Styling & UI | Tailwind CSS, shadcn/ui, Radix UI |
| Charts | Recharts |
| Routing | React Router |
| Data & Authentication | Supabase |
| Machine Learning API | Python, FastAPI, scikit-learn |
| Android Packaging | Capacitor |
| Deployment | Vercel for frontend; Render or Railway for the ML service |

## 📁 Project Structure

```text
Data-Vista-ds-29-/
├── api/                       # API-related files
├── android/                   # Android project
├── ml_service/                # Machine-learning service
├── public/                    # Static assets
├── src/                       # React application source
├── .env.example               # Environment variable template
├── docs-ai-prediction-system.md
├── MOBILE_APP_SETUP.md
├── supabase-predictions.sql
├── supabase-teacher-states.sql
├── package.json
└── vite.config.ts
```

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Git
- Supabase project credentials if using Supabase-backed features
- Python and pip if running the ML service locally

### 1. Clone the repository

```bash
git clone https://github.com/kartikvermagit-ds/Data-Vista-ds-29-.git
cd Data-Vista-ds-29-
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in the appropriate values for the services you use.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=https://your-vercel-app.vercel.app
VITE_ML_API_URL=http://localhost:8000
```

Use the actual deployed API URL when running against a hosted service. The example values above are placeholders.

**Security:** Never commit real API tokens, service-role keys, passwords, or other secrets. Keep server-only credentials on the server.

### 4. Start the frontend

```bash
npm run dev
```

Vite will display the local development URL in the terminal.

### 5. Build for production

```bash
npm run build
```

To run the configured linter:

```bash
npm run lint
```

## 🤖 Machine Learning Service

The ML service is located in `ml_service/` and is designed to expose prediction endpoints through FastAPI.

```bash
cd ml_service
pip install -r requirements.txt
python scripts/train_model.py
uvicorn app.main:app --reload --port 8000
```

The documented endpoints include:

- `GET /health` — service health check
- `POST /predict` — predict an individual student's outcome
- `POST /predict/batch` — predict outcomes for multiple students

Configure `VITE_ML_API_URL` to point to the running ML service. Model output depends on the available data, training process, and configured implementation.

## 📱 Android App

The project uses Capacitor to package the web application for Android.

```bash
npm run cap:sync
npm run cap:android
```

For further requirements, environment setup, and APK build instructions, see [MOBILE_APP_SETUP.md](MOBILE_APP_SETUP.md).

## 🗄 Supabase Setup

SQL setup scripts are included in the repository:

- `supabase-predictions.sql`
- `supabase-teacher-states.sql`

Review the scripts and configure database access policies before using them in a real environment. Do not expose server-only credentials in frontend code.

## 📚 Documentation

- [AI Prediction System](docs-ai-prediction-system.md)
- [Mobile App Setup](MOBILE_APP_SETUP.md)

## 🧪 Testing and Validation

Before deploying, verify the frontend build, environment variables, API connectivity, and database permissions in your own environment.

```bash
npm run build
npm run lint
```

## 🚀 Deployment

- **Frontend:** Can be deployed to Vercel after configuring the required environment variables.
- **ML API:** Can be deployed to Render or Railway with the required Python dependencies and startup command.
- **Android:** Build and sign a release package using Android Studio.

Deployment requires valid service configuration and has not been verified by this README alone.

## 🤝 Contributing

Contributions, bug reports, and documentation improvements are welcome. For larger changes, open an issue first to discuss the proposed improvement.

## 📄 License

No license is specified here. Check the repository for licensing terms before reusing or distributing this project.
