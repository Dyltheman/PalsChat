# PalsChat

PalsChat is a private, real-time messaging app for a small friend group. It uses React + Vite on the frontend and Firebase Authentication + Firestore on the backend. The app supports account creation, profile setup, friend requests, private conversations, and real-time messaging between accepted friends.

## Project summary

This repository is already configured as a Vite React app for the frontend and includes Firebase modular SDK setup, Firestore rules, Firestore indexes, and a production build. The app is designed to be deployed as a static site with Firebase Hosting and uses Firestore for persistence.

## Current repository status

The app already includes:

- Email/password sign-in and sign-up
- Persistent login sessions with Firebase Authentication
- Profile creation and editing
- Unique username registration with username normalization
- Friend request creation, acceptance, decline, and cancellation
- Private conversation creation for accepted friends
- Real-time message listeners and message sending
- Dark/light theme support
- Responsive sidebar + chat layout
- Firebase Hosting rewrite for SPA routing

The remaining work that must be completed in your Firebase project console is the actual environment config and deployment, because public Firebase values cannot be committed or guessed.

## Required Firebase configuration

Before running the app locally or deploying it, create a Firebase web app in the Firebase console for project `palschat-4799e` and copy the public config values into a local `.env` file.

Example:

```bash
cp .env.example .env
```

Then fill in values in `.env`:

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=palschat-4799e
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Important:

- Never commit `.env` files.
- The project uses the Firebase client SDK, not a secret backend credential.
- The Firebase web config is public by design, but the Firestore security rules still protect user data.

Also enable these Firebase Authentication providers in the console:

- Email/Password
- Phone (optional for v1; do not advertise it as working unless configured and tested)

Add your deployed app domain to Authentication > Settings > Authorized domains.

## Local development

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev -- --host 0.0.0.0
```

The app will be served from the Vite dev server and will read configuration from `.env`.

## Firestore rules and indexes

The repo already includes:

- [firestore.rules](firestore.rules)
- [firestore.indexes.json](firestore.indexes.json)

Deploy them with:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If Firebase CLI is not installed yet:

```bash
npm install -g firebase-tools
firebase login
```

Then initialize the project if needed:

```bash
firebase use palschat-4799e
```

## Deployment to Firebase Hosting

Build the production bundle:

```bash
npm run build
```

Then deploy:

```bash
firebase deploy --only hosting
```

This repo already includes a Hosting configuration in [firebase.json](firebase.json) that rewrites all routes to `/index.html` for SPA support.

## Firebase app domain setup

After deployment, add the host domain to Firebase Authentication:

1. Open Firebase Console
2. Go to Authentication > Settings > Authorized domains
3. Add the deployed domain (for example `your-project.web.app` or `your-project.firebaseapp.com`)
4. Save the setting

## How to test the app

### 1. Create an account

- Sign up with an email/password
- Complete the profile setup
- Choose a unique username

### 2. Test password reset

- Click Forgot password
- Enter the account email
- Confirm the reset email arrives

### 3. Test friend requests

- Sign in as two different accounts
- Search for the other user by username
- Send a request
- Accept the request from the other account

### 4. Test private messaging

- Open the conversation from a confirmed friend
- Send a text message from account A
- Verify account B receives it in real time
- Refresh and sign back in to confirm persistence

### 5. Test unauthorized access

- Sign in as a third account
- Try to access a private conversation by direct Firestore action or console query
- Confirm the Firestore rules reject unauthorized reads and writes

### 6. Test local build

```bash
npm run build
```

This verifies the app compiles for production.

## Implementation checklist

Completed:

- React/Vite foundation
- Firebase config pattern
- Firebase auth flows
- Profile creation/editing
- Friend request system
- Mutual friendship model
- Conversation creation and message sending
- Real-time listeners
- Light/dark theme
- Mobile-friendly layout
- Production build

Manual/console-required items:

- Actual Firebase project values in `.env`
- Firebase Authentication providers enabled in the console
- Authorized domains configured
- Firestore rules and indexes deployed
- Hosting deployment completed

## Important notes

- The app intentionally does not claim end-to-end encryption.
- Only accepted friends can start a private conversation.
- The Firestore security rules prevent unauthorized reads and writes.
- No Base44 runtime APIs or Base44-specific dependencies are used.

## Production security reminder

The frontend code is not a substitute for backend security. Firestore rules and Firebase Authentication configuration must be completed in the Firebase console and deployed before the app is used publicly.
