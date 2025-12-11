if (!customElements.get('featured-products-modal')) {
  customElements.define(
    'featured-products-modal',
    class FeaturedProductsModal extends HTMLElement {
      constructor() {
        super();
        this.modal = this.querySelector('modal-dialog');
        this.closeButton = this.querySelector('.featured-products-modal__close');
        this.addToCartButton = this.querySelector('[data-add-to-cart]');
        this.continueToCartButton = this.querySelector('[data-continue-to-cart]');
        this.introText = this.querySelector('[data-intro-text]');
        this.introSavings = this.querySelector('[data-intro-savings]');
        this.sectionId = this.dataset.sectionId;
        this.showOnce = this.dataset.showOnce === 'true';
        this.storageKey = `featured-products-modal-${this.sectionId}`;
        this.storage = this.getSessionStorage();
        this.currentProduct = null;
        this.currentVariantId = null;
        this.productsData = null;
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');

        this.init();
      }

      init() {
        // Load products data
        const dataElement = document.getElementById(`FeaturedProductsData-${this.sectionId}`);
        if (dataElement) {
          this.productsData = JSON.parse(dataElement.textContent);
        }

        // Setup event listeners
        if (this.closeButton) {
          this.closeButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
          });
        }

        // Setup mobile close button
        const mobileCloseButton = this.querySelector('.featured-products-modal__close--mobile');
        if (mobileCloseButton) {
          mobileCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
          });
        }
        
        // Setup all close buttons (including ones in header)
        const allCloseButtons = this.querySelectorAll('.featured-products-modal__close');
        allCloseButtons.forEach(button => {
          if (button !== this.closeButton && button !== mobileCloseButton) {
            button.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.hide();
            });
          }
        });

        if (this.addToCartButton) {
          this.addToCartButton.addEventListener('click', () => this.handleAddToCart());
        }

        if (this.continueToCartButton) {
          this.continueToCartButton.addEventListener('click', (event) => this.handleContinueToCart(event));
        }

        // Intercept product form submission
        this.interceptProductForm();

        // Close on escape key
        this.addEventListener('keyup', (event) => {
          if (event.code === 'Escape') {
            this.hide();
          }
        });

        // Close on backdrop click
        if (this.modal) {
          this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
              this.hide();
            }
          });
        }

        this.normalizeCurrencySpacing();
      }

      interceptProductForm() {
        // Only intercept on product pages
        if (!document.querySelector('product-info')) {
          return;
        }

        // Find all product forms on the page
        const productForms = document.querySelectorAll('product-form');
        
        productForms.forEach((form) => {
          const formElement = form.querySelector('form');
          if (!formElement) return;

          // Intercept form submission
          formElement.addEventListener('submit', (event) => {
            // Check if modal should be shown
            if (!this.shouldShowModal()) {
              return; // Let form submit normally
            }

            // Prevent default submission
            event.preventDefault();
            event.stopPropagation();

            // Get product info
            const productInfo = document.querySelector('product-info');
            if (!productInfo) {
              return;
            }

            const productId = productInfo.dataset.productId;
            const variantIdInput = formElement.querySelector('[name="id"]');
            const variantId = variantIdInput ? variantIdInput.value : null;
            const productHandle = productInfo.dataset.url?.split('/products/')[1]?.split('?')[0];

            if (!productId || !variantId || !productHandle) {
              return;
            }

            // Store current product info
            this.currentProduct = {
              id: productId,
              handle: productHandle,
              variantId: variantId
            };
            this.currentVariantId = variantId;
            this.pendingForm = formElement;
            this.pendingFormData = new FormData(formElement);

            // Update modal image if needed
            this.updateModalImage(productId);

            // Update intro text
            this.updateIntroText(productHandle);

            // Show modal
            this.show();
          }, true); // Use capture phase to intercept before product-form.js
        });
      }

      shouldShowModal() {
        // Check if we're on a product page
        if (!document.querySelector('product-info')) {
          return false;
        }

        // Check if modal should be shown
        if (!this.showOnce) {
          return true;
        }

        // Check localStorage
        const shown = this.storage ? this.storage.getItem(this.storageKey) : null;
        return !shown;
      }

      updateModalImage(productId) {
        // If no custom image is set, fetch product image
        if (!this.productsData?.image && productId) {
          // Try to get product image from the page
          const productInfo = document.querySelector(`product-info[data-product-id="${productId}"]`);
          if (productInfo) {
            // Try to get featured image
            const productImage = productInfo.querySelector('.product__media img, .product-media-gallery img');
            if (productImage && productImage.src) {
              const imageWrapper = this.querySelector('.featured-products-modal__image-wrapper');
              if (imageWrapper) {
                let img = imageWrapper.querySelector('img');
                if (img) {
                  img.src = productImage.src;
                  img.alt = productImage.alt || '';
                } else {
                  // Create new image element
                  img = document.createElement('img');
                  img.src = productImage.src;
                  img.alt = productImage.alt || '';
                  img.className = 'featured-products-modal__image';
                  img.loading = 'lazy';
                  img.width = 800;
                  imageWrapper.innerHTML = '';
                  imageWrapper.appendChild(img);
                }
              }
            }
          }
        }
      }

      updateIntroText(productHandle) {
        if (!this.introText || !productHandle) {
          return;
        }

        // Get product title from the page
        const productTitle = document.querySelector('product-info h1, product-info .product__title h1, product-info .product__title h2');
        const productTitleText = productTitle?.textContent?.trim() || productHandle.replace(/-/g, ' ');
        
        // Update intro text with bold product name
        this.introText.innerHTML = `You are trying to add <strong>${productTitleText}</strong> to the cart.`;
        
        // Calculate and display savings
        const savings = this.calculateSavings();
        if (this.introSavings && savings !== '$0') {
          this.introSavings.innerHTML = `Complete your look and save <strong>${savings}!</strong>`;
        } else if (this.introSavings) {
          this.introSavings.textContent = 'Complete your look!';
        }
      }

      calculateSavings() {
        if (!this.productsData?.products) {
          return '$0';
        }

        let totalSavings = 0;
        this.productsData.products.forEach((product) => {
          if (product.compare_at_price && product.price) {
            const savings = product.compare_at_price - product.price;
            totalSavings += savings;
          }
        });

        if (totalSavings > 0) {
          const savingsAmount = totalSavings / 100;
          // Remove .00 for whole numbers
          const formatted = savingsAmount % 1 === 0 ? savingsAmount.toString() : savingsAmount.toFixed(2);
          return `$${formatted}`;
        }

        return '$0';
      }

      show() {
        if (!this.shouldShowModal()) {
          return;
        }

        // Mark as shown in localStorage if needed
        if (this.showOnce) {
          if (this.storage) {
            this.storage.setItem(this.storageKey, 'true');
          }
        }

        // Show modal
        this.setAttribute('open', '');
        if (this.modal) {
          this.modal.show();
        }
        document.body.classList.add('overflow-hidden');

        // Trap focus
        if (typeof trapFocus !== 'undefined') {
          trapFocus(this, this.querySelector('[role="dialog"]'));
        }

        // Normalize currency display once on init
        this.normalizeCurrencySpacing();
      }

      hide() {
        this.removeAttribute('open');
        if (this.modal) {
          this.modal.hide();
        }
        document.body.classList.remove('overflow-hidden');

        // Remove focus trap
        if (typeof removeTrapFocus !== 'undefined') {
          removeTrapFocus();
        }

        // Reset button states
        if (this.addToCartButton) {
          this.addToCartButton.disabled = false;
          this.addToCartButton.classList.remove('loading');
        }

        this.pendingFormData = null;
        this.currentVariantId = null;
        this.currentProduct = null;
        this.pendingForm = null;
      }


      async handleAddToCart() {
        // Build list of items to add: current product (if present) + all available featured products
        const itemsToAdd = [];
        const seenVariants = new Set();
        const addItem = (variantId, quantity = 1) => {
          if (!variantId || seenVariants.has(variantId)) return;
          seenVariants.add(variantId);
          itemsToAdd.push({ variantId, quantity });
        };

        if (this.currentVariantId && this.pendingFormData) {
          addItem(this.currentVariantId, 1);
        }

        const allProducts = this.productsData?.products || [];
        allProducts
          .filter((product) => product.available)
          .forEach((product) => addItem(product.variant_id, 1));

        if (itemsToAdd.length === 0) {
          return;
        }

        // Disable buttons
        if (this.addToCartButton) {
          this.addToCartButton.disabled = true;
          this.addToCartButton.classList.add('loading');
        }

        try {
          const isCartNotification = this.cart && this.cart.tagName === 'CART-NOTIFICATION';
          let response = null;

          if (isCartNotification) {
             // For cart-notification, we leave sequential requests to get key/sections that are not in the batch response
            const lastIndex = itemsToAdd.length - 1;
            for (let index = 0; index < itemsToAdd.length; index++) {
              const item = itemsToAdd[index];
              try {
                const res = await this.addProductToCart(item.variantId, item.quantity, index === lastIndex);
                response = res;
              } catch (error) {
                console.error(`Error adding product ${item.variantId}:`, error);
              }
            }
          } else {
            // For cart-drawer and other contexts — one batch request
            response = await this.addProductsToCart(itemsToAdd, true);
          }

          if (this.cart && response) {
            if (this.cart.classList.contains('is-empty')) {
              this.cart.classList.remove('is-empty');
            }

            // Hide modal first (needed for cart-notification)
            this.hide();

            if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'featured-products-modal',
                cartData: response
              });
            }

            this.cart.renderContents(response);
          } else {
            this.hide();
          }
        } catch (error) {
          console.error('Error adding products to cart:', error);
          if (this.addToCartButton) {
            this.addToCartButton.disabled = false;
            this.addToCartButton.classList.remove('loading');
          }
        }
      }

      async handleContinueToCart(event) {
        // Prevent default link behavior if it's a link
        if (event) {
          event.preventDefault();
        }

        // Add the original product to cart silently (without triggering cart drawer/notification)
        if (this.currentVariantId && this.pendingFormData) {
          try {
            // Add product without sections (no need to update cart drawer/notification)
            await this.addProductToCart(this.currentVariantId, 1, false);
          } catch (error) {
            console.error('Error adding product to cart:', error);
          }
        }

        // Hide modal and redirect immediately
        this.hide();
        
        // Redirect to cart page
        window.location.href = window.routes.cart_url;
      }

      async addProductToCart(variantId, quantity = 1, includeSections = false) {
        const config = typeof fetchConfig !== 'undefined' ? fetchConfig('javascript') : {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        };

        const formData = new FormData();
        formData.append('id', variantId);
        formData.append('quantity', quantity);

        // Include sections only when requested (for cart-notification key)
        if (includeSections && this.cart && this.cart.getSectionsToRender) {
          const sections = this.cart.getSectionsToRender().map((s) => s.id);
          if (sections.length > 0) {
            formData.append('sections', sections.join(','));
            formData.append('sections_url', window.location.pathname);
            if (this.cart.setActiveElement) {
              this.cart.setActiveElement(document.activeElement);
            }
          }
        }

        config.body = formData;
        if (config.headers['Content-Type']) {
          delete config.headers['Content-Type'];
        }

        const response = await fetch(`${window.routes.cart_add_url}`, config);
        
        if (!response.ok) {
          throw new Error('Failed to add product to cart');
        }

        return response.json();
      }

      async addProductsToCart(items, includeSections = false) {
        const config = typeof fetchConfig !== 'undefined' ? fetchConfig('javascript') : {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        };

        const formData = new FormData();
        items.forEach((item, index) => {
          formData.append(`items[${index}][id]`, item.variantId);
          formData.append(`items[${index}][quantity]`, item.quantity);
        });

        if (includeSections && this.cart && this.cart.getSectionsToRender) {
          const sections = this.cart.getSectionsToRender().map((s) => s.id);
          if (sections.length > 0) {
            formData.append('sections', sections.join(','));
            formData.append('sections_url', window.location.pathname);
            if (this.cart.setActiveElement) {
              this.cart.setActiveElement(document.activeElement);
            }
          }
        }

        config.body = formData;
        if (config.headers['Content-Type']) {
          delete config.headers['Content-Type'];
        }

        const response = await fetch(`${window.routes.cart_add_url}`, config);

        if (!response.ok) {
          throw new Error('Failed to add products to cart');
        }

        return response.json();
      }

      normalizeCurrencySpacing() {
        const priceElements = this.querySelectorAll('.featured-products-modal__price-current, .featured-products-modal__price-compare');
        priceElements.forEach((element) => {
          const text = element.textContent;
          // Trim leading whitespace, remove space after leading "$", drop trailing ".00" for USD-like formats
          const trimmed = text.replace(/^[\s\u00a0]+/, '');
          let cleaned = trimmed.replace(/^\$\s+/, '$');
          cleaned = cleaned.replace(/(\$[\d,]+)\.00$/, '$1');
          element.textContent = cleaned;
        });
      }

      getSessionStorage() {
        try {
          const testKey = 'featured-products-modal__session-check';
          window.sessionStorage.setItem(testKey, '1');
          window.sessionStorage.removeItem(testKey);
          return window.sessionStorage;
        } catch (error) {
          console.warn('Session storage unavailable, falling back to always show modal when enabled.', error);
          return null;
        }
      }
    }
  );
}
