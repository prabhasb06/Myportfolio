# Prabhas Bangarugari — portfolio

Buildless HTML, CSS, and JavaScript. This directory is the editable source and Git repository; it is not disposable generated output. No npm installation is needed.

## Edit

- `index.html`: portfolio copy, destinations, project compositions, and engineering notes.
- `styles.css`: shared design tokens and responsive composition.
- `script.js`: hero renderer, `HERO_MOTION` tuning, navigation, reveals, and the interface viewer.
- `interactions.js` / `.css`: shared press/hover feedback, section entrances, and disclosure motion across desktop and touch screens.
- `experience-init.js`: refresh-aware entrance decision before paint, with a fail-open timeout.
- `experience.js` / `.css`: repeatable entrance, coordinated hero handoff, and compact mouse-only cursor across home and project previews.
- `atelier.css`: the shared editorial refinement for navigation, hero, project layouts, approach illustrations, About, Contact, and preview diagrams.
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

On touch screens, press and drag across the hero to explore the field and reveal natural portrait colors. Vertical gestures still scroll and pinch zoom remains available. Project cards respond to presses, engineering details and approach connections open on tap, and preview diagrams accept horizontal swipes or the Next Stage button. Reduced motion keeps the content and controls usable without animated movement.

The entrance appears on every home-page refresh, including refreshes at section anchors. Enter, Skip intro, or Escape all reach the portfolio. Direct links to section hashes bypass it on initial navigation. The three-second opening assembles a custom PB monogram from twelve batched vector paths. Continuous champagne highlights follow the contours, overlapping light passages travel through the mark, and fine background currents continue after the opening settles. These CSS/SVG animations pause when hidden and stop when the entrance is removed. Reduced motion presents a static composition. The text and five-second portrait reveal begin during the last translucent half of the entrance transition. JavaScript failure leaves the native dialog closed and the main page usable.

Mouse input enables a precise ivory point and one thin champagne ring. The point tracks input immediately; the ring follows with at most ten pixels of lag and stops requesting frames after settling. It expands over controls and briefly compresses on activation. Touch, keyboard, text selection, hidden pages, and closed dialogs restore the native cursor. Context labels are limited to meaningful actions. The hero uses a coordinated copper/champagne/slate palette in both GPU and bounded canvas fallback rendering; localized portrait reveal retains the actual photo colors. A soft background veil protects the copy without putting the portrait in a separate panel.
