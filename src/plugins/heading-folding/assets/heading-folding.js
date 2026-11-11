(function () {
  "use strict";
  function boot() {
    var content = document.querySelector("main.content, .content");
    if (!content || content.classList.contains("canvas-page") || content.dgFolding) return;
    var entries = [];
    var observer;
    function level(node) { return node && /^H[1-6]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : 0; }
    function nodesFor(heading) {
      var nodes = [];
      for (var node = heading.nextElementSibling; node; node = node.nextElementSibling) {
        if (level(node) && level(node) <= level(heading)) break;
        nodes.push(node);
      }
      return nodes;
    }
    function apply() {
      content.querySelectorAll("[data-dg-fold-hidden]").forEach(function (node) {
        node.removeAttribute("data-dg-fold-hidden");
        node.removeAttribute("data-dg-fold-owner");
      });
      entries.forEach(function (entry) {
        entry.button.setAttribute("aria-expanded", String(!entry.closed));
        entry.button.title = (entry.closed ? "Expand " : "Collapse ") + entry.label;
        if (entry.closed) nodesFor(entry.heading).forEach(function (node) {
          node.setAttribute("data-dg-fold-hidden", "");
          node.setAttribute("data-dg-fold-owner", entry.heading.id);
        });
      });
      document.dispatchEvent(new CustomEvent("dg:fold-change"));
      window.dispatchEvent(new Event("scroll"));
    }
    function scan() {
      content.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(function (heading) {
        if (heading.closest("header,.dg-print-heading,.callout,nav,dialog") || heading.querySelector(":scope > .dg-fold-button") || !nodesFor(heading).length) return;
        var label = heading.textContent.trim();
        if (!heading.id) {
          var number = entries.length + 1;
          while (document.getElementById("dg-fold-heading-" + number)) number++;
          heading.id = "dg-fold-heading-" + number;
        }
        var button = document.createElement("button");
        button.type = "button";
        button.className = "dg-fold-button";
        button.setAttribute("aria-label", "Toggle section: " + label);
        button.setAttribute("aria-expanded", "true");
        button.title = "Collapse " + label;
        button.innerHTML = '<i data-lucide="chevron-down"></i><span aria-hidden="true">&#9662;</span>';
        heading.prepend(button);
        var entry = { heading: heading, button: button, closed: false, label: label };
        entries.push(entry);
        button.addEventListener("click", function () {
          entry.closed = !entry.closed;
          if (entry.closed) {
            var focused = document.activeElement;
            if (nodesFor(heading).some(function (node) { return node.contains(focused); })) button.focus();
          }
          apply();
        });
      });
      if (window.lucide) window.lucide.createIcons();
    }
    function reveal(target) {
      if (!target || !content.contains(target)) return;
      var changed = false;
      entries.forEach(function (entry) {
        if (entry.closed && (entry.heading === target || nodesFor(entry.heading).some(function (node) { return node === target || node.contains(target); }))) {
          entry.closed = false;
          changed = true;
        }
      });
      if (changed) apply();
    }
    function hashTarget(hash) {
      try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (_) { return null; }
    }
    function onHash() {
      var target = hashTarget(location.hash);
      reveal(target);
      if (target) window.requestAnimationFrame(function () { target.scrollIntoView({ block: "start" }); });
    }
    document.addEventListener("click", function (event) {
      var link = event.target.closest("a[href]");
      if (!link) return;
      var url = new URL(link.href, location.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
        reveal(hashTarget(url.hash));
        if (url.hash === location.hash) onHash();
      }
    }, true);
    window.addEventListener("hashchange", onHash);
    document.addEventListener("dg:reveal-target", function (event) { if (event.detail && typeof event.detail.id === "string") reveal(document.getElementById(event.detail.id)); });
    content.dgFolding = { reveal: reveal };
    scan();
    onHash();
    var toc = document.querySelector('.toc-container');
    var tocQueued = false;
    function correctFoldedActive() {
      tocQueued = false;
      var active = toc && toc.querySelector('a.toc-active[href^="#"]');
      var target = active && hashTarget(active.hash);
      var owner = target && target.closest('[data-dg-fold-hidden]');
      if (!owner) return;
      while (owner) {
        target = document.getElementById(owner.getAttribute('data-dg-fold-owner'));
        owner = target && target.closest('[data-dg-fold-hidden]');
      }
      var replacement = target && Array.from(toc.querySelectorAll('a[href^="#"]')).find(function (link) { return hashTarget(link.hash) === target; });
      if (replacement && replacement !== active) {
        active.classList.remove('toc-active');
        replacement.classList.add('toc-active');
      }
    }
    if (toc) new MutationObserver(function () {
      if (!tocQueued) { tocQueued = true; requestAnimationFrame(correctFoldedActive); }
    }).observe(toc, {subtree:true, attributes:true, attributeFilter:['class']});
    document.addEventListener('dg:fold-change', correctFoldedActive);
    observer = new MutationObserver(function (records) {
      if (records.some(function (record) { return Array.from(record.addedNodes).some(function (node) { return node.nodeType === 1 && !node.closest(".dg-fold-button") && (level(node) || node.querySelector("h1,h2,h3,h4,h5,h6")); }); })) {
        scan();
        apply();
      }
    });
    observer.observe(content, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
