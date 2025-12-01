/**
 * IPFS Service using Pinata
 * Handles uploading and downloading encrypted files to/from IPFS
 */

const PINATA_API_URL = 'https://api.pinata.cloud';

export interface PinataResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
}

export interface PinataMetadata {
    name?: string;
    keyvalues?: Record<string, string>;
}

/**
 * Upload data to IPFS via Pinata
 * @param data The data to upload (string, Blob, or File)
 * @param metadata Optional metadata for the file
 * @returns IPFS CID (hash)
 */
export async function uploadToIPFS(
    data: string | Blob | File,
    metadata?: PinataMetadata
): Promise<string> {
    console.log('🌐 [IPFS] Starting IPFS upload to Pinata...');
    const jwt = import.meta.env.VITE_PINATA_JWT;
    
    if (!jwt) {
        throw new Error('Pinata JWT not configured. Please set VITE_PINATA_JWT in your .env file');
    }

    // Create FormData
    const formData = new FormData();
    
    // Add file data
    let dataSize: number;
    if (data instanceof File || data instanceof Blob) {
        dataSize = data.size;
        formData.append('file', data);
        console.log(`📤 [IPFS] Adding ${data instanceof File ? 'File' : 'Blob'} to upload (${dataSize} bytes)`);
    } else {
        // Create a Blob from string
        dataSize = data.length;
        const blob = new Blob([data], { type: 'text/plain' });
        formData.append('file', blob, 'vault-data.txt');
        console.log(`📤 [IPFS] Creating Blob from string (${dataSize} chars, ${blob.size} bytes)`);
    }

    // Add metadata if provided
    if (metadata) {
        formData.append('pinataMetadata', JSON.stringify(metadata));
        console.log('📋 [IPFS] Metadata added:', metadata);
    }

    // Add options
    const options = {
        cidVersion: 1,
        wrapWithDirectory: false,
    };
    formData.append('pinataOptions', JSON.stringify(options));
    console.log('⚙️ [IPFS] Options:', options);

    try {
        console.log('🚀 [IPFS] Uploading to Pinata...');
        const startTime = Date.now();
        const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwt}`,
            },
            body: formData,
        });

        const uploadTime = Date.now() - startTime;
        console.log(`⏱️ [IPFS] Upload completed in ${uploadTime}ms`);

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ [IPFS] Upload failed:', error);
            throw new Error(`Pinata upload failed: ${error.error?.details || error.error || response.statusText}`);
        }

        const result: PinataResponse = await response.json();
        console.log('✅ [IPFS] Upload successful!');
        console.log(`   - CID: ${result.IpfsHash}`);
        console.log(`   - Pin Size: ${result.PinSize} bytes`);
        console.log(`   - Timestamp: ${result.Timestamp}`);
        console.log(`   - Gateway URL: https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);
        
        return result.IpfsHash; // This is the CID
    } catch (error) {
        console.error('❌ [IPFS] Upload error:', error);
        throw error;
    }
}

/**
 * Download data from IPFS
 * @param cid The IPFS CID (hash)
 * @returns The file data as Blob
 */
export async function downloadFromIPFS(cid: string): Promise<Blob> {
    console.log(`📥 [IPFS] Downloading from IPFS - CID: ${cid}`);
    // Use public IPFS gateway (Pinata or IPFS.io)
    const gateway = import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
    const url = `${gateway}${cid}`;
    console.log(`🌐 [IPFS] Gateway URL: ${url}`);

    try {
        const startTime = Date.now();
        const response = await fetch(url);
        const downloadTime = Date.now() - startTime;
        
        if (!response.ok) {
            console.error(`❌ [IPFS] Download failed: ${response.statusText}`);
            throw new Error(`Failed to download from IPFS: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log(`✅ [IPFS] Download successful in ${downloadTime}ms`);
        console.log(`   - Blob size: ${blob.size} bytes`);
        console.log(`   - Blob type: ${blob.type}`);
        
        return blob;
    } catch (error) {
        console.error('❌ [IPFS] Download error:', error);
        throw error;
    }
}

/**
 * Download data from IPFS as text
 * @param cid The IPFS CID
 * @returns The file data as string
 */
export async function downloadFromIPFSAsText(cid: string): Promise<string> {
    const blob = await downloadFromIPFS(cid);
    return await blob.text();
}

/**
 * Download data from IPFS as ArrayBuffer
 * @param cid The IPFS CID
 * @returns The file data as ArrayBuffer
 */
export async function downloadFromIPFSAsArrayBuffer(cid: string): Promise<ArrayBuffer> {
    const blob = await downloadFromIPFS(cid);
    return await blob.arrayBuffer();
}

/**
 * Get IPFS file metadata from Pinata
 * @param cid The IPFS CID
 * @returns Metadata including type if available
 */
export async function getIPFSMetadata(cid: string): Promise<PinataMetadata | null> {
    const jwt = import.meta.env.VITE_PINATA_JWT;
    
    if (!jwt) {
        console.warn('Pinata JWT not configured, cannot fetch metadata');
        return null;
    }

    try {
        const response = await fetch(`${PINATA_API_URL}/data/pinList?hashContains=${cid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwt}`,
            },
        });

        if (!response.ok) {
            console.warn('Failed to fetch IPFS metadata');
            return null;
        }

        const data = await response.json();
        if (data.rows && data.rows.length > 0) {
            const pin = data.rows.find((row: any) => row.ipfs_pin_hash === cid);
            if (pin && pin.metadata) {
                return pin.metadata;
            }
        }
        return null;
    } catch (error) {
        console.warn('Error fetching IPFS metadata:', error);
        return null;
    }
}

/**
 * Check if Pinata is configured
 */
export function isPinataConfigured(): boolean {
    return !!import.meta.env.VITE_PINATA_JWT;
}


