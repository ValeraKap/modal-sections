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
        this.checkboxes = this.querySelectorAll('.featured-products-modal__checkbox-input');
        this.sectionId = this.dataset.sectionId;
        this.showOnce = this.dataset.showOnce === 'true';
        this.storageKey = `featured-products-modal-${this.sectionId}`;
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
          this.closeButton.addEventListener('click', () => this.hide());
        }

        if (this.addToCartButton) {
          this.addToCartButton.addEventListener('click', () => this.handleAddToCart());
        }

        if (this.continueToCartButton) {
          this.continueToCartButton.addEventListener('click', (event) => this.handleContinueToCart(event));
        }

        // Checkbox change handlers
        this.checkboxes.forEach((checkbox) => {
          checkbox.addEventListener('change', () => this.updateButtonState());
        });

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
        const shown = localStorage.getItem(this.storageKey);
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

        // Calculate savings (simplified - you might want to calculate actual savings)
        const savings = this.calculateSavings();

        // Update intro text
        this.introText.textContent = `You are trying to add ${productTitleText} to the cart. Complete your look and save ${savings}!`;
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
          return new Intl.NumberFormat(document.documentElement.lang || 'en', {
            style: 'currency',
            currency: 'USD'
          }).format(totalSavings / 100);
        }

        return '$0';
      }

      show() {
        if (!this.shouldShowModal()) {
          return;
        }

        // Mark as shown in localStorage if needed
        if (this.showOnce) {
          localStorage.setItem(this.storageKey, 'true');
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

        // Update button state
        this.updateButtonState();
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
      }

      updateButtonState() {
        const checkedProducts = Array.from(this.checkboxes).filter((cb) => cb.checked);
        const hasChecked = checkedProducts.length > 0;

        if (this.addToCartButton) {
          this.addToCartButton.disabled = !hasChecked;
          if (!hasChecked) {
            this.addToCartButton.setAttribute('aria-disabled', 'true');
          } else {
            this.addToCartButton.removeAttribute('aria-disabled');
          }
        }
      }

      async handleAddToCart() {
        const checkedProducts = Array.from(this.checkboxes)
          .filter((cb) => cb.checked)
          .map((cb) => ({
            variantId: parseInt(cb.dataset.productVariantId),
            quantity: 1
          }));

        if (checkedProducts.length === 0) {
          return;
        }

        // Disable buttons
        if (this.addToCartButton) {
          this.addToCartButton.disabled = true;
          this.addToCartButton.classList.add('loading');
        }

        try {
          // First, add the original product (if not already added)
          if (this.currentVariantId && this.pendingFormData) {
            await this.addProductToCart(this.currentVariantId, 1);
          }

          // Then add all selected products to cart
          const addPromises = checkedProducts.map((product) => this.addProductToCart(product.variantId, product.quantity));
          await Promise.all(addPromises);

          // Update cart
          if (this.cart) {
            const cartResponse = await fetch(`${window.routes.cart_url}.js`);
            const cartData = await cartResponse.json();
            
            const sections = this.cart.getSectionsToRender ? this.cart.getSectionsToRender().map((s) => s.id) : [];
            const sectionsResponse = await fetch(`${window.routes.cart_url}?sections=${sections.join(',')}`);
            const sectionsData = await sectionsResponse.json();

            // Remove is-empty class from cart drawer
            if (this.cart.classList.contains('is-empty')) {
              this.cart.classList.remove('is-empty');
            }

            if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'featured-products-modal',
                cartData: {
                  ...cartData,
                  sections: sectionsData
                }
              });
            }

            this.cart.renderContents({
              ...cartData,
              sections: sectionsData
            });
          }

          // Hide modal
          this.hide();
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

        // Add the original product to cart (it was intercepted, so we need to add it now)
        if (this.currentVariantId && this.pendingFormData) {
          try {
            await this.addProductToCart(this.currentVariantId, 1);

            // Update cart
            if (this.cart) {
              const cartResponse = await fetch(`${window.routes.cart_url}.js`);
              const cartData = await cartResponse.json();
              
              const sections = this.cart.getSectionsToRender ? this.cart.getSectionsToRender().map((s) => s.id) : [];
              const sectionsResponse = await fetch(`${window.routes.cart_url}?sections=${sections.join(',')}`);
              const sectionsData = await sectionsResponse.json();

              // Remove is-empty class from cart drawer
              if (this.cart.classList.contains('is-empty')) {
                this.cart.classList.remove('is-empty');
              }

              if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
                publish(PUB_SUB_EVENTS.cartUpdate, {
                  source: 'featured-products-modal',
                  cartData: {
                    ...cartData,
                    sections: sectionsData
                  }
                });
              }

              this.cart.renderContents({
                ...cartData,
                sections: sectionsData
              });
            }
          } catch (error) {
            console.error('Error adding product to cart:', error);
          }
        }

        // Hide modal and redirect
        this.hide();
        
        // Small delay to ensure cart is updated
        setTimeout(() => {
          window.location.href = window.routes.cart_url;
        }, 300);
      }

      async addProductToCart(variantId, quantity = 1) {
        const config = typeof fetchConfig !== 'undefined' ? fetchConfig('javascript') : {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        };

        const formData = new FormData();
        formData.append('id', variantId);
        formData.append('quantity', quantity);

        if (this.cart) {
          const sections = this.cart.getSectionsToRender ? this.cart.getSectionsToRender().map((s) => s.id) : [];
          formData.append('sections', sections.join(','));
          formData.append('sections_url', window.location.pathname);
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

      disconnectedCallback() {
        // Cleanup if needed
      }
    }
  );
}

