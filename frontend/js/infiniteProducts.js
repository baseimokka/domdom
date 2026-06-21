// frontend/js/infiniteProducts.js
// Reusable progressive product loader: initial page → infinite scroll →
// "Load More" fallback → skeleton cards → retry → state restoration.
//
// No dependencies, no build step. Attaches `ProductFeed` to window so any page
// (DomDom or NOOS) can drive its own grid by injecting a fetcher, a params
// builder and a card renderer — nothing here is store-specific.
//
// Usage:
//   const feed = new ProductFeed({
//     grid:        document.getElementById('products-grid'),
//     fetchPage:   (params, page, limit) => API.getProducts({ ...params, page, limit }),
//     getParams:   buildParams,          // () => ({ category, sort, ... })
//     renderCard:  cardHTML,             // (product) => htmlString
//     afterRender: () => initReveal(),   // optional hook after cards mount
//     onTotal:     (total) => {...},     // optional, e.g. update results count
//     pageSize:    12
//   });
//   feed.reload();                       // first load (page 1)
//   feed.reload(n);                      // restore: load pages 1..n in one request
//   feed.loadMore();                     // append the next page

(function () {
  'use strict';

  const DEFAULTS = {
    pageSize:        12,
    skeletonCount:   12,     // skeletons on a fresh load (fills the grid)
    appendSkeletons: 4,      // skeletons while appending the next page
    prefetchMargin:  '300px' // fetch this far before the sentinel is reached
  };

  // A single skeleton card. Reuses `.product-card` so it inherits the exact grid
  // cell size of a real card; inner `.skeleton-*` blocks mimic image + text.
  const SKELETON =
    '<div class="product-card skeleton-card" aria-hidden="true">' +
      '<div class="skeleton skeleton-img"></div>' +
      '<div class="product-info">' +
        '<div class="skeleton skeleton-line skeleton-line-sm"></div>' +
        '<div class="skeleton skeleton-line skeleton-line-lg"></div>' +
        '<div class="skeleton skeleton-line skeleton-line-md"></div>' +
        '<div class="product-footer">' +
          '<div class="skeleton skeleton-line skeleton-line-price"></div>' +
          '<div class="skeleton skeleton-pill"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  class ProductFeed {
    constructor(opts) {
      this.o = Object.assign({}, DEFAULTS, opts);
      if (!this.o.grid)       throw new Error('ProductFeed: grid is required');
      if (!this.o.fetchPage)  throw new Error('ProductFeed: fetchPage is required');
      if (!this.o.renderCard) throw new Error('ProductFeed: renderCard is required');

      this.grid        = this.o.grid;
      this.pageSize    = this.o.pageSize;
      this.getParams   = this.o.getParams   || (() => ({}));
      this.renderCard  = this.o.renderCard;
      this.afterRender = this.o.afterRender || (() => {});

      this.products  = [];
      this.total     = 0;
      this.page      = 0;     // number of pages currently loaded
      this.hasMore   = true;
      this.loading   = false;
      this.params    = {};
      this.paramsSig = '';
      this._token    = 0;     // guards against out-of-order / stale responses
      this._lastWasFresh = true;

      this._buildControls();
      this._initObserver();
    }

    // ── public ────────────────────────────────────────────────────────────

    // Fresh load of page 1 (first render and every filter/sort change).
    // `pages` > 1 loads several pages in one request (used by state restoration).
    reload(pages) {
      return this._loadFresh(Math.max(parseInt(pages, 10) || 1, 1));
    }

    // Append the next page. Safe to call repeatedly — guarded against
    // concurrent requests and against running past the last page.
    loadMore() {
      if (this.loading || !this.hasMore) return;
      return this._loadNext();
    }

    destroy() {
      if (this._io) this._io.disconnect();
      if (this.controls) this.controls.remove();
    }

    // ── DOM scaffold ──────────────────────────────────────────────────────

    _buildControls() {
      const c = document.createElement('div');
      c.className = 'feed-controls';
      c.innerHTML =
        '<button type="button" class="feed-load-more" hidden>Load More</button>' +
        '<div class="feed-error" hidden>' +
          '<span class="feed-error-msg">Couldn\'t load more products.</span>' +
          '<button type="button" class="feed-retry">Retry</button>' +
        '</div>' +
        '<div class="feed-sentinel" aria-hidden="true"></div>';
      this.grid.insertAdjacentElement('afterend', c);

      this.controls = c;
      this.btnMore  = c.querySelector('.feed-load-more');
      this.errorBox = c.querySelector('.feed-error');
      this.sentinel = c.querySelector('.feed-sentinel');

      this.btnMore.addEventListener('click', () => this.loadMore());
      c.querySelector('.feed-retry').addEventListener('click', () => this._retry());
    }

    _initObserver() {
      if (!('IntersectionObserver' in window)) return; // graceful: button still works
      this._io = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) this.loadMore();
      }, { rootMargin: this.o.prefetchMargin });
    }

    _observe(on) {
      if (!this._io) return;
      if (on) this._io.observe(this.sentinel);
      else    this._io.unobserve(this.sentinel);
    }

    // ── loading ───────────────────────────────────────────────────────────

    async _loadFresh(pages) {
      const token = ++this._token;     // invalidate any in-flight request
      this.loading = true;
      this._lastWasFresh = true;
      this._observe(false);
      this._setError(false);
      this.btnMore.hidden = true;

      this.params    = this.getParams();
      this.paramsSig = JSON.stringify(this.params);
      this._renderSkeletons(this.o.skeletonCount, false);

      try {
        const limit = pages * this.pageSize;
        const data  = await this.o.fetchPage(this.params, 1, limit);
        if (token !== this._token) return;           // superseded by a newer reload
        this.products = data.products || [];
        this.total    = (data.total != null) ? data.total : this.products.length;
        this.page     = pages;
        this.hasMore  = !!data.hasMore;
        this._renderFresh();
      } catch (e) {
        if (token !== this._token) return;
        this._renderFreshError();
      } finally {
        if (token === this._token) this.loading = false;
      }
    }

    async _loadNext() {
      const token = this._token;       // stay within the current params epoch
      this.loading = true;
      this._lastWasFresh = false;
      this.btnMore.hidden = true;
      this._setError(false);
      this._renderSkeletons(this.o.appendSkeletons, true);

      try {
        const data = await this.o.fetchPage(this.params, this.page + 1, this.pageSize);
        if (token !== this._token) return;           // a reload happened meanwhile
        this._clearSkeletons();
        const fresh = data.products || [];
        this.products = this.products.concat(fresh);
        this.total    = (data.total != null) ? data.total : this.total;
        this.page    += 1;
        this.hasMore  = !!data.hasMore;
        this._appendCards(fresh);
        this._afterPage();
      } catch (e) {
        if (token !== this._token) return;
        this._clearSkeletons();
        this._setError(true);           // keep already-loaded products, offer retry
        this._observe(false);
      } finally {
        if (token === this._token) this.loading = false;
      }
    }

    _retry() {
      this._setError(false);
      if (this._lastWasFresh) this._loadFresh(1);
      else                    this._loadNext();
    }

    // ── rendering ─────────────────────────────────────────────────────────

    _renderSkeletons(n, append) {
      const html = SKELETON.repeat(n);
      if (append) this.grid.insertAdjacentHTML('beforeend', html);
      else        this.grid.innerHTML = html;
    }

    _clearSkeletons() {
      this.grid.querySelectorAll('.skeleton-card').forEach(el => el.remove());
    }

    _renderFresh() {
      this._emitTotal(this.total);
      if (!this.products.length) {
        this.grid.innerHTML =
          '<p class="feed-empty" style="text-align:center;color:var(--muted);grid-column:1/-1;padding:3rem">' +
            'No products match your filters.' +
          '</p>';
        this._afterPage();
        return;
      }
      this.grid.innerHTML = this.products.map(this.renderCard).join('');
      this.afterRender();
      this._afterPage();
    }

    _appendCards(list) {
      if (list.length) {
        this.grid.insertAdjacentHTML('beforeend', list.map(this.renderCard).join(''));
        this._emitTotal(this.total);
        this.afterRender();
      }
    }

    _renderFreshError() {
      this._emitTotal(null);
      this.grid.innerHTML =
        '<div class="feed-fresh-error" style="text-align:center;grid-column:1/-1;padding:3rem;color:var(--muted)">' +
          '<p style="margin-bottom:1rem">Couldn\'t load products.</p>' +
          '<button type="button" class="feed-retry">Retry</button>' +
        '</div>';
      this.grid.querySelector('.feed-retry')
        .addEventListener('click', () => this._loadFresh(1));
    }

    // Show/hide Load More + sentinel based on whether more pages remain.
    _afterPage() {
      this.btnMore.hidden = !this.hasMore;
      this._observe(this.hasMore);
    }

    _setError(on) {
      this.errorBox.hidden = !on;
      if (on) this.btnMore.hidden = true;
    }

    _emitTotal(total) {
      if (typeof this.o.onTotal === 'function') this.o.onTotal(total);
    }
  }

  window.ProductFeed = ProductFeed;
})();
