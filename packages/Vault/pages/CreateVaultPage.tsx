
import React, { useState, useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Calendar, AlertTriangle, CheckCircle, Lock, ArrowLeft, ArrowRight, Shield, Key, Clock, Check, FileText, Upload, X, UserPlus, Trash2, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { WalletContext } from '../contexts/WalletContext';
import Button from '../components/Button';
import { Input } from '../components/Input';
import Card from '../components/Card';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useFheVault } from '../hooks/useFheVault';
import { useVaultContract } from '../hooks/useVaultContract';
import { useFhevm, getFheInstance } from '@fhevm-sdk';
import { createVault as createFheVault } from '../services/fheVaultService';
import { grantAccessToMultiple } from '../services/vaultContractService';
import { ethers } from 'ethers';
import { generateVaultId } from '../utils/vaultIdGenerator';
import { getTransactionErrorMessage } from '../utils/errorHandler';
import { vaultService, userService, heirService } from '../supabase/supabaseService';

const STEPS = [
    { id: 1, label: 'Content', icon: FileText },
    { id: 2, label: 'Heirs', icon: Key },
    { id: 3, label: 'Schedule', icon: Clock },
    { id: 4, label: 'Review', icon: CheckCircle },
];

const CreateVaultPage = () => {
    const { isConnected, address, connectWallet } = useContext(WalletContext);
    const [step, setStep] = useState(1);
    const [contentType, setContentType] = useState<'text' | 'file'>('text');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedAMPM, setSelectedAMPM] = useState<'AM' | 'PM'>('AM');
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [filePreview, setFilePreview] = useState<string | null>(null);
    
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGrantingAccess, setIsGrantingAccess] = useState(false);
    const [vaultCreated, setVaultCreated] = useState(false);
    const [createdVaultId, setCreatedVaultId] = useState<string | null>(null);
    const [pendingHeirs, setPendingHeirs] = useState<string[]>([]);
    const [heirAddresses, setHeirAddresses] = useState<string[]>(['']);
    const navigate = useNavigate();
    const toast = useToast();
    
    // FHE Contract hooks
    const CONTRACT_ADDRESS = import.meta.env.VITE_FHE_VAULT_CONTRACT_ADDRESS || '';
    const { encryptValue, getSigner } = useFheVault();
    const { getWriteContract, isReady: isContractReady } = useVaultContract(CONTRACT_ADDRESS);
    const { status: fhevmStatus } = useFhevm();
    
    // Note: FHEVM initialization is now handled globally in WalletContext
    // when wallet connects, so we just check the status here

    // Form Setup
    const { control, register, handleSubmit, watch, trigger, getValues, setValue, formState: { errors, isValid } } = useForm({
        mode: 'onChange',
        defaultValues: {
            mnemonic: '',
            releaseDate: new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0],
            releaseTime: '12:00',
        }
    });

    const watchMnemonic = watch('mnemonic');
    const wordCount = watchMnemonic ? watchMnemonic.trim().split(/\s+/).length : 0;
    const watchReleaseDate = watch('releaseDate');
    
    // Sync calendar view with selected date
    useEffect(() => {
        if (watchReleaseDate) {
            const date = new Date(watchReleaseDate);
            setCalendarMonth(date.getMonth());
            setCalendarYear(date.getFullYear());
        }
    }, [watchReleaseDate]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // Simple size limit check (e.g., 5MB for localStorage demo)
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File is too large for this demo (Max 5MB)");
                return;
            }
            setSelectedFile(file);
            
            // Read file for preview/storage
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
    };

    // Navigation Logic
    const nextStep = async () => {
        let fieldsToValidate: string[] = [];
        if (step === 1) {
            if (contentType === 'text') {
                fieldsToValidate = ['mnemonic'];
            } else {
                if (!selectedFile) {
                    toast.error("Please select a file to upload");
                    return;
                }
                // Skip mnemonic validation if file
            }
        }
        if (step === 2) {
            // Validate heir addresses
            const validHeirs = heirAddresses.filter(addr => 
                addr.trim() !== '' && 
                ethers.isAddress(addr)
            );
            if (validHeirs.length === 0) {
                toast.error("Please add at least one valid heir address");
                return;
            }
            // Check for duplicate addresses
            const addresses = heirAddresses.filter(addr => addr.trim() !== '' && ethers.isAddress(addr));
            const uniqueAddresses = new Set(addresses.map(addr => addr.toLowerCase()));
            if (addresses.length !== uniqueAddresses.size) {
                toast.error("Duplicate heir addresses are not allowed");
                return;
            }
        }
        if (step === 3) fieldsToValidate = ['releaseDate', 'releaseTime'];

        // If checking text mnemonic
        if (step === 1 && contentType === 'text') {
            const isStepValid = await trigger('mnemonic');
            if (!isStepValid) return;
        }

        setStep(prev => prev + 1);
    };

    const prevStep = () => setStep(prev => prev - 1);

    // Separate function to grant access to heirs (called after vault creation)
    const handleGrantAccess = async () => {
        if (!createdVaultId || pendingHeirs.length === 0) {
            toast.error("No heirs to grant access to");
            return;
        }

        if (!isConnected || !address) {
            toast.error("Please connect your wallet");
            return;
        }

        setIsGrantingAccess(true);
        try {
            toast.info(`Granting access to ${pendingHeirs.length} heir${pendingHeirs.length > 1 ? 's' : ''}...`);
            const writeContract = await getWriteContract();
            if (!writeContract) {
                throw new Error("Failed to get write contract");
            }

            console.log(`Granting access to ${pendingHeirs.length} heirs:`, pendingHeirs);
            const grantTx = await writeContract.grantAccessToMultiple(createdVaultId, pendingHeirs);
            toast.info("Waiting for transaction confirmation...");
            const receipt = await grantTx.wait();
            
            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">Access granted to {pendingHeirs.length} heir{pendingHeirs.length > 1 ? 's' : ''}!</span>
                    <span className="text-xs">Transaction: {receipt.hash.substring(0, 10)}...</span>
                </div>
            );
            
            // Reset state and navigate
            setVaultCreated(false);
            setCreatedVaultId(null);
            setPendingHeirs([]);
            navigate('/my-vaults');
        } catch (error: any) {
            console.error("Failed to grant access to heirs:", error);
            toast.error(getTransactionErrorMessage(error));
        } finally {
            setIsGrantingAccess(false);
        }
    };

    const onSubmit = async () => {
        if (!isConnected || !address) {
            toast.error("Please connect your wallet first");
            return;
        }

        if (!CONTRACT_ADDRESS) {
            toast.error("Contract address not configured. Please set VITE_FHE_VAULT_CONTRACT_ADDRESS in .env");
            return;
        }

        // Check the global instance first - it's the source of truth since it's shared across components
        // The hook status might be out of sync if FHEVM was initialized in another component
        const globalFheInstance = getFheInstance();
        
        // If global instance exists, FHEVM is ready regardless of hook status
        if (globalFheInstance) {
            console.log('✅ FHEVM is ready (global instance exists)');
            // Continue with vault creation
        } else if (fhevmStatus === 'loading') {
            toast.info("FHEVM is initializing. Please wait a moment...");
            return;
        } else if (fhevmStatus === 'error') {
            toast.error("FHEVM initialization failed. Please refresh the page and try again.");
            return;
        } else if (fhevmStatus !== 'ready') {
            // If global instance doesn't exist and status isn't ready, show error
            console.warn('⚠️ FHEVM not ready - global instance:', globalFheInstance, 'status:', fhevmStatus);
            toast.error("FHEVM is not ready. Please wait for initialization to complete...");
            return;
        }

        const values = getValues();
        const combinedDateTime = new Date(`${values.releaseDate}T${values.releaseTime}`);
        
        if (combinedDateTime.getTime() <= Date.now()) {
            toast.error("Release time must be in the future");
            return;
        }

        // Validate heir addresses
        const validHeirs = heirAddresses.filter(addr => 
            addr.trim() !== '' && 
            ethers.isAddress(addr)
        );
        if (validHeirs.length === 0) {
            toast.error("Please add at least one valid heir address");
            return;
        }

        setIsLoading(true);
        try {
            // Determine content to encrypt
            let dataToEncrypt: string | File;
            if (contentType === 'text') {
                dataToEncrypt = values.mnemonic;
            } else if (contentType === 'file' && selectedFile) {
                dataToEncrypt = selectedFile;
            } else {
                throw new Error("Invalid content type");
            }

            const signer = await getSigner();
            if (!signer) {
                throw new Error("Failed to get signer");
            }

            // Generate random vault ID
            const vaultId = generateVaultId();
            
            // Create vault using FHE service
            // The flow is: Encrypt with AES → Upload to IPFS → Encrypt AES key with FHE → Create on-chain
            toast.info("Step 1/4: Encrypting data with AES...");
            console.log('🚀 Starting vault creation process...');
            
            let result;
            try {
                result = await createFheVault({
                    vaultId,
                    data: dataToEncrypt,
                    releaseTimestamp: Math.floor(combinedDateTime.getTime() / 1000),
                    contractAddress: CONTRACT_ADDRESS,
                    signer,
                    userAddress: address,
                    encryptFn: async (contractAddr, value) => {
                        // This is called after IPFS upload
                        toast.info("Step 3/4: Encrypting AES key with FHE...");
                        console.log('🔐 Encrypting AES key with FHEVM...');
                        return await encryptValue(contractAddr, value);
                    },
                    metadata: {
                        name: contentType === 'file' ? selectedFile?.name : 'vault-data',
                        description: contentType === 'file' ? `File Vault: ${selectedFile?.name}` : `Mnemonic Vault`,
                    },
                });
            } catch (error: any) {
                console.error('❌ Vault creation failed:', error);
                // Check if it's an IPFS error
                if (error?.message?.includes('IPFS') || error?.message?.includes('Pinata')) {
                    toast.error(`IPFS upload failed: ${error.message}`);
                } else if (error?.message?.includes('FHE') || error?.message?.includes('encrypt')) {
                    toast.error(`FHE encryption failed: ${error.message}`);
                } else {
                    toast.error(getTransactionErrorMessage(error));
                }
                throw error;
            }

            // Vault creation successful - now show option to grant access to heirs
            // User can approve this transaction separately
            console.log("Vault created successfully. Heir access can be granted separately.");
            
            // Log vault to Supabase
            if (address && result) {
                try {
                    // Ensure user exists in Supabase
                    await userService.upsertUser(address);
                    
                    // Get transaction receipt for block number and hash
                    const receipt = result.receipt || result;
                    const blockNumber = receipt?.blockNumber;
                    const transactionHash = receipt?.hash || receipt?.transactionHash;
                    
                    // Build IPFS gateway URL
                    const ipfsGatewayUrl = result.cid 
                        ? `https://gateway.pinata.cloud/ipfs/${result.cid}`
                        : undefined;
                    
                    // Log vault to Supabase
                    await vaultService.createVault({
                        vaultId: vaultId,
                        ownerAddress: address,
                        cid: result.cid || '',
                        ipfsGatewayUrl: ipfsGatewayUrl,
                        releaseTimestamp: Math.floor(combinedDateTime.getTime() / 1000),
                        vaultType: contentType,
                        contentLength: contentType === 'text' 
                            ? values.mnemonic.length 
                            : selectedFile?.size,
                        fileName: contentType === 'file' ? selectedFile?.name : undefined,
                        fileType: contentType === 'file' ? selectedFile?.type : undefined,
                        blockNumber: blockNumber ? Number(blockNumber) : undefined,
                        transactionHash: transactionHash,
                    });
                    
                    console.log('✅ Vault logged to Supabase successfully');
                } catch (dbError) {
                    console.error('Error logging vault to Supabase:', dbError);
                    // Don't fail vault creation if DB logging fails
                }
            }
            
            // Filter valid heirs
            const filteredHeirs = validHeirs.filter(heirAddr => {
                const addr = heirAddr.trim();
                if (addr === ethers.ZeroAddress) {
                    console.warn("Skipping zero address");
                    return false;
                }
                if (addr.toLowerCase() === address?.toLowerCase()) {
                    console.warn("Skipping owner address (cannot grant access to yourself)");
                    return false;
                }
                return true;
            });

            // Vault is now stored on blockchain only - no local storage needed

            // If there are valid heirs, show grant access option
            if (filteredHeirs.length > 0) {
                // Store state for grant access step
                setVaultCreated(true);
                setCreatedVaultId(vaultId);
                setPendingHeirs(filteredHeirs);
                setIsLoading(false); // Stop loading so user can see the grant access button
                
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span className="font-bold">Vault created successfully!</span>
                        <span className="text-xs">Vault ID: {vaultId}</span>
                        <span className="text-xs text-muted mt-2">
                            Click "Grant Access to Heirs" below to approve the transaction
                        </span>
                    </div>
                );
                return; // Don't navigate yet - show grant access button
            } else {
                // No valid heirs, navigate to my-vaults
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span className="font-bold">Vault created successfully!</span>
                        <span className="text-xs">Vault ID: {vaultId}</span>
                        <span className="text-xs text-muted">Remember to grant access to heirs later</span>
                    </div>
                );
                navigate('/my-vaults');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || "Failed to create vault");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="max-w-md mx-auto mt-20 text-center px-4">
                <Card className="py-10">
                    <AlertTriangle className="w-16 h-16 text-warning mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-4">Wallet Not Connected</h2>
                    <p className="text-muted mb-8">You need to connect your wallet to verify ownership and create a vault.</p>
                    <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                            <Button onClick={openConnectModal} icon={<Wallet size={18} />}>
                                Connect Wallet
                            </Button>
                        )}
                    </ConnectButton.Custom>
                </Card>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
            <div className="flex h-full grow flex-col justify-start">
                <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Stepper */}
                    <div className="flex justify-between items-center mb-8 relative px-4">
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-zinc-800 -z-10 mx-8 hidden sm:block"></div>
                {STEPS.map((s, i) => {
                    const isActive = i + 1 === step;
                    const isCompleted = i + 1 < step;
                    const Icon = s.icon;
                    return (
                                <div key={s.id} className="flex flex-col items-center bg-background-dark px-2 sm:px-4">
                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'border-primary text-primary bg-background-dark' : isCompleted ? 'border-primary bg-primary text-black' : 'border-zinc-800 text-zinc-500 bg-zinc-900'}`}>
                                <Icon size={20} className={isCompleted ? "text-black" : ""} />
                            </div>
                                    <span className={`mt-2 text-xs font-bold uppercase tracking-wider ${isActive ? 'text-primary underline' : isCompleted ? 'text-white' : 'text-zinc-500'}`}>{s.label}</span>
                        </div>
                    );
                })}
            </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
                {/* Step 1: Content (Text or File) */}
                {step === 1 && (
                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex min-w-72 flex-col gap-2">
                                    <p className="text-3xl font-bold leading-tight tracking-tighter text-zinc-900 dark:text-white sm:text-4xl">Add Your Content</p>
                                    <p className="text-base font-normal leading-normal text-zinc-600 dark:text-zinc-400">Choose how you want to secure your legacy: as a secret message or a file.</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <div className="flex justify-end">
                                    <p className="text-sm font-normal leading-normal text-zinc-900 dark:text-white">Step 1 of 4</p>
                                </div>
                                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                                    <div className="h-2 rounded-full bg-primary" style={{ width: '25%' }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                            <button 
                                        type="button"
                                onClick={() => setContentType('text')}
                                        className={`flex-1 rounded-lg px-4 py-3 text-center text-sm font-bold transition-all ${contentType === 'text' ? 'bg-zinc-900 text-primary dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
                            >
                                        Secret Text
                            </button>
                            <button 
                                        type="button"
                                onClick={() => setContentType('file')}
                                        className={`flex-1 rounded-lg px-4 py-3 text-center text-sm font-medium transition-all whitespace-nowrap ${contentType === 'file' ? 'bg-zinc-900 text-primary dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
                            >
                                        File Upload / Sharing
                            </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                        {contentType === 'text' ? (
                                <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-100 p-6 dark:border-zinc-800 dark:bg-zinc-900">
                                    {/* Recovery Image */}
                                    <div className="flex items-center justify-center">
                                        <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                            <img 
                                                src="/recovery.jpeg" 
                                                alt="Recovery phrase" 
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                    {/* Textarea */}
                                    <div className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-900 p-4 dark:border-zinc-800">
                                    <textarea
                                        {...register('mnemonic', {
                                            required: 'Content is required',
                                            validate: (value) => {
                                                return value.length > 0 || "Content cannot be empty";
                                            }
                                        })}
                                            className={`min-h-[200px] w-full resize-none border-0 bg-transparent font-mono text-sm leading-relaxed text-zinc-400 placeholder-zinc-600 focus:ring-0 ${!showMnemonic ? 'text-security-disc' : ''}`}
                                            placeholder="Type your secret message here..."
                                        style={!showMnemonic ? { WebkitTextSecurity: 'disc' } as any : {}}
                                    />
                                        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-3">
                                            <span className="text-xs font-medium text-zinc-400">Mask Content</span>
                                            <button 
                                                type="button"
                                                onClick={() => setShowMnemonic(!showMnemonic)}
                                                aria-checked={!showMnemonic}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-zinc-900 ${!showMnemonic ? 'bg-primary' : 'bg-zinc-600'}`}
                                                role="switch"
                                            >
                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${!showMnemonic ? 'translate-x-5' : 'translate-x-0'}`}></span>
                                    </button>
                                </div>
                                </div>
                            </div>
                        ) : (
                                <>
                                {!selectedFile ? (
                                        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900 relative cursor-pointer">
                                        <input 
                                            type="file" 
                                            onChange={handleFileChange} 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                            <div className="rounded-full bg-zinc-200 p-3 dark:bg-zinc-800">
                                                <span className="material-symbols-outlined text-3xl text-zinc-500 dark:text-zinc-400">upload_file</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="text-base font-bold text-zinc-900 dark:text-white">Drag & drop files here</p>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400">or click to browse</p>
                                            </div>
                                            <p className="text-xs text-zinc-500">Max file size: 5MB</p>
                                    </div>
                                ) : (
                                        <>
                                            <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-100 p-6 dark:border-zinc-800 dark:bg-zinc-900">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex flex-col items-center gap-3 flex-1">
                                                        {/* Media Image - Bigger */}
                                                        <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                                            <img 
                                                                src="/media.jpeg" 
                                                                alt="Media file" 
                                                                className="w-full h-full object-cover"
                                                            />
                                            </div>
                                                        {/* File Info */}
                                                        <div className="flex flex-col items-center gap-1 w-full">
                                                            <p className="text-sm font-bold text-zinc-900 dark:text-white text-center truncate max-w-full px-2">
                                                                {selectedFile.name}
                                                            </p>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                                                                {selectedFile.type || 'Unknown type'} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                            </div>
                                        </div>
                                                    <button 
                                                        type="button"
                                                        onClick={removeFile} 
                                                        className="text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">close</span>
                                        </button>
                                    </div>
                                </div>
                                            <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
                                                <div className="h-1.5 rounded-full bg-primary" style={{ width: '100%' }}></div>
                            </div>
                                        </>
                        )}
                                </>
                            )}
                            {errors.mnemonic && (
                                <div className="text-xs text-red-500 font-bold">{errors.mnemonic.message as string}</div>
                )}
                        </div>

                        <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
                            <button 
                                type="button"
                                onClick={() => navigate('/')}
                                className="rounded-md px-4 py-2 text-sm font-bold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800" 
                                disabled
                            >
                                Back
                            </button>
                            <button 
                                type="button"
                                onClick={nextStep}
                                className="rounded-md bg-primary px-6 py-2 text-sm font-bold uppercase text-zinc-900 hover:bg-primary/90"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}
                {/* Step 2: Heir Addresses */}
                {step === 2 && (
                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex min-w-72 flex-col gap-2">
                                    <p className="text-3xl font-bold leading-tight tracking-tighter text-zinc-900 dark:text-white sm:text-4xl">Add Your Heirs</p>
                                    <p className="text-base font-normal leading-normal text-zinc-600 dark:text-zinc-400">Specify the wallet addresses that will be authorized to access this vault.</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <div className="flex justify-end">
                                    <p className="text-sm font-normal leading-normal text-zinc-900 dark:text-white">Step 2 of 4</p>
                                </div>
                                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                                    <div className="h-2 rounded-full bg-primary" style={{ width: '50%' }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Authorized Users</h2>
                        
                            <div className="flex flex-col gap-4">
                                {heirAddresses.map((addr, index) => {
                                    const isValid = addr.trim() === '' || ethers.isAddress(addr);
                                    const isOwnAddress = addr.toLowerCase() === address?.toLowerCase();
                                    const hasError = addr.trim() !== '' && (!isValid || isOwnAddress);
                                    
                                    return (
                                        <div key={index} className="relative flex items-center">
                                            <span className={`absolute left-4 font-bold ${hasError ? 'text-error' : isValid && addr.trim() !== '' ? 'text-primary' : 'text-zinc-400'}`}>
                                                {index + 1}.
                                            </span>
                                            <input
                                            value={addr}
                                            onChange={(e) => {
                                                const newAddresses = [...heirAddresses];
                                                newAddresses[index] = e.target.value;
                                                setHeirAddresses(newAddresses);
                                            }}
                                                className={`w-full rounded-lg border-2 py-4 pl-10 pr-12 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-0 dark:bg-zinc-900 dark:text-white ${
                                                    hasError 
                                                        ? 'border-error bg-zinc-100 ring-2 ring-error/20 dark:border-error' 
                                                        : isValid && addr.trim() !== ''
                                                        ? 'border-primary bg-zinc-100 ring-2 ring-primary/20 dark:border-primary'
                                                        : 'border-zinc-200 bg-zinc-100 dark:border-zinc-700'
                                                }`}
                                                placeholder="Enter wallet address"
                                                type="text"
                                            />
                                    {heirAddresses.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHeirAddresses(heirAddresses.filter((_, i) => i !== index));
                                            }}
                                                    className="absolute right-3 flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                        >
                                                    <span className="material-symbols-outlined text-xl">close</span>
                                        </button>
                                    )}
                                </div>
                                    );
                                })}
                        </div>
                        
                            <button
                            type="button"
                            onClick={() => setHeirAddresses([...heirAddresses, ''])}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 py-4 text-center text-zinc-500 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-primary dark:hover:bg-primary/10"
                        >
                                <span className="material-symbols-outlined">add_circle</span>
                                <span className="font-bold">Add Another Heir</span>
                            </button>
                        
                            <div className="bg-primary/20 border border-primary/30 rounded-lg p-4">
                            <div className="flex gap-2 items-start">
                                    <Shield size={16} className="mt-0.5 shrink-0 text-primary" />
                                <div>
                                        <span className="font-bold block mb-1 text-primary dark:text-primary">How it works:</span>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-zinc-900 dark:text-white">
                                        <li>Authorized users can use their wallet to decrypt and access the vault after the release date</li>
                                        <li>You can add multiple authorized users to the same vault - perfect for secure file sharing</li>
                                        <li>Access is controlled on-chain via FHEVM Access Control Lists (ACL)</li>
                                        <li>Only the wallet addresses you add here will be able to decrypt the content</li>
                                            <li>You can revoke access to heirs after the vault is created</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Schedule */}
                {step === 3 && (() => {
                    const releaseDate = watch('releaseDate') || '';
                    const releaseTime = watch('releaseTime') || '10:30';
                    const [hours, minutes] = releaseTime.split(':');
                    const hour12 = hours ? (parseInt(hours) % 12 || 12).toString().padStart(2, '0') : '10';
                    const minute12 = minutes || '30';
                    const currentAMPM = hours ? (parseInt(hours) >= 12 ? 'PM' : 'AM') : 'AM';
                    
                    // Sync selectedAMPM with current time
                    if (selectedAMPM !== currentAMPM && releaseTime) {
                        setSelectedAMPM(currentAMPM);
                    }
                    
                    const handleHourChange = (value: string) => {
                        const hour = parseInt(value) || 0;
                        if (hour < 1 || hour > 12) return;
                        let newHour = hour;
                        if (selectedAMPM === 'PM' && hour < 12) {
                            newHour = hour + 12;
                        } else if (selectedAMPM === 'AM' && hour === 12) {
                            newHour = 0;
                        }
                        const newTime = `${newHour.toString().padStart(2, '0')}:${minute12}`;
                        setValue('releaseTime', newTime);
                    };
                    
                    const handleMinuteChange = (value: string) => {
                        const minute = parseInt(value) || 0;
                        if (minute < 0 || minute > 59) return;
                        const newTime = `${hours || '10'}:${minute.toString().padStart(2, '0')}`;
                        setValue('releaseTime', newTime);
                    };
                    
                    const handleAMPMChange = (value: 'AM' | 'PM') => {
                        setSelectedAMPM(value);
                        const currentHour = parseInt(hours) || 10;
                        let newHour = currentHour;
                        if (value === 'PM' && currentHour < 12) {
                            newHour = currentHour + 12;
                        } else if (value === 'AM' && currentHour >= 12) {
                            newHour = currentHour - 12;
                        }
                        const newTime = `${newHour.toString().padStart(2, '0')}:${minute12}`;
                        setValue('releaseTime', newTime);
                    };
                    
                    const previewDate = releaseDate && releaseTime 
                        ? new Date(`${releaseDate}T${releaseTime}`)
                        : null;
                    
                    return (
                        <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex min-w-72 flex-col gap-2">
                                        <p className="text-3xl font-bold leading-tight tracking-tighter text-zinc-900 dark:text-white sm:text-4xl">Set the Release Schedule</p>
                                        <p className="text-base font-normal leading-normal text-zinc-600 dark:text-zinc-400">Choose the exact date and time your vault will become accessible to its recipient.</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 pt-2">
                                    <div className="flex justify-end">
                                        <p className="text-sm font-normal leading-normal text-zinc-900 dark:text-white">Step 3 of 4</p>
                                    </div>
                                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                                        <div className="h-2 rounded-full bg-primary" style={{ width: '75%' }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                {/* Date Picker Section */}
                                <div className="flex flex-col gap-8">
                                    <div className="flex flex-col">
                                        <h2 className="px-4 pb-3 pt-5 text-[22px] font-bold leading-tight tracking-[-0.015em] text-zinc-900 dark:text-white">Release Date</h2>
                                        <div className="rounded-xl border border-zinc-200 bg-background-light p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                                            {(() => {
                                                const selectedDate = releaseDate ? new Date(releaseDate) : null;
                                                const currentMonth = calendarMonth;
                                                const currentYear = calendarYear;
                                                
                                                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                                const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                                                
                                                const firstDay = new Date(currentYear, currentMonth, 1);
                                                const lastDay = new Date(currentYear, currentMonth + 1, 0);
                                                const daysInMonth = lastDay.getDate();
                                                const startingDayOfWeek = firstDay.getDay();
                                                
                                                const handlePrevMonth = () => {
                                                    if (currentMonth === 0) {
                                                        setCalendarMonth(11);
                                                        setCalendarYear(currentYear - 1);
                                                    } else {
                                                        setCalendarMonth(currentMonth - 1);
                                                    }
                                                };
                                                
                                                const handleNextMonth = () => {
                                                    if (currentMonth === 11) {
                                                        setCalendarMonth(0);
                                                        setCalendarYear(currentYear + 1);
                                                    } else {
                                                        setCalendarMonth(currentMonth + 1);
                                                    }
                                                };
                                                
                                                const handleDateSelect = (day: number) => {
                                                    const selected = new Date(currentYear, currentMonth, day);
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    if (selected >= today) {
                                                        const dateStr = selected.toISOString().split('T')[0];
                                                        setValue('releaseDate', dateStr);
                                                    }
                                                };
                                                
                                                const today = new Date();
                                                const isToday = (day: number) => {
                                                    return today.getDate() === day && 
                                                           today.getMonth() === currentMonth && 
                                                           today.getFullYear() === currentYear;
                                                };
                                                
                                                const isSelected = (day: number) => {
                                                    if (!selectedDate) return false;
                                                    return selectedDate.getDate() === day && 
                                                           selectedDate.getMonth() === currentMonth && 
                                                           selectedDate.getFullYear() === currentYear;
                                                };
                                                
                                                const isPast = (day: number) => {
                                                    const date = new Date(currentYear, currentMonth, day);
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    return date < today;
                                                };
                                                
                                                const days = [];
                                                // Empty cells for days before the first day of the month
                                                for (let i = 0; i < startingDayOfWeek; i++) {
                                                    days.push(null);
                                                }
                                                // Days of the month
                                                for (let day = 1; day <= daysInMonth; day++) {
                                                    days.push(day);
                                                }
                                                
                                                return (
                                                    <div className="flex w-full max-w-sm flex-col gap-0.5">
                                                        <div className="flex items-center justify-between p-1">
                                                            <button 
                                                                type="button"
                                                                onClick={handlePrevMonth}
                                                                className="flex size-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                                            >
                                                                <span className="material-symbols-outlined text-xl">chevron_left</span>
                                                            </button>
                                                            <p className="flex-1 text-center text-base font-bold leading-tight text-zinc-900 dark:text-white">
                                                                {monthNames[currentMonth]} {currentYear}
                                                            </p>
                                                            <button 
                                                                type="button"
                                                                onClick={handleNextMonth}
                                                                className="flex size-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                                            >
                                                                <span className="material-symbols-outlined text-xl">chevron_right</span>
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-7">
                                                            {dayNames.map((day, idx) => (
                                                                <p key={idx} className="flex h-12 w-full items-center justify-center pb-0.5 text-[13px] font-bold leading-normal tracking-[0.015em] text-zinc-500 dark:text-zinc-400">
                                                                    {day}
                                                                </p>
                                                            ))}
                                                            {days.map((day, idx) => {
                                                                if (day === null) {
                                                                    return <div key={`empty-${idx}`} className="h-12 w-full" />;
                                                                }
                                                                const selected = isSelected(day);
                                                                const past = isPast(day);
                                                                
                                                                return (
                                                                    <button
                                                                        key={day}
                                                                        type="button"
                                                                        onClick={() => !past && handleDateSelect(day)}
                                                                        disabled={past}
                                                                        className={`h-12 w-full text-sm font-medium leading-normal transition-colors ${
                                                                            past 
                                                                                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed' 
                                                                                : 'text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                                        }`}
                                                                    >
                                                                        <div className={`flex size-full items-center justify-center rounded-full ${
                                                                            selected 
                                                                                ? 'bg-primary text-zinc-900 dark:text-black' 
                                                                                : ''
                                                                        }`}>
                                                                            {day}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Time & Preview Section */}
                                <div className="flex flex-col gap-8">
                                    {/* Time Picker Section */}
                                    <div className="flex flex-col">
                                        <h2 className="px-4 pb-3 pt-5 text-[22px] font-bold leading-tight tracking-[-0.015em] text-zinc-900 dark:text-white">Release Time</h2>
                                        <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-background-light p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="flex items-center">
                                <input 
                                                        type="text"
                                                        value={hour12}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                                                            if (value) {
                                                                const num = parseInt(value);
                                                                if (num >= 1 && num <= 12) {
                                                                    handleHourChange(value);
                                                                }
                                                            }
                                                        }}
                                                        className="h-20 w-20 rounded-md border-zinc-200 bg-zinc-100 text-center text-5xl font-bold text-zinc-900 focus:border-primary focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-primary"
                                />
                            </div>
                                                <span className="pb-1 text-5xl font-bold text-zinc-400 dark:text-zinc-600">:</span>
                                                <div className="flex items-center">
                                <input 
                                                        type="text"
                                                        value={minute12}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                                                            if (value) {
                                                                const num = parseInt(value);
                                                                if (num >= 0 && num <= 59) {
                                                                    handleMinuteChange(value);
                                                                }
                                                            }
                                                        }}
                                                        className="h-20 w-20 rounded-md border-zinc-200 bg-zinc-100 text-center text-5xl font-bold text-zinc-900 focus:border-primary focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-primary"
                                />
                            </div>
                                                <div className="flex flex-col gap-2 pl-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleAMPMChange('AM')}
                                                        className={`rounded-md border px-4 py-2 text-sm font-bold transition-colors ${
                                                            selectedAMPM === 'AM' 
                                                                ? 'border-primary bg-primary/20 text-primary dark:border-primary dark:bg-primary/20' 
                                                                : 'border-zinc-200 bg-transparent text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                                                        }`}
                                                    >
                                                        AM
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleAMPMChange('PM')}
                                                        className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                                                            selectedAMPM === 'PM' 
                                                                ? 'border-primary bg-primary/20 text-primary dark:border-primary dark:bg-primary/20' 
                                                                : 'border-zinc-200 bg-transparent text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                                                        }`}
                                                    >
                                                        PM
                                                    </button>
                        </div>
                            </div>
                                            <div>
                                                <label className="sr-only" htmlFor="timezone">Timezone</label>
                                                <select 
                                                    id="timezone" 
                                                    name="timezone"
                                                    className="mt-1 block w-full rounded-md border-zinc-200 bg-zinc-100 py-2 pl-3 pr-10 text-base text-zinc-900 focus:border-primary focus:outline-none focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:text-sm"
                                                >
                                                    <option>Pacific Standard Time (PST)</option>
                                                    <option>Mountain Standard Time (MST)</option>
                                                    <option>Central Standard Time (CST)</option>
                                                    <option>Eastern Standard Time (EST)</option>
                                                    <option>Coordinated Universal Time (UTC)</option>
                                                </select>
                        </div>
                                        </div>
                                    </div>

                                    {/* Preview Section */}
                                    <div className="flex flex-col">
                                        <h2 className="px-4 pb-3 pt-5 text-[22px] font-bold leading-tight tracking-[-0.015em] text-zinc-900 dark:text-white">Release ETA</h2>
                                        <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl bg-zinc-900 text-center">
                                            {previewDate ? (
                                                <>
                                                    <p className="text-xl font-medium leading-relaxed text-zinc-400">
                                                        {previewDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                                    </p>
                                                    <p className="font-display text-4xl font-bold tracking-tighter text-white sm:text-5xl">
                                                        {previewDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                    <p className="mt-2 text-xl font-medium text-zinc-400">
                                                        at <span className="font-bold text-primary">
                                                            {previewDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PST
                                                        </span>
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-xl font-medium text-zinc-400">Please select date and time</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Step 4: Review */}
                {step === 4 && (() => {
                    const previewVaultId = generateVaultId();
                    const validHeirsPreview = heirAddresses.filter(addr => 
                        addr.trim() !== '' && 
                        ethers.isAddress(addr)
                    );
                    const releaseDate = watch('releaseDate');
                    const releaseTime = watch('releaseTime');
                    const previewDate = releaseDate && releaseTime 
                        ? new Date(`${releaseDate}T${releaseTime}`)
                        : null;
                    
                    return (
                        <div className="flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex min-w-72 flex-col gap-2">
                                        <p className="text-3xl font-bold leading-tight tracking-tighter text-zinc-900 dark:text-white sm:text-4xl">Review & Create</p>
                                        <p className="text-base font-normal leading-normal text-zinc-600 dark:text-zinc-400">Verify your vault details before creating</p>
                             </div>
                             </div>
                                <div className="flex flex-col gap-2 pt-2">
                                    <div className="flex justify-end">
                                        <p className="text-sm font-normal leading-normal text-zinc-900 dark:text-white">Step 4 of 4</p>
                                    </div>
                                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                                        <div className="h-2 rounded-full bg-primary" style={{ width: '100%' }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* Left Column */}
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-background-light p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                                        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Vault Details</h2>
                                        
                                        <div className="flex flex-col gap-4">
                                            <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Vault ID</span>
                                                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-primary">{previewVaultId}</span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Vault Type</span>
                                                <span className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{contentType === 'text' ? 'Secret Text' : 'File Upload'}</span>
                                            </div>
                                            
                             {contentType === 'text' && (
                                                <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                                                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Content Length</span>
                                                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{wordCount} words</span>
                                </div>
                             )}
                                            
                                            {contentType === 'file' && selectedFile && (
                                                <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                                                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">File Name</span>
                                                    <span className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">{selectedFile.name}</span>
                                </div>
                             )}
                                            
                                            <div className="flex justify-between items-center py-3">
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Owner Address</span>
                                                <span className="font-mono text-xs text-zinc-900 dark:text-zinc-400">{address?.slice(0, 8)}...{address?.slice(-6)}</span>
                             </div>
                             </div>
                             </div>
                         </div>

                                {/* Right Column */}
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-background-light p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                                        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Access & Schedule</h2>
                                        
                                        <div className="flex flex-col gap-4">
                                            <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Heir Addresses</span>
                                                <span className="text-sm font-bold text-primary">{validHeirsPreview.length} {validHeirsPreview.length === 1 ? 'address' : 'addresses'}</span>
                                            </div>
                                            
                                            {previewDate && (
                                                <>
                                                    <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
                                                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Release Date</span>
                                                        <span className="text-sm font-bold text-zinc-900 dark:text-white">
                                                            {previewDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center py-3">
                                                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Release Time</span>
                                                        <span className="text-sm font-bold text-zinc-900 dark:text-white">
                                                            {previewDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Grant Access Section (shown after vault creation) */}
                {vaultCreated && pendingHeirs.length > 0 && (
                    <Card className="mt-8 border-2 border-primary/20 bg-primary/5">
                        <div className="flex flex-col gap-4">
                            <div>
                                <h3 className="text-lg font-bold mb-2">✅ Vault Created Successfully!</h3>
                                <p className="text-sm text-muted mb-1">Vault ID: <span className="font-mono">{createdVaultId}</span></p>
                                <p className="text-sm text-muted">
                                    Now grant access to {pendingHeirs.length} heir{pendingHeirs.length > 1 ? 's' : ''}. 
                                    This requires a separate transaction approval.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => {
                                        setVaultCreated(false);
                                        setCreatedVaultId(null);
                                        setPendingHeirs([]);
                                        navigate('/my-vaults');
                                    }}
                                    className="flex-1"
                                >
                                    Skip for Now
                                </Button>
                                <Button 
                                    type="button" 
                                    onClick={handleGrantAccess}
                                    isLoading={isGrantingAccess}
                                    className="flex-1"
                                >
                                    Grant Access to Heirs
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Buttons - Only for steps 2-4 */}
                {!vaultCreated && step > 1 && (
                    <div className="flex justify-between mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                        <button 
                            type="button"
                            onClick={prevStep}
                            className="rounded-md px-4 py-2 text-sm font-bold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
                        >
                            Back
                        </button>
                        {step < 4 ? (
                            <button 
                                type="button"
                                onClick={nextStep}
                                className="rounded-md bg-primary px-6 py-2 text-sm font-bold uppercase text-zinc-900 hover:bg-primary/90"
                            >
                                Continue
                            </button>
                        ) : (
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleSubmit(onSubmit)();
                                }}
                                disabled={isLoading}
                                className="rounded-md bg-primary px-6 py-2 text-sm font-bold uppercase text-zinc-900 hover:bg-primary/90 disabled:opacity-50"
                            >
                                {isLoading ? 'Creating...' : 'Create Vault'}
                            </button>
                        )}
                    </div>
                )}
            </form>
                </div>
            </div>
        </div>
    );
};

export default CreateVaultPage;