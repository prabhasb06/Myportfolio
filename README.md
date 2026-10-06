# Prabhas Bangarugari — portfolio

Buildless HTML, CSS, and JavaScript. This directory is the editable source and Git repository; it is not disposable generated output. No npm installation is needed.

## Edit

- `index.html`: portfolio copy, destinations, project compositions, and engineering notes.
- `styles.css`: shared design tokens and responsive composition.
- `script.js`: hero renderer, `HERO_MOTION` tuning, navigation, reveals, and the interface viewer.
- `coming-soon.js`: RAG, SLM, and Business Operator content and stage interactions.
- `coming-soon.html` / `.css`: the shared preview template and styles.
- `assets/`: actual portrait, authentic interface screenshots, illustrative project artwork, social preview, and favicon. Artwork is not presented as an actual product interface.

After updating preview copy/template, run `node scripts/build-previews.cjs`. It generates three complete HTML previews with project-specific titles, descriptions, readable content, and a native-details fallback when JavaScript is disabled. The old `coming-soon.html?project=...` routes remain compatible.

## Local preview

From this directory, run `node scripts/serve.cjs` and open `http://127.0.0.1:4174/`. Pass a different port as the final argument when needed. The server binds only to your computer and returns the designed error page with a real HTTP 404. Open through HTTP so the canvas can safely sample the local photo.

Space Grotesk and DM Mono are served locally. Their OFL licenses are included in `assets/fonts/`. No external font request is needed.

## Before publication

Verify mobile, keyboard navigation, reduced motion, dialog focus return, enlarged localized face reveal, and sustained pointer activity. Verify external destinations. Configure the host's 404 fallback and confirm that it returns HTTP 404. Set absolute canonical and social-image URLs only after confirming the public portfolio domain. No production domain is assumed in this source.

The site sends no analytics and has no simulated contact form. LinkedIn is the contact destination. Social URLs and project destinations are intentionally direct.
