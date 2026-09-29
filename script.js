document.documentElement.classList.add("js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const header = document.querySelector(".site-header");
const progress = document.querySelector(".scroll-progress span");
let scrollTicking = false;

function updateScrollEffects() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${maxScroll > 0 ? window.scrollY / maxScroll : 0})`;
  header.classList.toggle("is-scrolled", window.scrollY > 30);
  scrollTicking = false;
}

window.addEventListener("scroll", () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(updateScrollEffects);
    scrollTicking = true;
  }
}, { passive: true });
updateScrollEffects();

const hero = document.querySelector(".hero");
const heroField = hero.querySelector(".hero__field");
const fieldContext = heroField.getContext("2d", { alpha: true });
if (fieldContext) {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const pointer = { x: 0, y: 0, nextX: 0, nextY: 0, strength: 0, target: 0 };
  let fieldWidth = 0;
  let fieldHeight = 0;
  let strokes = [];
  let fieldFrame = 0;

  function drawField() {
    fieldContext.clearRect(0, 0, fieldWidth, fieldHeight);
    if (pointer.strength > .01) {
      const glowRadius = Math.min(380, fieldWidth * .42);
      const warmGlow = fieldContext.createRadialGradient(pointer.x - 55, pointer.y + 35, 0, pointer.x - 55, pointer.y + 35, glowRadius);
      warmGlow.addColorStop(0, `rgba(246, 154, 137, ${.31 * pointer.strength})`);
      warmGlow.addColorStop(1, "rgba(246, 154, 137, 0)");
      fieldContext.fillStyle = warmGlow;
      fieldContext.fillRect(pointer.x - glowRadius - 55, pointer.y - glowRadius + 35, glowRadius * 2, glowRadius * 2);

      const coolGlow = fieldContext.createRadialGradient(pointer.x + 115, pointer.y - 75, 0, pointer.x + 115, pointer.y - 75, glowRadius);
      coolGlow.addColorStop(0, `rgba(170, 151, 226, ${.29 * pointer.strength})`);
      coolGlow.addColorStop(1, "rgba(170, 151, 226, 0)");
      fieldContext.fillStyle = coolGlow;
      fieldContext.fillRect(pointer.x - glowRadius + 115, pointer.y - glowRadius - 75, glowRadius * 2, glowRadius * 2);

      const blueGlow = fieldContext.createRadialGradient(pointer.x - 105, pointer.y + 165, 0, pointer.x - 105, pointer.y + 165, glowRadius * .8);
      blueGlow.addColorStop(0, `rgba(124, 185, 214, ${.24 * pointer.strength})`);
      blueGlow.addColorStop(1, "rgba(124, 185, 214, 0)");
      fieldContext.fillStyle = blueGlow;
      fieldContext.fillRect(pointer.x - glowRadius * .8 - 105, pointer.y - glowRadius * .8 + 165, glowRadius * 1.6, glowRadius * 1.6);
    }
    fieldContext.lineWidth = 1.35;
    fieldContext.lineCap = "round";
    for (const stroke of strokes) {
      const dx = stroke.x - pointer.x;
      const dy = stroke.y - pointer.y;
      const distance = Math.hypot(dx, dy);
      const influence = Math.max(0, 1 - distance / 250) ** 2 * pointer.strength;
      const tangent = Math.atan2(dy, dx) + Math.PI / 2;
      const vx = stroke.vx * (1 - influence) + Math.cos(tangent) * influence;
      const vy = stroke.vy * (1 - influence) + Math.sin(tangent) * influence;
      const angle = Math.atan2(vy, vx);
      const length = 7 + influence * 7;
      const offsetX = Math.cos(angle) * length / 2;
      const offsetY = Math.sin(angle) * length / 2;
      const alpha = Math.min(.95, stroke.opacity + influence * .5);
      const px = Math.max(0, Math.min(1, (dx + 230) / 460));
      const py = Math.max(0, Math.min(1, (dy + 230) / 460));
      const activeRed = (249 - 72 * px) * (1 - py) + (108 + 123 * px) * py;
      const activeGreen = (181 - 26 * px) * (1 - py) + (180 - 34 * px) * py;
      const activeBlue = (129 + 99 * px) * (1 - py) + (212 - 46 * px) * py;
      const colorMix = Math.min(1, influence * 2.2);
      const red = Math.round(stroke.red + (activeRed - stroke.red) * colorMix);
      const green = Math.round(stroke.green + (activeGreen - stroke.green) * colorMix);
      const blue = Math.round(stroke.blue + (activeBlue - stroke.blue) * colorMix);
      fieldContext.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
      fieldContext.beginPath();
      fieldContext.moveTo(stroke.x - offsetX, stroke.y - offsetY);
      fieldContext.lineTo(stroke.x + offsetX, stroke.y + offsetY);
      fieldContext.stroke();
    }
  }

  function animateField() {
    fieldFrame = 0;
    pointer.x += (pointer.nextX - pointer.x) * .15;
    pointer.y += (pointer.nextY - pointer.y) * .15;
    pointer.strength += (pointer.target - pointer.strength) * .13;
    drawField();
    const moving = Math.abs(pointer.x - pointer.nextX) + Math.abs(pointer.y - pointer.nextY) > .7;
    if (moving || Math.abs(pointer.strength - pointer.target) > .008) {
      fieldFrame = window.requestAnimationFrame(animateField);
    }
  }

  function requestFieldFrame() {
    if (!fieldFrame) fieldFrame = window.requestAnimationFrame(animateField);
  }

  function sizeField() {
    const bounds = hero.getBoundingClientRect();
    fieldWidth = Math.round(bounds.width);
    fieldHeight = Math.round(bounds.height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    heroField.width = Math.round(fieldWidth * pixelRatio);
    heroField.height = Math.round(fieldHeight * pixelRatio);
    fieldContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    strokes = [];
    const step = fieldWidth < 760 ? 29 : 24;
    for (let y = step / 2; y < fieldHeight; y += step) {
      for (let x = step / 2; x < fieldWidth; x += step) {
        const u = (x - fieldWidth * .74) / fieldWidth;
        const v = (y - fieldHeight * .52) / fieldHeight;
        const angle = Math.atan2(.18 + u * 2.8 + Math.sin(x * .011) * .25, 1 - v * 2.5 + Math.cos(y * .013) * .2);
        const horizontal = x / fieldWidth;
        const vertical = y / fieldHeight;
        const topRed = 220 - 42 * horizontal;
        const topGreen = 155 + 9 * horizontal;
        const topBlue = 168 + 47 * horizontal;
        const bottomRed = 132 + 110 * horizontal;
        const bottomGreen = 162 + 22 * horizontal;
        const bottomBlue = 201 - 65 * horizontal;
        strokes.push({
          x, y,
          vx: Math.cos(angle), vy: Math.sin(angle),
          red: Math.round(topRed * (1 - vertical) + bottomRed * vertical),
          green: Math.round(topGreen * (1 - vertical) + bottomGreen * vertical),
          blue: Math.round(topBlue * (1 - vertical) + bottomBlue * vertical),
          opacity: .39 + .08 * Math.sin(x * .008 + y * .01)
        });
      }
    }
    if (fieldFrame) window.cancelAnimationFrame(fieldFrame);
    fieldFrame = 0;
    drawField();
  }

  hero.addEventListener("pointermove", event => {
    if (!finePointer.matches || reduceMotion.matches || event.pointerType === "touch") return;
    const bounds = hero.getBoundingClientRect();
    pointer.nextX = event.clientX - bounds.left;
    pointer.nextY = event.clientY - bounds.top;
    pointer.target = 1;
    requestFieldFrame();
  }, { passive: true });
  hero.addEventListener("pointerleave", () => {
    pointer.target = 0;
    requestFieldFrame();
  });
  reduceMotion.addEventListener("change", () => {
    pointer.target = 0;
    if (reduceMotion.matches) {
      if (fieldFrame) window.cancelAnimationFrame(fieldFrame);
      fieldFrame = 0;
      pointer.strength = 0;
      drawField();
    }
  });
  if ("ResizeObserver" in window) new ResizeObserver(sizeField).observe(hero);
  else window.addEventListener("resize", sizeField);
  sizeField();
}

const revealNodes = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !reduceMotion.matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -7% 0px", threshold: 0.08 });
  revealNodes.forEach(node => revealObserver.observe(node));
} else {
  revealNodes.forEach(node => node.classList.add("is-visible"));
}

const navLinks = document.querySelectorAll(".desktop-nav a[data-nav]");
if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach(link => link.classList.toggle("is-active", link.dataset.nav === entry.target.id));
    }
  }, { rootMargin: "-28% 0px -62% 0px" });
  ["work", "approach", "about", "contact"].forEach(id => sectionObserver.observe(document.getElementById(id)));
}

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
function setMenu(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  mobileMenu.hidden = !open;
}
menuToggle.addEventListener("click", () => setMenu(menuToggle.getAttribute("aria-expanded") !== "true"));
mobileMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("click", event => {
  if (!mobileMenu.hidden && !header.contains(event.target)) setMenu(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !mobileMenu.hidden) {
    setMenu(false);
    menuToggle.focus();
  }
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 760 && !mobileMenu.hidden) setMenu(false);
});
