<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1LvJ_uoBKDaLoO1AaJBN1MGSkcGXWl9A2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Set the `VITE_WALLETCONNECT_PROJECT_ID` in [.env.local](.env.local):
   - Sign up at https://cloud.walletconnect.com to get your project ID
   - Add it to `.env.local` as `VITE_WALLETCONNECT_PROJECT_ID=your_project_id`
4. Run the app:
   `npm run dev`

## Features

- **RainbowKit Integration**: Latest wallet connection with support for multiple wallets
- **Zama FHE SDK**: FHEVM React template cloned in the `sdk/` folder for FHE-related development
- **Tailwind CSS**: Fully configured with custom theme
