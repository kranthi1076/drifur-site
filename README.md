# drifur.com

Website for DRIFUR, deployed on Netlify from the `main` branch.

- `index.html`, `privacy.html`, `thanks.html`: site pages
- `drifur-assistant.js`: "Ask DRIFUR" voice shopping assistant widget
- `netlify/functions/drifur-assistant.mjs`: assistant backend; product facts live in its `CONFIG` block
- Needs Netlify environment variable `ANTHROPIC_API_KEY` (set in Netlify, never in this repo)
