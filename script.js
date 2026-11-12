(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wideQuery = window.matchMedia("(min-width: 861px)");

  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const motionOn = () => !reduceQuery.matches;
  const railMode = () => wideQuery.matches && motionOn();

  root.classList.toggle("motion", motionOn());

  /* ---------- Préparation du texte : le HTML reste lisible sans script ---------- */

  // Le nom : une lettre par <span>, pour l'entrée en scène
  const name = document.querySelector(".name");
  if (name) {
    name.setAttribute("aria-label", "Williams Aoussi");
    let index = 0;
    name.querySelectorAll(".line").forEach((line) => {
      const text = line.textContent.trim();
      line.textContent = "";
      for (const letter of text) {
        const span = document.createElement("span");
        span.className = "ch";
        span.setAttribute("aria-hidden", "true");
        span.textContent = letter;
        span.style.setProperty("--i", index++);
        line.appendChild(span);
      }
    });
  }

  // La phrase d'ouverture : un <span> par mot
  const statement = document.querySelector("[data-words]");
  if (statement) {
    const words = statement.textContent.trim().split(/\s+/);
    statement.textContent = "";
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = word;
      span.style.setProperty("--i", i);
      statement.appendChild(span);
      statement.appendChild(document.createTextNode(" "));
    });
    statement.style.setProperty("--n", words.length);
  }

  // Le parcours : un numéro d'ordre par étape
  const steps = document.querySelector(".steps");
  if (steps) {
    const items = [...steps.querySelectorAll(".step")];
    items.forEach((item, i) => item.style.setProperty("--k", i));
    steps.style.setProperty("--n", items.length);
  }

  /* ---------- Mesures qui dépendent de la fenêtre ---------- */

  const track = document.querySelector(".track");
  const rail = document.querySelector(".rail");

  function fitName() {
    const pin = name && name.closest(".pin");
    if (!pin) return;
    const probe = document.createElement("span");
    probe.className = "fit-probe";
    probe.setAttribute("aria-hidden", "true");
    probe.textContent = "Williams";
    document.body.appendChild(probe);
    const widest = probe.getBoundingClientRect().width;
    probe.remove();
    if (!widest) return;

    const style = getComputedStyle(pin);
    const available = pin.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const byWidth = (100 * available * 0.985) / widest;
    const byHeight = window.innerHeight * 0.4;
    root.style.setProperty("--name-size", Math.min(byWidth, byHeight, 280).toFixed(1) + "px");
  }

  function layout() {
    root.classList.toggle("motion", motionOn());
    if (track && rail) {
      const pin = track.querySelector(".pin");
      const width = pin.clientWidth;
      root.style.setProperty("--pw", width + "px");
      const shift = railMode() ? Math.max(0, rail.children.length - 1) * width : 0;
      track.style.setProperty("--shift", shift);
    }
    fitName();
  }

  /* ---------- Pilotes : chaque pilote calcule une valeur entre 0 et 1 puis l'applique ---------- */

  const drivers = [];
  const addDriver = (compute, apply) => drivers.push({ compute, apply, current: null, last: null });

  const pinProgress = (el) => () => {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
  };
  const setP = (el) => (value) => el.style.setProperty("--p", value.toFixed(4));

  // Scènes épinglées : nom, phrase, rail horizontal
  document.querySelectorAll('[data-scene="pin"], [data-scene="rail"]').forEach((el) => {
    addDriver(pinProgress(el), setP(el));
  });

  // Parcours : la ligne se trace pendant que la section traverse l'écran
  document.querySelectorAll('[data-scene="flow"]').forEach((el) => {
    addDriver(() => {
      const r = el.getBoundingClientRect();
      return clamp((window.innerHeight * 0.7 - r.top) / (r.height * 0.9));
    }, setP(el));
  });

  // Compétences : une famille à la fois
  document.querySelectorAll('[data-scene="steps"]').forEach((el) => {
    const groups = [...el.querySelectorAll(".grp")];
    addDriver(pinProgress(el), (value) => {
      setP(el)(value);
      const active = Math.min(groups.length - 1, Math.floor(value * groups.length));
      groups.forEach((group, i) => {
        group.classList.toggle("is-on", i === active);
        group.classList.toggle("is-past", i < active);
      });
    });
  });

  // Panneaux de projets : chacun possède sa propre progression d'arrivée
  const HEX = "0123456789abcdef";
  const formatters = new Map();
  const format = (decimals) => {
    if (!formatters.has(decimals)) {
      formatters.set(
        decimals,
        new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      );
    }
    return formatters.get(decimals);
  };

  function scramble(final, value) {
    const chars = [...final];
    const total = chars.filter((c) => c !== " " && c !== "\n").length;
    const window = 6;
    const front = value * (total + window);
    let seen = 0;
    return chars
      .map((c) => {
        if (c === " " || c === "\n") return c;
        const position = seen++;
        if (position < front - window) return c;
        if (position < front) return HEX[(Math.random() * 16) | 0];
        return " ";
      })
      .join("");
  }

  function applyPanel(panel, value) {
    const eased = ease(value);
    panel.style.setProperty("--q", value.toFixed(4));
    panel.style.setProperty("--e", eased.toFixed(4));
    panel.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.to);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      el.textContent = format(decimals).format(target * eased);
    });
    panel.querySelectorAll("[data-cipher]").forEach((el) => {
      el.textContent = value >= 0.999 ? el.dataset.cipher : scramble(el.dataset.cipher, value);
    });
  }

  document.querySelectorAll(".panel").forEach((panel) => {
    addDriver(() => {
      const r = panel.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      if (railMode() && track) {
        const centre = r.left + r.width / 2;
        const sideways = clamp((vw * 1.3 - centre) / (vw * 0.8));
        const entering = clamp((vh - track.getBoundingClientRect().top) / (vh * 0.9));
        return Math.min(sideways, entering);
      }
      return clamp((vh * 0.95 - r.top) / (vh * 0.6));
    }, (value) => applyPanel(panel, value));
  });

  // Navigation au clavier : quand un lien d'un projet reçoit le focus, on amène le rail jusqu'à lui
  document.querySelectorAll(".panel").forEach((panel, i, all) => {
    panel.addEventListener("focusin", () => {
      if (!railMode() || !track) return;
      const shift = parseFloat(track.style.getPropertyValue("--shift")) || 0;
      const top = track.getBoundingClientRect().top + window.scrollY;
      const target = top + (all.length > 1 ? (i / (all.length - 1)) * shift : 0);
      window.scrollTo({ top: target, behavior: "instant" });
      track.querySelector(".pin").scrollLeft = 0;
    });
  });

  /* ---------- Boucle d'animation : lissage des valeurs, uniquement quand c'est utile ---------- */

  const bar = document.querySelector(".progress span");
  let queued = false;

  function frame() {
    queued = false;
    let moving = false;

    for (const driver of drivers) {
      const target = motionOn() ? driver.compute() : 1;
      if (driver.current === null) driver.current = target;
      const gap = target - driver.current;
      if (Math.abs(gap) > 0.0004) {
        driver.current += gap * 0.16;
        moving = true;
      } else {
        driver.current = target;
      }
      if (driver.current !== driver.last) {
        driver.apply(driver.current);
        driver.last = driver.current;
      }
    }

    if (bar) {
      const scrollable = root.scrollHeight - window.innerHeight;
      bar.style.setProperty("--scroll", scrollable > 0 ? clamp(window.scrollY / scrollable).toFixed(4) : 0);
    }
    if (moving) request();
  }

  function request() {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(frame);
    }
  }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", () => { layout(); request(); });
  wideQuery.addEventListener("change", () => { layout(); request(); });
  reduceQuery.addEventListener("change", () => { layout(); request(); });

  layout();
  frame();

  // Les polices changent la taille du texte : on remesure quand elles sont prêtes
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { layout(); request(); });
  }
  window.addEventListener("load", () => {
    layout();
    request();
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
    }
  });
})();
