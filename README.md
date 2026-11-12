# Meowto Voice — Voice Studio interface

A mobile-friendly, static GitHub Pages interface for an AI voice-cloning project.

## Files
- `index.html` — page structure and tabs
- `style.css` — responsive dark interface
- `app.js` — navigation, chip counter, script limit, recording/upload, and local libraries

## Publish with GitHub Pages
1. Create a new public GitHub repository.
2. Upload `index.html`, `style.css`, and `app.js` to the repository root.
3. Open **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish the site.

## Current milestone
This is the interface only. The Clone button is intentionally a placeholder until a voice synthesis model is connected. No fake generated audio is created.

## Local data
- Chip balance and small metadata are stored in `localStorage`.
- Uploaded voice sample audio blobs are stored in IndexedDB because audio files are too large and binary for reliable localStorage storage.
- Data is local to the browser/device and can be cleared by clearing site data.
- Browser microphone recording generally requires HTTPS; GitHub Pages provides HTTPS.

## Chip rules
- Starting balance: 100,000
- Cost preview: 1 chip per Unicode character, including spaces and punctuation
- Script limit: 10,000 words
- This first interface previews cost but does not deduct chips until real generation is implemented.
