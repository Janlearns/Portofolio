/* Cinematic motion layer: preloader, custom cursor, 3D hero scene, floating gallery,
   split-text reveals, scramble labels, magnetic buttons, scroll velocity.
   Everything here is progressive — without GSAP/Three the page keeps its CSS fade-ins. */
(function () {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = !!window.gsap && !reducedMotion;

  // ══════════════════════════════════════════════════════════
  // HELPERS — split text into masked chars, scramble text
  // ══════════════════════════════════════════════════════════
  function splitChars(el) {
    const lines = el.innerHTML.split(/<br\s*\/?>/i).map((line) => line.replace(/<[^>]+>/g, "").trim());
    el.setAttribute("aria-label", lines.join(" "));
    el.innerHTML = lines
      .map((line) => {
        const words = line.split(/\s+/).map(
          (word) =>
            `<span class="split-word">${[...word]
              .map((char) => `<span class="split-char">${char}</span>`)
              .join("")}</span>`,
        );
        return `<span class="split-line" aria-hidden="true">${words.join(" ")}</span>`;
      })
      .join("");
    return el.querySelectorAll(".split-char");
  }

  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/—_*#";
  function scramble(el, duration = 900) {
    const target = el.dataset.text || (el.dataset.text = el.textContent);
    const start = performance.now();
    (function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const settled = Math.floor(target.length * progress);
      el.textContent = [...target]
        .map((char, i) =>
          i < settled || char === " " ? char : glyphs[(Math.random() * glyphs.length) | 0],
        )
        .join("");
      if (progress < 1) requestAnimationFrame(tick);
    })(start);
  }

  // ══════════════════════════════════════════════════════════
  // FLOATING PROJECT GALLERY (hero)
  // ══════════════════════════════════════════════════════════
  const gallery = document.getElementById("floatingGallery");
  if (gallery) {
    portfolios
      .filter((item) => item.image)
      .slice(0, 6)
      .forEach((item, i) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `float-card float-card--${i + 1}`;
        card.dataset.cursor = "Open";
        card.setAttribute("aria-label", `Open ${item.title}`);
        card.innerHTML = `
          <img src="${ProjectData.escape(item.image)}" alt="" loading="${i > 2 ? "lazy" : "eager"}">
          <span class="float-card-index">${String(i + 1).padStart(2, "0")}</span>
          <span class="float-card-label">${ProjectData.escape(item.category)}</span>`;
        card.addEventListener("click", () => openProjectModal(portfolios.indexOf(item)));
        gallery.appendChild(card);
      });
  }

  // ══════════════════════════════════════════════════════════
  // THREE.JS HERO SCENE — floating planes + particles that react to the cursor
  // ══════════════════════════════════════════════════════════
  const hero = document.getElementById("hero");
  const host = document.getElementById("heroScene");
  if (host && window.THREE) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 12);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    const planes = [];
    [
      [-4.7, 1.9, -1.8, -0.22], [3.8, 2.4, -2.4, 0.24], [-3.7, -1.5, -0.4, 0.15],
      [4.2, -1.2, -1.2, -0.19], [1.9, 3.1, -3.8, 0.12], [-1.8, -2.8, -2.8, -0.14],
      [0.3, 2.9, -2.5, -0.09], [5.1, 0.2, -3.5, 0.3], [-5.3, 0.2, -3.5, -0.2],
    ].forEach((p, i) => {
      const geometry = new THREE.PlaneGeometry(i % 3 === 0 ? 2.1 : 1.5, i % 3 === 0 ? 1.28 : 1.95);
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x1a1a1a : 0x555555,
        transparent: true,
        opacity: 0.035 + (i % 3) * 0.018,
        side: THREE.DoubleSide,
        wireframe: i % 4 === 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(p[0], p[1], p[2]);
      mesh.rotation.z = p[3];
      mesh.rotation.y = ((i % 3) - 1) * 0.22;
      group.add(mesh);
      planes.push({ mesh, baseY: p[1], phase: i * 0.8 });
    });

    const count = 700;
    const base = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      base[i * 3] = (Math.random() - 0.5) * 17;
      base[i * 3 + 1] = (Math.random() - 0.5) * 10;
      base[i * 3 + 2] = (Math.random() - 0.5) * 9 - 1;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0x1a1a1a, size: 0.024, transparent: true, opacity: 0.4 }),
    );
    scene.add(particles);

    // Cursor in world units on the z=0 plane; particles flee from it.
    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0, frame = 0, running = false;
    const cursor = { x: 99, y: 99, active: false };
    function toWorld(e) {
      const rect = host.getBoundingClientRect();
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      return {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2 * halfH * camera.aspect,
        y: -((e.clientY - rect.top) / rect.height - 0.5) * 2 * halfH,
      };
    }
    window.addEventListener("mousemove", (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.65;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.35;
      Object.assign(cursor, toWorld(e), { active: true });
    });
    hero.addEventListener("mouseleave", () => (cursor.active = false));
    // Click anywhere empty in the hero to send a shockwave through the particles.
    hero.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      const p = toWorld(e);
      const pos = particleGeometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const dx = pos[i * 3] - p.x, dy = pos[i * 3 + 1] - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 5) {
          const force = (5 - dist) * 0.06;
          velocity[i * 2] += (dx / dist) * force;
          velocity[i * 2 + 1] += (dy / dist) * force;
        }
      }
    });

    const start = performance.now();
    function render() {
      const t = (performance.now() - start) / 1000;
      mouseX += (targetX - mouseX) * 0.025;
      mouseY += (targetY - mouseY) * 0.025;
      group.rotation.y = mouseX;
      group.rotation.x = -mouseY;
      planes.forEach(({ mesh, baseY, phase }) => {
        mesh.position.y = baseY + Math.sin(t * 0.42 + phase) * 0.12;
      });
      const pos = particleGeometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const ix = i * 3, iv = i * 2;
        if (cursor.active) {
          const dx = pos[ix] - cursor.x, dy = pos[ix + 1] - cursor.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1.6 && dist > 0.001) {
            velocity[iv] += (dx / dist) * (1.6 - dist) * 0.012;
            velocity[iv + 1] += (dy / dist) * (1.6 - dist) * 0.012;
          }
        }
        // Spring back home with damping.
        velocity[iv] = (velocity[iv] + (base[ix] - pos[ix]) * 0.02) * 0.9;
        velocity[iv + 1] = (velocity[iv + 1] + (base[ix + 1] - pos[ix + 1]) * 0.02) * 0.9;
        pos[ix] += velocity[iv];
        pos[ix + 1] += velocity[iv + 1];
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particles.rotation.y = t * 0.006;
      renderer.render(scene, camera);
    }
    function loop() {
      render();
      frame = requestAnimationFrame(loop);
    }

    if (reducedMotion) {
      render();
    } else {
      // Only animate while the hero is on screen.
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          loop();
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(frame);
        }
      }).observe(host);
    }

    window.addEventListener("resize", () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      if (!running) render();
    });
  }

  // ══════════════════════════════════════════════════════════
  // CUSTOM CURSOR — dot + trailing ring with contextual labels
  // ══════════════════════════════════════════════════════════
  if (finePointer && !reducedMotion) {
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    ring.innerHTML = '<span class="cursor-label"></span>';
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.append(dot, ring);
    root.classList.add("has-cursor");
    const label = ring.firstElementChild;

    document.querySelectorAll(".carousel-card").forEach((el) => (el.dataset.cursor = "View"));
    new MutationObserver(() =>
      document.querySelectorAll(".carousel-card:not([data-cursor])").forEach((el) => (el.dataset.cursor = "View")),
    ).observe(document.getElementById("projectsSwiperWrapper"), { childList: true });

    let x = -100, y = -100, rx = -100, ry = -100;
    window.addEventListener("mousemove", (e) => {
      x = e.clientX;
      y = e.clientY;
      root.classList.remove("cursor-hidden");
    });
    document.addEventListener("mouseleave", () => root.classList.add("cursor-hidden"));
    window.addEventListener("mousedown", () => root.classList.add("cursor-down"));
    window.addEventListener("mouseup", () => root.classList.remove("cursor-down"));
    document.addEventListener("mouseover", (e) => {
      const labelled = e.target.closest("[data-cursor]");
      const interactive = e.target.closest("a, button, select, input, [role='button'], .is-clickable");
      label.textContent = labelled ? labelled.dataset.cursor : "";
      root.classList.toggle("cursor-label-on", !!labelled);
      root.classList.toggle("cursor-hover", !labelled && !!interactive);
    });
    (function follow() {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      dot.style.transform = `translate(${x}px, ${y}px)`;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(follow);
    })();
  }

  // ══════════════════════════════════════════════════════════
  // MAGNETIC BUTTONS
  // ══════════════════════════════════════════════════════════
  if (finePointer && !reducedMotion) {
    document.querySelectorAll(".btn-editorial, .cv-btn, .sidebar-social-link").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const dx = e.clientX - rect.left - rect.width / 2;
        const dy = e.clientY - rect.top - rect.height / 2;
        el.style.translate = `${(dx * 0.3).toFixed(1)}px ${(dy * 0.4).toFixed(1)}px`;
      });
      el.addEventListener("mouseleave", () => (el.style.translate = ""));
    });
  }

  // ══════════════════════════════════════════════════════════
  // CONTACT ORB — follows the cursor a little
  // ══════════════════════════════════════════════════════════
  const contact = document.getElementById("contact");
  const orb = document.querySelector(".contact-orb");
  if (contact && orb && finePointer && !reducedMotion) {
    contact.addEventListener("mousemove", (e) => {
      const rect = contact.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      orb.style.translate = `${(x * 30).toFixed(1)}px ${(y * 30).toFixed(1)}px`;
    });
  }

  // ══════════════════════════════════════════════════════════
  // PRELOADER — counts to 100, then the curtain lifts
  // ══════════════════════════════════════════════════════════
  const preloader = document.getElementById("preloader");
  function runPreloader(done) {
    if (!root.classList.contains("is-loading") || !preloader) return done();
    const countEl = document.getElementById("preloaderCount");
    const bar = document.getElementById("preloaderBar");
    if (!hasGsap) {
      root.classList.remove("is-loading");
      return done();
    }
    const counter = { value: 0 };
    gsap
      .timeline({
        onComplete() {
          root.classList.remove("is-loading");
          gsap.set(preloader, { clearProps: "all" });
        },
      })
      .from(".preloader-top span, .preloader-caption", { y: 20, opacity: 0, duration: 0.6, stagger: 0.08, ease: "power3.out" })
      .to(counter, {
        value: 100,
        duration: 1.4,
        ease: "power2.inOut",
        onUpdate() {
          countEl.textContent = String(Math.round(counter.value)).padStart(3, "0");
          bar.style.transform = `scaleX(${counter.value / 100})`;
        },
      }, 0.2)
      .to(".preloader-top, .preloader-bottom", { y: -30, opacity: 0, duration: 0.5, ease: "power2.in" })
      .to(preloader, { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "-=0.15")
      .add(done, "-=0.55");
  }

  // ══════════════════════════════════════════════════════════
  // GSAP — intro timeline, scroll reveals, velocity
  // ══════════════════════════════════════════════════════════
  if (!hasGsap) {
    root.classList.remove("is-loading");
    return;
  }
  root.classList.add("has-gsap");
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // Split the hero name and section titles into chars for masked reveals.
  const heroName = document.querySelector(".hero-name");
  const heroChars = heroName ? splitChars(heroName) : [];
  const titleChars = [...document.querySelectorAll(".section-title")].map((title) => [title, splitChars(title)]);
  gsap.set(heroChars, { yPercent: 110 });
  gsap.set(".hero-inner > *:not(.hero-name), .float-card, .hero-scroll-indicator", { opacity: 0 });

  function intro() {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (window.innerWidth > 768) {
      tl.fromTo(
        ".sidebar > *",
        { x: -24, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.7, stagger: 0.07, clearProps: "transform,opacity" },
      );
    } else {
      tl.fromTo(".mobile-nav", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, clearProps: "transform,opacity" });
    }
    tl.to(heroChars, { yPercent: 0, duration: 1, stagger: 0.035, ease: "power4.out" }, 0.1)
      .fromTo(
        ".hero-inner > *:not(.hero-name)",
        { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, stagger: 0.1, clearProps: "transform" },
        0.4,
      )
      .add(() => document.querySelector(".hero-label") && scramble(document.querySelector(".hero-label"), 1000), 0.4)
      .fromTo(
        ".float-card",
        { opacity: 0, scale: 0.6, y: 60, rotate: () => gsap.utils.random(-30, 30) },
        { opacity: 1, scale: 1, y: 0, rotate: 0, duration: 1.2, stagger: 0.09, ease: "expo.out", clearProps: "scale,y,rotate" },
        0.5,
      )
      .to(".hero-scroll-indicator", { opacity: 1, duration: 0.6 }, 1.2);
  }
  runPreloader(intro);

  // Hero name follows the mouse with depth per line.
  if (finePointer && heroName) {
    const lines = heroName.querySelectorAll(".split-line");
    const movers = [...lines].map((line) => gsap.quickTo(line, "x", { duration: 0.8, ease: "power3.out" }));
    hero.addEventListener("mousemove", (e) => {
      const offset = e.clientX / window.innerWidth - 0.5;
      movers.forEach((move, i) => move(offset * (i + 1) * -14));
    });
    hero.addEventListener("mouseleave", () => movers.forEach((move) => move(0)));
  }

  if (!window.ScrollTrigger) return;

  // Section titles: chars rise out of a mask; labels decode and draw their line.
  titleChars.forEach(([title, chars]) => {
    gsap.fromTo(
      chars,
      { yPercent: 110 },
      { yPercent: 0, duration: 0.9, stagger: 0.03, ease: "power4.out", scrollTrigger: { trigger: title, start: "top 88%" } },
    );
  });
  document.querySelectorAll(".section-label").forEach((label) => {
    ScrollTrigger.create({
      trigger: label,
      start: "top 90%",
      once: true,
      onEnter() {
        label.classList.add("is-drawn");
        scramble(label);
      },
    });
  });

  // Grouped elements reveal one by one; everything else as a block.
  const groups = [".stats-row", ".contact-grid"];
  document.querySelectorAll(".section .fade-in").forEach((el) => {
    const isGroup = groups.some((selector) => el.matches(selector));
    gsap.fromTo(
      isGroup ? el.children : el,
      { y: 36, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power2.out",
        stagger: isGroup ? 0.1 : 0,
        clearProps: "transform",
        scrollTrigger: { trigger: el, start: "top 88%" },
      },
    );
  });
  document.querySelectorAll(".edu-tags").forEach((tags) => {
    gsap.fromTo(
      tags.children,
      { y: 12, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.04,
        ease: "power2.out",
        clearProps: "transform",
        scrollTrigger: { trigger: tags, start: "top 92%" },
      },
    );
  });

  // Project cards cascade in whenever the list changes (filter, search, load).
  const projectTrack = document.getElementById("projectsSwiperWrapper");
  new MutationObserver(() => {
    gsap.fromTo(
      projectTrack.querySelectorAll(".project-slide"),
      { y: 40, opacity: 0, clipPath: "inset(0 0 100% 0)" },
      { y: 0, opacity: 1, clipPath: "inset(0 0 0% 0)", duration: 0.7, stagger: 0.06, ease: "power3.out", clearProps: "transform,clipPath" },
    );
  }).observe(projectTrack, { childList: true });
  ScrollTrigger.create({
    trigger: projectTrack,
    start: "top 85%",
    once: true,
    onEnter: () =>
      gsap.fromTo(
        projectTrack.querySelectorAll(".project-slide"),
        { y: 60, opacity: 0, clipPath: "inset(0 0 100% 0)" },
        { y: 0, opacity: 1, clipPath: "inset(0 0 0% 0)", duration: 1, stagger: 0.12, ease: "power3.out", clearProps: "transform,clipPath" },
      ),
  });

  // Scroll velocity skews and speeds up the skills marquee.
  const marquee = document.querySelector(".skills-marquee");
  if (marquee) {
    const skew = gsap.quickTo(marquee, "skewX", { duration: 0.5, ease: "power3.out" });
    const tracks = [...marquee.querySelectorAll(".marquee-track")];
    ScrollTrigger.create({
      onUpdate(self) {
        const v = self.getVelocity();
        skew(gsap.utils.clamp(-8, 8, v / -300));
        const rate = 1 + Math.min(4, Math.abs(v) / 600);
        tracks.forEach((track) => track.getAnimations().forEach((a) => (a.playbackRate = rate)));
      },
    });
    gsap.ticker.add(() => {
      tracks.forEach((track) =>
        track.getAnimations().forEach((a) => (a.playbackRate += (1 - a.playbackRate) * 0.05)),
      );
    });
  }

  // Hero drifts away as you scroll past it.
  const heroScroll = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
  gsap.to(".hero-inner", { y: -80, opacity: 0.2, ease: "none", scrollTrigger: heroScroll });
  gsap.to(".floating-gallery", { y: -140, ease: "none", scrollTrigger: { ...heroScroll } });
  gsap.to(".hero-scene", { scale: 1.15, ease: "none", scrollTrigger: { ...heroScroll } });
})();
