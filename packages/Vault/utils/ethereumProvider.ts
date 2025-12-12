/**
 * Mobile-friendly Ethereum provider detection
 * Handles cases where providers are in different locations on mobile browsers
 */

export function getEthereumProvider(): any {
  if (typeof window === 'undefined') {
    return null;
  }

  const win = window as any;
  
  // Check multiple possible locations for ethereum provider
  const possibleProviders = [
    win.ethereum,
    win.web3?.currentProvider,
    win.web3,
    win.ethereum?.providers?.[0],
    win.ethereum?.providers?.find((p: any) => p.isMetaMask),
    // Check for mobile wallet providers
    win.trust,
    win.coinbase,
    win.phantom,
  ].filter(Boolean);
  
  return possibleProviders.length > 0 ? possibleProviders[0] : null;
}

export async function waitForEthereumProvider(timeout: number = 10000): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available');
  }

  // First check if it's already available
  let provider = getEthereumProvider();
  if (provider) {
    return provider;
  }

  // Wait for provider to load (mobile browsers may need time)
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = timeout / 100; // 100ms intervals
    
    const checkProvider = () => {
      const foundProvider = getEthereumProvider();
      
      if (foundProvider) {
        resolve(foundProvider);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkProvider, 100);
      } else {
        const isMobile = navigator.userAgent.includes('Mobile') || 
                        navigator.userAgent.includes('Android') || 
                        navigator.userAgent.includes('iPhone');
        
        if (isMobile) {
          reject(new Error('Ethereum provider not found. Please ensure MetaMask is installed and the page is refreshed after connecting your wallet.'));
        } else {
          reject(new Error('Ethereum provider not found. Please install MetaMask or connect a wallet.'));
        }
      }
    };
    
    checkProvider();
  });
}

