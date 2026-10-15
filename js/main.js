(function () {
  "use strict";

  var doc = document;
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  function throttled(fn) {
    var queued = false;
    function run() {
      if (!queued) return;
      queued = false;
      fn();
    }
    return function () {
      if (queued) return;
      queued = true;
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(run);
      }
      window.setTimeout(run, 120);
    };
  }

  function initMenu() {
    var toggle = doc.querySelector("[data-menu-toggle]");
    var panel = doc.querySelector("[data-menu-panel]");
    if (!toggle || !panel) return;

    var label = toggle.querySelector("[data-menu-label]");
    var isOpen = false;

    function setState(open) {
      isOpen = open;
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      doc.body.classList.toggle("is-locked", open);
      if (label) label.textContent = open ? "Close" : "Menu";
      if (open) {
        var first = panel.querySelector("a, button");
        if (first) first.focus();
      }
    }

    setState(false);
    toggle.addEventListener("click", function () {
      setState(!isOpen);
      if (!isOpen) toggle.focus();
    });
    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) setState(false);
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen) {
        setState(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", throttled(function () {
      if (isOpen && window.innerWidth > 820) setState(false);
    }), { passive: true });
  }

  function initReveal() {
    var targets = doc.querySelectorAll(".rv");
    if (!targets.length) return;
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      for (var k = 0; k < targets.length; k++) targets[k].classList.add("on");
      return;
    }

    var limit = window.innerHeight * 1.1;
    var pending = [];
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top < limit) targets[i].classList.add("on");
      else pending.push(targets[i]);
    }
    if (!pending.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("on");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px 10% 0px", threshold: 0 });
    pending.forEach(function (el) { observer.observe(el); });
    doc.documentElement.classList.add("rv-ready");

    function reveal(el) { el.classList.add("on"); observer.unobserve(el); }
    function sweep() {
      var h = window.innerHeight;
      pending = pending.filter(function (el) {
        if (el.classList.contains("on")) return false;
        var r = el.getBoundingClientRect();
        if (r.top < h * 1.1 && r.bottom > -h * 0.1) { reveal(el); return false; }
        return true;
      });
    }
    window.addEventListener("load", sweep);
    window.addEventListener("hashchange", sweep);
    window.addEventListener("scroll", throttled(sweep), { passive: true });
    window.setTimeout(function () { pending.forEach(reveal); pending = []; }, 2500);
  }

  function initCurrentSection() {
    var links = Array.prototype.slice.call(doc.querySelectorAll("[data-nav-link]"));
    if (!links.length || !("IntersectionObserver" in window)) return;

    var map = {};
    var sections = [];
    links.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var id = href.indexOf("#") === 0 ? href.slice(1) : "";
      var section = id ? doc.getElementById(id) : null;
      if (!section) return;
      map[id] = link;
      sections.push(section);
    });
    if (!sections.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(map).forEach(function (key) {
          if (key === entry.target.id) {
            map[key].setAttribute("aria-current", "true");
          } else {
            map[key].removeAttribute("aria-current");
          }
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });
  }

  function initCanvas() {
    var cv = doc.querySelector("[data-canvas]");
    if (!cv) return;

    var frame = cv.querySelector("[data-frame]");
    var parts = Array.prototype.slice.call(cv.querySelectorAll("[data-cmp]"));
    var notes = Array.prototype.slice.call(cv.querySelectorAll(".nt"));
    var steps = Array.prototype.slice.call(cv.querySelectorAll("[data-step]"));
    var label = cv.querySelector("[data-label]");
    var cursor = cv.querySelector("[data-cursor]");
    var guideV = cv.querySelector("[data-guide-v]");
    var guideH = cv.querySelector("[data-guide-h]");
    var name = cv.querySelector("[data-insp-name]");
    var fill = cv.querySelector("[data-insp-fill]");
    var replay = doc.querySelector("[data-replay]");
    var fields = {};
    Array.prototype.forEach.call(cv.querySelectorAll("[data-insp]"), function (el) {
      fields[el.getAttribute("data-insp")] = el;
    });
    var last = parts.filter(function (p) { return p.hasAttribute("data-final"); })[0] || parts[parts.length - 1];
    var labels = ["", "Evidence", "Patterns", "Problem", "Flow", "Home &mdash; 1440"];
    var timers = [];

    function later(fn, ms) { timers.push(window.setTimeout(fn, ms)); }
    function clear() { timers.forEach(window.clearTimeout); timers = []; }
    function num(el, prop) { return parseFloat(el.style.getPropertyValue("--" + prop)) || 0; }

    function stage(n) {
      for (var i = 1; i <= 5; i++) cv.classList.toggle("is-s" + i, i === n);
      cv.classList.toggle("is-ws", n < 6);
      steps.forEach(function (s) {
        var k = parseInt(s.getAttribute("data-step"), 10);
        s.classList.toggle("is-now", k === n);
        s.classList.toggle("is-todo", k > n);
      });
      if (label && labels[n]) label.innerHTML = labels[n];
    }

    function box(el) {
      var c = cv.getBoundingClientRect();
      var f = frame.getBoundingClientRect();
      return {
        left: f.left - c.left + f.width * num(el, "x") / 100,
        top: f.top - c.top + f.height * num(el, "y") / 100,
        width: f.width * num(el, "w") / 100,
        height: f.height * num(el, "h") / 100,
        frame: { left: f.left - c.left, top: f.top - c.top, width: f.width, height: f.height },
        unit: c.width / 1000
      };
    }

    function design(el) {
      var f = frame.getBoundingClientRect();
      var scale = 1440 / (f.width || 1);
      return {
        x: Math.round(f.width * num(el, "x") / 100 * scale),
        y: Math.round(f.height * num(el, "y") / 100 * scale),
        w: Math.round(f.width * num(el, "w") / 100 * scale),
        h: Math.round(f.height * num(el, "h") / 100 * scale)
      };
    }

    function select(el) {
      parts.forEach(function (p) { p.classList.toggle("is-selected", p === el); });
      if (!el) return;
      var d = design(el);
      Object.keys(fields).forEach(function (k) { fields[k].textContent = String(d[k]); });
      if (name) name.textContent = el.getAttribute("data-cmp");
      if (fill) {
        var hex = el.getAttribute("data-fill") || "#FF4326";
        fill.style.setProperty("--fillc", hex);
        fill.querySelector("span").textContent = hex.toUpperCase();
      }
      var badge = el.querySelector(".sel__size");
      if (badge) badge.textContent = d.w + " × " + d.h;
    }

    function cursorTo(x, y) {
      if (!cursor) return;
      cursor.classList.add("is-on");
      cursor.style.left = x + "px";
      cursor.style.top = y + "px";
    }
    function cursorAway() {
      if (!cursor) return;
      var c = cv.getBoundingClientRect();
      cursor.style.left = c.width * 0.97 + "px";
      cursor.style.top = c.height * 0.94 + "px";
      cursor.classList.remove("is-on");
    }

    function cursorAt(el, fx, fy) {
      if (!el) return;
      var c = cv.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      cursorTo(r.left - c.left + r.width * (fx || 0.7), r.top - c.top + r.height * (fy || 0.6));
    }

    function cursorAtPart(el, lifted) {
      var b = box(el);
      var dx = lifted ? num(el, "dx") * b.unit : 0;
      var dy = lifted ? num(el, "dy") * b.unit : 0;
      cursorTo(b.left + b.width * 0.9 + dx, b.top + b.height * 0.8 + dy);
    }

    function guides(el, on) {
      if (!guideV || !guideH) return;
      if (on && el) {
        var b = box(el);
        guideV.style.left = b.left + "px";
        guideV.style.top = b.frame.top + "px";
        guideV.style.height = b.frame.height + "px";
        guideH.style.top = b.top + "px";
        guideH.style.left = b.frame.left + "px";
        guideH.style.width = b.frame.width + "px";
      }
      guideV.classList.toggle("is-on", !!on);
      guideH.classList.toggle("is-on", !!on);
    }

    function outcome() {
      select(null);
      guides(null, false);
      cv.classList.remove("is-building");
      frame.classList.remove("is-active");
      stage(6);
      cursorAway();
      if (replay) replay.hidden = false;
    }

    function finish() {
      clear();
      notes.forEach(function (n) { n.classList.add("is-in"); });
      parts.forEach(function (p) { p.classList.remove("is-waiting", "is-dragging"); });
      outcome();
    }

    function run() {
      clear();

      notes.forEach(function (n) { n.classList.remove("is-in"); });
      parts.forEach(function (p) { p.classList.add("is-waiting"); p.classList.remove("is-dragging", "is-selected"); });
      cv.classList.remove("is-building");
      frame.classList.remove("is-active");
      guides(null, false);
      stage(1);

      notes.forEach(function (n, i) {
        later(function () { n.classList.add("is-in"); cursorAt(n, 0.78, 0.72); }, 250 + i * 190);
      });

      later(function () { stage(2); }, 2000);
      later(function () { cursorAt(cv.querySelector('.bd__cl[data-c="b"]'), 0.6, 0.4); }, 2900);

      later(function () { stage(3); }, 4000);
      later(function () { cursorAt(cv.querySelector(".bd__prob"), 0.86, 0.8); }, 4900);

      later(function () { stage(4); }, 6000);
      later(function () { cursorAt(cv.querySelector(".bd__node--key"), 0.7, 0.7); }, 7100);

      later(function () {
        stage(5);
        cv.classList.add("is-building");
        frame.classList.add("is-active");
      }, 8000);

      var t = 8350;
      var step = 360;
      parts.forEach(function (p) {
        later(function () {
          p.classList.remove("is-waiting");
          p.classList.add("is-dragging");
          select(p);
          cursorAtPart(p, true);
        }, t);
        later(function () {
          p.classList.remove("is-dragging");
          cursorAtPart(p, false);
          guides(p, true);
        }, t + 200);
        later(function () { guides(p, false); }, t + 330);
        t += step;
      });
      later(function () { select(last); cursorAtPart(last, false); }, t);

      later(outcome, 11200);
    }

    if (replay) replay.addEventListener("click", run);

    if (reduceMotion.matches) { finish(); return; }
    run();

    window.addEventListener("resize", throttled(function () {
      var current = parts.filter(function (p) { return p.classList.contains("is-selected"); })[0];
      if (current && cv.classList.contains("is-s5")) {
        select(current);
        cursorAtPart(current, current.classList.contains("is-dragging"));
      }
    }), { passive: true });
  }

  function initCaseNav() {
    var nav = doc.querySelector("[data-case-nav]");
    if (!nav) return;
    var head = doc.querySelector("[data-nav]");
    var list = nav.querySelector(".cs-nav__list");
    function setOffset() {
      if (head && head.offsetHeight) doc.documentElement.style.setProperty("--nav-h", head.offsetHeight + "px");
    }
    setOffset();
    window.addEventListener("resize", throttled(setOffset), { passive: true });

    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var byId = {};
    var sections = [];
    links.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var section = doc.getElementById(id);
      if (!section) return;
      byId[id] = link;
      sections.push(section);
    });
    if (!sections.length || !("IntersectionObserver" in window)) return;

    function mark(link) {
      links.forEach(function (l) { l.removeAttribute("aria-current"); });
      link.setAttribute("aria-current", "true");
      if (list && list.scrollWidth > list.clientWidth) {
        var left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
        list.scrollTo({ left: left, behavior: reduceMotion.matches ? "auto" : "smooth" });
      }
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && byId[entry.target.id]) mark(byId[entry.target.id]);
      });
    }, { rootMargin: "-35% 0px -60% 0px", threshold: 0 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  function initSizes() {
    function measure(event) {
      var el = event.currentTarget;
      var r = el.getBoundingClientRect();
      el.setAttribute("data-size", Math.round(r.width) + " × " + Math.round(r.height));
    }
    Array.prototype.forEach.call(doc.querySelectorAll(".act"), function (el) {
      el.addEventListener("mouseenter", measure);
      el.addEventListener("focus", measure);
    });
  }

  function initCarousels() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-carousel]"), function (root) {
      var track = root.querySelector(".cs-carousel__track");
      var slides = root.querySelectorAll(".cs-carousel__slide");
      var bars = root.querySelectorAll(".cs-carousel__bars button");
      var label = root.querySelector("[data-carousel-label]");
      var cap = root.querySelector("[data-carousel-cap]");
      var live = root.querySelector(".cs-carousel__cap");
      var play = root.querySelector("[data-carousel-play]");
      var count = slides.length;
      var index = 0;
      var playing = !reduceMotion.matches;
      var held = false;
      var visible = true;
      var timer = null;
      var steering = false;
      var steerTimer = null;
      if (!track || !count) return;

      function pad(n) { return (n < 10 ? "0" : "") + n; }

      function paint() {
        var slide = slides[index];
        label.textContent = pad(index + 1) + " / " + pad(count) + " \u00b7 " + slide.getAttribute("data-name");
        cap.textContent = slide.getAttribute("data-cap");
        Array.prototype.forEach.call(slides, function (el, i) {
          el.setAttribute("aria-hidden", i === index ? "false" : "true");
        });
        Array.prototype.forEach.call(bars, function (el, i) {
          el.classList.toggle("is-done", i < index);
          if (i === index) el.setAttribute("aria-current", "true");
          else el.removeAttribute("aria-current");
        });
      }

      function go(i, user) {
        index = (i + count) % count;

        steering = true;
        window.clearTimeout(steerTimer);
        steerTimer = window.setTimeout(function () { steering = false; }, 900);
        track.scrollTo({ left: slides[index].offsetLeft - track.offsetLeft, behavior: reduceMotion.matches ? "auto" : "smooth" });
        paint();
        if (user) schedule();
      }

      function schedule() {
        window.clearTimeout(timer);
        if (playing && !held && visible) {
          timer = window.setTimeout(function () { go(index + 1); schedule(); }, 4500);
        }
      }

      function setPlaying(on) {
        playing = on;
        play.setAttribute("aria-label", on ? "Pause the slideshow" : "Play the slideshow");
        play.firstElementChild.innerHTML = on ? "&#10074;&#10074;" : "&#9654;";
        live.setAttribute("aria-live", on ? "off" : "polite");
        schedule();
      }

      root.querySelector("[data-carousel-prev]").addEventListener("click", function () { go(index - 1, true); });
      root.querySelector("[data-carousel-next]").addEventListener("click", function () { go(index + 1, true); });
      play.addEventListener("click", function () { setPlaying(!playing); });
      Array.prototype.forEach.call(bars, function (el, i) {
        el.addEventListener("click", function () { go(i, true); });
      });
      track.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, true); }
      });

      track.addEventListener("scroll", throttled(function () {
        if (steering) return;
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== index && i >= 0 && i < count) { index = i; paint(); schedule(); }
      }));

      root.addEventListener("mouseenter", function () { held = true; schedule(); });
      root.addEventListener("mouseleave", function () { held = false; schedule(); });
      root.addEventListener("focusin", function () { held = true; schedule(); });
      root.addEventListener("focusout", function (e) {
        if (!root.contains(e.relatedTarget)) { held = false; schedule(); }
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          schedule();
        }, { threshold: 0.4 }).observe(root);
      }

      root.classList.add("is-ready");
      paint();
      setPlaying(playing);
    });
  }

  function initFilms() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-film]"), function (root) {
      var track = root.querySelector(".tp-film");
      var label = root.querySelector("[data-film-count]");
      var play = root.querySelector("[data-film-play]");
      var prev = root.querySelector("[data-film-prev]");
      var next = root.querySelector("[data-film-next]");
      if (!track || !label || !play || !prev || !next) return;
      var items = track.children;
      var count = items.length;
      var index = 0;
      var last = 0;
      var playing = !reduceMotion.matches;
      var held = false;
      var visible = true;
      var timer = null;
      var steering = false;
      var steerTimer = null;
      if (!count) return;

      function pad(n) { return (n < 10 ? "0" : "") + n; }
      function left(i) { return items[i].offsetLeft - items[0].offsetLeft; }

      function measure() {
        var max = track.scrollWidth - track.clientWidth;
        last = 0;
        while (last < count - 1 && left(last) < max - 2) last += 1;
        if (index > last) index = last;
        prev.hidden = play.hidden = next.hidden = last === 0;
        paint();
      }

      function paint() {
        var shown = count - last;
        label.textContent = (shown > 1
          ? pad(index + 1) + "\u2013" + pad(index + shown)
          : pad(index + 1)) + " / " + pad(count);
      }

      function go(i, user) {
        index = i > last ? 0 : i < 0 ? last : i;
        steering = true;
        window.clearTimeout(steerTimer);
        steerTimer = window.setTimeout(function () { steering = false; }, 900);
        track.scrollTo({ left: left(index), behavior: reduceMotion.matches ? "auto" : "smooth" });
        paint();
        if (user) schedule();
      }

      function schedule() {
        window.clearTimeout(timer);
        if (playing && !held && visible && last > 0) {
          timer = window.setTimeout(function () { go(index + 1); schedule(); }, 4000);
        }
      }

      function setPlaying(on) {
        playing = on;
        play.setAttribute("aria-label", on ? "Pause the slider" : "Play the slider");
        play.firstElementChild.innerHTML = on ? "&#10074;&#10074;" : "&#9654;";
        label.setAttribute("aria-live", on ? "off" : "polite");
        schedule();
      }

      prev.addEventListener("click", function () { go(index - 1, true); });
      next.addEventListener("click", function () { go(index + 1, true); });
      play.addEventListener("click", function () { setPlaying(!playing); });
      track.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, true); }
      });

      track.addEventListener("scroll", throttled(function () {
        if (steering) return;
        var i = 0;
        while (i < last && left(i + 1) - track.scrollLeft < (left(i + 1) - left(i)) / 2) i += 1;
        if (i !== index) { index = i; paint(); schedule(); }
      }));

      root.addEventListener("mouseenter", function () { held = true; schedule(); });
      root.addEventListener("mouseleave", function () { held = false; schedule(); });
      root.addEventListener("focusin", function () { held = true; schedule(); });
      root.addEventListener("focusout", function (e) {
        if (!root.contains(e.relatedTarget)) { held = false; schedule(); }
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          schedule();
        }, { threshold: 0.4 }).observe(root);
      }
      window.addEventListener("resize", throttled(function () { measure(); schedule(); }));

      root.classList.add("is-ready");
      measure();
      setPlaying(playing);
    });
  }

  function initYear() {
    var slot = doc.querySelector("[data-year]");
    if (slot) slot.textContent = String(new Date().getFullYear());
  }

  function init() {
    initMenu();
    initReveal();
    initCanvas();
    initCurrentSection();
    initSizes();
    initCaseNav();
    initCarousels();
    initFilms();
    initYear();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
