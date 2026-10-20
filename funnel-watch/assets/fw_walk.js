// Funnel Watch · generic quiz walker. Run repeatedly (each call ≤ ~28 s) until it returns done:true.
// State lives in sessionStorage so it survives page navigations inside the funnel.
// After the first call, continue with the short call:  JSON.stringify(window.__fwWalk ? await window.__fwWalk() : {reinject: true})
// and send this whole file again only when the short call answers {reinject: true} (the page navigated).
// The walker ticks consent checkboxes only when __fw_cfg.auto_consent is true, and never clicks pay/subscribe/trial/claim buttons.
// Before the first call run:  sessionStorage.setItem('__fw_cfg', JSON.stringify({id: 'calm', email: '...', name: 'Alex', auto_consent: false})); sessionStorage.removeItem('__fw');
window.__fwWalk = async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const T0 = Date.now(), BUDGET = 26000;
  const cfg = JSON.parse(sessionStorage.getItem('__fw_cfg') || '{}');
  const S = JSON.parse(sessionStorage.getItem('__fw') || 'null') || { screens: [], paths: [], seen: {}, stuck: 0, last: '', products: [], fills: 0, start: location.href };
  const save = () => sessionStorage.setItem('__fw', JSON.stringify(S));
  const vis = el => { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight * 4; };
  const txt = el => (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
  const PRICE = /(?:[$€£]|US\$|zł|PLN|USD|EUR|GBP|CAD|AUD)\s?\d{1,4}(?:[.,]\d{2})?|\d{1,4}[.,]\d{2}\s?(?:[$€£]|zł|PLN|USD|EUR|GBP|kr|₽|₴)/g;
  const PRICE1 = new RegExp(PRICE.source);
  const PERIOD = /per (day|week|month|year)|\/\s?(day|wk|week|mo|month|yr|year)|\b(trial|weekly|monthly|annual|yearly|quarterly|billed)\b/i;
  const NEXT = /^(continue|next|next step|got it|start|start quiz|take the quiz|let'?s (go|start|do it)|get started|i('|’)?m ready|ok(ay)?|i agree|agree( and continue)?|yes,? i'?m in|show (me )?my (plan|results?)|see my (plan|results?)|i understand|sounds good|proceed|submit|done|confirm)\b/i;
  const DECLINE = /^(i'?m not interested|no,? thanks|not now|maybe later|no thank you|decline)$/i;
  const COOKIE = /^(reject( all)?|decline( all)?|essential cookies only|only (necessary|essential)|necessary only|use necessary cookies only)$/i;
  const NEVER = /(buy|pay|purchase|subscribe|checkout|start (my |your )?(free )?trial|claim|get (my )?plan|get started now|place order|add to cart|apple pay|google pay|paypal|sign ?in|log ?in|sign ?up with|continue with (apple|google|facebook)|download|install|terms|privacy|policy|cookie settings|manage|faq|contact|support|menu|back|skip|impressum|legal|dispute|guarantee|money-back|refund|docs|help center|about us|blog)/i;

  const heading = () => { const h = [...document.querySelectorAll('h1,h2,h3,[class*=title i],[class*=question i],legend')].find(vis); return h ? txt(h).slice(0, 200) : ''; };
  const bodyTxt = () => (document.body.innerText || '').replace(/\s+/g, ' ').trim();
  const fp = () => location.pathname + '|' + heading() + '|' + bodyTxt().slice(0, 240);

  const clickables = () => {
    let c = [...document.querySelectorAll('button,[role=button],[role=radio],[role=checkbox],[role=option],a,label,li,div,span')]
      .filter(el => vis(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' &&
        (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'LABEL' || el.getAttribute('role') || getComputedStyle(el).cursor === 'pointer'));
    c = c.filter(el => { const t = txt(el); return t.length >= 1 && t.length <= 100; });
    c = c.filter(el => !(el.tagName === 'A' && el.href && (new URL(el.href, location.href).host !== location.host || /\/(legal|terms|privacy|policy|faq|help|blog|about|contact|impressum|cookie|support|careers|docs?)\b/i.test(new URL(el.href, location.href).pathname))));
    c = c.filter(el => !el.closest('nav,footer,aside,[role=navigation],[role=contentinfo],[class*=sidebar i],[class*=footer i],[class*=drawer i],[class*=burger i],[class*=menu i]'));
    c = c.filter(el => !c.some(o => o !== el && o.contains(el) && txt(o) === txt(el)));         // keep outer of identical text
    c = c.filter(el => el.tagName === 'BUTTON' || !c.some(o => o !== el && el.contains(o)));  // keep leaf-most otherwise
    return c;
  };
  const record = (kind) => {
    const f = fp(); if (S.seen[f]) return; S.seen[f] = 1;
    const c = clickables();
    const opts = c.filter(el => !NEXT.test(txt(el)) && !NEVER.test(txt(el)) && el.getBoundingClientRect().top > 50).map(txt).slice(0, 14);
    const texts = [...new Set([...document.querySelectorAll('h1,h2,h3,h4,p,[class*=subtitle i],[class*=description i]')].filter(vis)
      .map(txt).filter(t => t.length > 2 && t.length < 220))].slice(0, 12);
    S.screens.push({ n: S.screens.length, path: location.pathname, title: heading() || texts[0] || '', kind, options: kind === 'question' ? opts : [], texts });
    if (S.paths[S.paths.length - 1] !== location.pathname) S.paths.push(location.pathname);
  };
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  const labelOf = i => [i.type, i.placeholder, i.name, i.id, i.getAttribute('aria-label'), i.getAttribute('inputmode'), i.getAttribute('autocomplete'),
    i.closest('label') && txt(i.closest('label')), i.parentElement && txt(i.parentElement)].filter(Boolean).join(' ').toLowerCase().slice(0, 240);
  const valueFor = i => {
    const l = labelOf(i);
    if (i.type === 'email' || /e-?mail/.test(l)) return cfg.email ? ['email', cfg.email] : ['email_gate', null];
    if (/card|cvv|cvc|expir|security code|zip|postal/.test(l)) return ['payment', null];
    if (/password/.test(l) || i.type === 'password') return ['password', null];
    const target = /target|goal|desired|dream|ideal/.test(l);
    if (/\bft\b|feet/.test(l)) return ['num', 5];
    if (/\binch|\bin\b/.test(l) && !/height/.test(l)) return ['num', 6];
    if (/\bcm\b|height/.test(l)) return ['num', 168];
    if (/lbs?\b|pound/.test(l)) return ['num', target ? 150 : 172];
    if (/\bkg\b|weight/.test(l)) return ['num', target ? 68 : 78];
    if (/\bage\b|years|old/.test(l)) return ['num', 32];
    if (i.type === 'number' || i.type === 'tel' || /numeric|decimal/.test(l)) return ['num', 32];
    if (/name/.test(l) || i.type === 'text') return ['name', cfg.name || 'Alex'];
    return ['unknown', null];
  };
  const HEADS = 'h1,h2,h3,h4,h5,[class*=title i],[class*=name i],[class*=header i]';
  const capturePrices = () => {
    const leaves = [...document.querySelectorAll('body *')].filter(el => el.children.length <= 3 && vis(el) && PRICE1.test(txt(el)) && txt(el).length < 60);
    PRICE.lastIndex = 0;
    const cards = new Map();
    for (const el of leaves) { let card = el; for (let k = 0; k < 6 && card.parentElement; k++) { const p = card.parentElement; if (txt(p).length > 260 || p.querySelectorAll(HEADS).length > 1 || p === document.body) break; card = p; }
      if (!cards.has(card)) cards.set(card, txt(card)); }
    for (const a of [...cards.keys()]) if ([...cards.keys()].some(b => b !== a && b.contains(a))) cards.delete(a);
    const out = [];
    for (const t of cards.values()) { const prices = (t.match(PRICE) || []).slice(0, 6); PRICE.lastIndex = 0; if (!prices.length) continue;
      const label = t.replace(PRICE, '').replace(/\d{1,2}:\d{2}/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'price'; PRICE.lastIndex = 0;
      out.push({ key: label.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'p' + out.length, label, prices }); }
    return out.slice(0, 40);
  };
  const isPaywall = () => { const b = bodyTxt(); const n = (b.match(PRICE) || []).length; PRICE.lastIndex = 0;
    return (S.screens.length >= 3 && n >= 2 && PERIOD.test(b)) || /\/(checkout|paywall|plans?|pricing|subscribe|offer)(\/|$)/i.test(location.pathname); };

  while (Date.now() - T0 < BUDGET) {
    await sleep(500);
    // cookies / consent
    const ck = clickables().find(el => COOKIE.test(txt(el))); if (ck) { ck.click(); await sleep(500); continue; }
    const dec = clickables().find(el => DECLINE.test(txt(el))); if (dec && S.fills) { dec.click(); await sleep(1200); continue; }
    if (/card number|cvv|cvc|expiration date|expiry/i.test(bodyTxt()) && !isPaywall()) { record('checkout'); S.products = capturePrices(); save(); return { done: true, reason: 'checkout' }; }
    if (isPaywall()) { await sleep(2500); record('paywall'); S.products = capturePrices();
      S.paywall_texts = [...new Set([...document.querySelectorAll('h1,h2,h3,h4,button,li,[class*=title i],[class*=badge i]')].filter(vis).map(txt)
        .filter(t => t && t.length < 120 && !/\d{1,2}:\d{2}/.test(t)))].slice(0, 80); save(); return { done: true, reason: 'paywall', products: S.products.length }; }
    const f = fp();
    const inputs = [...document.querySelectorAll('input,textarea')].filter(i => vis(i) && !['hidden', 'checkbox', 'radio', 'submit', 'button', 'range', 'search'].includes(i.type));
    const c = clickables();
    const next = c.filter(el => NEXT.test(txt(el)) && !NEVER.test(txt(el))).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
    const opts = c.filter(el => el !== next && !NEXT.test(txt(el)) && !NEVER.test(txt(el)) && !COOKIE.test(txt(el)) && el.getBoundingClientRect().top > 50)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    if (inputs.length) {
      record('input');
      const plan = inputs.map(i => [i, ...valueFor(i)]);
      const block = plan.find(([, k, v]) => v == null);
      if (block) { save(); return { done: true, reason: block[1] === 'email_gate' ? 'email_gate' : block[1] + '_gate', screens: S.screens.length }; }
      plan.forEach(([i, , v]) => setVal(i, v)); S.fills++;
      await sleep(400);
      const n2 = clickables().filter(el => NEXT.test(txt(el)) && !NEVER.test(txt(el)))[0];
      if (n2) n2.click(); else { const form = inputs[0].form; if (form && form.requestSubmit) form.requestSubmit(); else inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
    } else if (opts.length) {
      record('question');
      opts[0].click(); await sleep(700);
      if (fp() === f) { const n2 = clickables().filter(el => NEXT.test(txt(el)) && !NEVER.test(txt(el)))[0]; if (n2) n2.click(); }
    } else if (next) { record('info'); next.click(); }
    else record('wait');
    for (let i = 0; i < 12 && fp() === f; i++) await sleep(700);
    if (fp() === f && cfg.auto_consent) { // dead end behind a consent checkbox: the owner opted in to auto-consent
      const boxes = [...document.querySelectorAll('input[type=checkbox],[role=checkbox]')].filter(b => vis(b.closest('label') || b) && !b.closest('#onetrust-consent-sdk,[id*=cookie i],[class*=cookie i]') && !(b.checked || b.getAttribute('aria-checked') === 'true') &&
        /consent|agree|accept|i confirm|terms/i.test(txt(b.closest('label') || b.parentElement || b)));
      for (const b of boxes) { (b.closest('label') || b).click(); S.consents = (S.consents || 0) + 1; await sleep(300); }
      if (boxes.length) { const n3 = clickables().filter(el => NEXT.test(txt(el)) && !NEVER.test(txt(el)))[0]; if (n3) n3.click(); for (let i = 0; i < 8 && fp() === f; i++) await sleep(600); }
    }
    if (fp() === f) { // still stuck: use the page's own "skip" if it offers one
      const sk = [...document.querySelectorAll('button,[role=button],a')].find(el => vis(el) && /^skip( this( question| step)?)?$/i.test(txt(el)));
      if (sk) { sk.click(); S.skipped = (S.skipped || 0) + 1; for (let i = 0; i < 8 && fp() === f; i++) await sleep(600); }
    }
    if (fp() === f) { S.stuck++; if (S.stuck >= 3) { save(); return { done: true, reason: 'stuck', at: heading().slice(0, 80), screens: S.screens.length }; } } else S.stuck = 0;
    if (S.screens.length > 140) { save(); return { done: true, reason: 'max_screens', screens: S.screens.length }; }
    save();
  }
  save();
  return { done: false, screens: S.screens.length, at: heading().slice(0, 60) };
};
JSON.stringify(await window.__fwWalk())
