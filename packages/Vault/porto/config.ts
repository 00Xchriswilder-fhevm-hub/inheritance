/**
 * Porto SDK Configuration
 * 
 * This file contains configuration for Porto passkeys wallet integration.
 * Porto uses EIP-6963 to inject itself as a wallet provider.
 */

import { Porto, Mode, Dialog } from 'porto';

// Store Porto instance globally so we can access it
let portoInstance: ReturnType<typeof Porto.create> | null = null;

/**
 * Initialize Porto SDK
 * This injects Porto as a wallet provider via EIP-6963,
 * making it available for wallet connection libraries like RainbowKit
 * 
 * Configured to use iframe dialog mode for better UX (requires HTTPS)
 */
export const initializePorto = () => {
  try {
    portoInstance = Porto.create({
      mode: Mode.dialog({
        renderer: Dialog.iframe(), // Use iframe for better UX (requires HTTPS)
      }),
    });
    console.log('✅ Porto SDK initialized successfully');
    return portoInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Porto SDK:', error);
    return null;
  }
};

/**
 * Get the Porto instance (for accessing connector directly if needed)
 */
export const getPortoInstance = () => portoInstance;

