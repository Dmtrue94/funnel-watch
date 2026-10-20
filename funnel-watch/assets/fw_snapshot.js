// Funnel Watch · © 2026 Dzmitry · https://github.com/Dmtrue94/funnel-watch
// Licensed under CC BY-NC 4.0: credit the author and link the repo; no commercial use without permission.
// Funnel Watch · build a normalized snapshot after fw_walk.js finished (run on the final page).
// Generic part comes from the walk; known funnel builders are enriched from their own data.
const __r = await (async () => {
  const cfg = JSON.parse(sessionStorage.getItem('__fw_cfg') || '{}');
  const S = JSON.parse(sessionStorage.getItem('__fw') || 'null') || { screens: [], paths: [], products: [] };
  const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const slug = s => strip(s).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'screen';
  const counts = {};
  const screens = (S.screens || []).filter((s, i, a) => !(i && a[i - 1].title === s.title && (s.kind === 'wait' || a[i - 1].kind === 'wait')));
  const steps = screens.map(s => { const b = slug(s.title); counts[b] = (counts[b] || 0) + 1;
    return { key: counts[b] > 1 ? `${b}#${counts[b]}` : b, type: s.kind, title: strip(s.title).slice(0, 200), options: s.options && s.options.length ? s.options : null, path: s.path }; });
  const snap = {
    competitor: cfg.id || location.host, platform: 'generic', variant: location.host + (S.paths[0] || '/'),
    meta: { host: location.host, entry_url: S.start, final_path: location.pathname, stop_reason: cfg.stop_reason || null, screens_walked: S.screens.length },
    funnel_map: (S.paths || []).map((p, i) => ({ key: `${i}:${p}`, page: p })),
    steps, products: (S.products || []).map(p => ({ key: p.key, name: p.label, prices: p.prices.join(' · ') })),
    paywall_texts: S.paywall_texts || [],
  };

  // --- Rise / Runwayer builder (e.g. quiz.calm.com): full config + USD prices from its API
  try {
    const oid = new URLSearchParams(location.search).get('onboardId');
    if (oid) {
      const ob = await fetch('/api/v1/onboards/' + oid).then(r => r.json());
      if (ob && ob.config) {
        const conf = ob.config, app = conf.app || {}, base = (ob.paywallId || '').split('_')[0];
        const pw = base ? await fetch(`/api/v2/paywalls/${base}?onboardId=${oid}`).then(r => r.json()).catch(() => ({})) : {};
        snap.platform = 'rise';
        snap.variant = `${conf.slug}|flow:${conf.flowSlug}|pw:${ob.paywallId}`;
        Object.assign(snap.meta, { config_slug: conf.slug, flow_slug: conf.flowSlug, paywall_id: ob.paywallId, max_screens: ob.maxScreens, stats_users: app.statsUsers, stats_reviews: app.statsReviews, paywall_version: pw.version });
        snap.steps = (ob.pages || []).map(p => { const bl = p.blocks || []; const o = bl.find(b => b.type === 'options');
          return { key: String(p.order), type: bl.map(b => b.type).join(','), title: strip(typeof p.data.title === 'string' ? p.data.title : JSON.stringify(p.data.title)).slice(0, 200),
            options: o ? (o.value || []).map(x => strip(typeof x === 'string' ? x : JSON.stringify(x))) : null,
            texts: bl.filter(b => typeof b.value === 'string' && ['title', 'statement', 'text', 'subtitle', 'button'].includes(b.type) && b.isStatic !== false).map(b => strip(b.value).slice(0, 300)) }; });
        const prods = ((pw.config || {}).products || []).map(p => { const s = (p.provider || {}).stripe || {}; const usd = (s.prices || []).find(x => x.currency === 'usd');
          return { key: p.ref || p.name, name: p.name, period: s.interval ? s.interval + 'x' + s.intervalCount : 'one-time', trial_days: s.trialPeriodDays || null, price: usd ? usd.amount / 100 : null, currency: 'USD', discount_pct: p.discount || null }; });
        if (prods.length) snap.products = prods;
        snap.funnel_map = snap.funnel_map.concat(((pw.config || {}).screens || []).map((s, i) => ({ key: 'paywall:' + i, page: s.name || s.displayName })));
        const texts = []; const walk = (o, d) => { if (d > 12 || !o) return; if (Array.isArray(o)) return o.forEach(x => walk(x, d + 1));
          if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'schema') continue;
            if (typeof v === 'string' && /^(title|subtitle|text|buttonText|description|statement|label|expireTitle|badge)$/.test(k) && v.length > 1 && v.length < 400 && !v.startsWith('http')) texts.push(strip(v)); else walk(v, d + 1); } };
        walk((pw.config || {}).screens, 0); walk(pw.firstScreen, 0);
        if (texts.length) snap.paywall_texts = [...new Set(texts)].slice(0, 300);
      }
    }
  } catch (e) { snap.meta.enrich_error = 'rise: ' + e.message; }

  // --- Next.js + Redux quiz (e.g. quiz.betterme.world): whole quiz tree, sales-funnel map, plan matrix
  try {
    const root = document.getElementById('__next');
    const k = root && Object.keys(root).find(k => k.startsWith('__reactContainer'));
    let store; const stack = k ? [root[k]] : []; const seen = new Set();
    while (stack.length && !store && seen.size < 8000) { const n = stack.pop(); if (!n || seen.has(n)) continue; seen.add(n);
      const p = n.memoizedProps; if (p && p.store && p.store.getState) { store = p.store; break; } if (n.child) stack.push(n.child); if (n.sibling) stack.push(n.sibling); }
    const st = store && store.getState();
    if (st && st.quiz && st.quiz.structure && Object.keys(st.quiz.structure).length) {
      const f = (st.flow && st.flow.data) || {};
      snap.platform = 'next-redux';
      snap.variant = `flow:${f.id}|sf:${f.salesFunnelId}`;
      Object.assign(snap.meta, { flow_id: f.id, topic: f.topic, plan_label: f.planLabel, sales_funnel_id: f.salesFunnelId, landing_path: f.landingPagePath });
      const qs = []; for (const [g, items] of Object.entries(st.quiz.structure)) { const gn = g === '0' ? 'F' : g === '1' ? 'M' : g;
        items.forEach(x => qs.push({ key: `${gn}:${x.questionId || x.id}`, type: `${x.type}/${x.questionType || ''}`, title: strip(x.title).slice(0, 200), options: (x.answerOptions || []).map(o => o.title).filter(Boolean) })); }
      snap.steps = qs;
      const pi = (st.generatedSaleFunnel && st.generatedSaleFunnel.pagesInfo) || [];
      if (pi.length) snap.funnel_map = pi.map(p => ({ key: `${p.pageOrder}:${p.pageUrl}`, page: p.pageUrl, tag: p.pageTag || p.pageType }));
      const E = (st.plans && st.plans.entities) || {};
      const cur = Object.keys((st.utils && st.utils.currencyRateToUsd) || {})[0] || 'USD';
      const prods = [];
      for (const ps of Object.values(E.planSets || {})) for (const [role, v] of Object.entries(ps)) { if (role === 'id' || !v) continue;
        (Array.isArray(v) ? v : [v]).forEach((id, i) => { const p = (E.plans || {})[id]; if (!p) return; const c = (E.countryPlans || {})[p.countryPlan] || {};
          prods.push({ key: `${ps.id}:${role}${Array.isArray(v) ? i : ''}`, name: p.name, period_days: p.days, trial_days: p.trialDays || 0,
            intro_price: c.introductoryPrice != null ? c.introductoryPrice / 100 : null, list_price: c.amount / 100, renewal_price: c.discountedPrice / 100, discount_pct: c.discount, currency: cur }); }); }
      if (prods.length) { snap.products = prods; snap.currency = cur; snap.country = st.utils && st.utils.countryByIp && st.utils.countryByIp.code; }
    }
  } catch (e) { snap.meta.enrich_error = (snap.meta.enrich_error ? snap.meta.enrich_error + '; ' : '') + 'next: ' + e.message; }
  return snap;
})();
'FWJSON<<' + JSON.stringify(__r) + '>>FWJSON' + ' '.repeat(90000)
