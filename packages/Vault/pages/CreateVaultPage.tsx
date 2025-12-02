
import React, { useState, useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Calendar, AlertTriangle, CheckCircle, Lock, ArrowLeft, ArrowRight, Shield, Key, Clock, Check, FileText, Upload, X, UserPlus, Trash2, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { WalletContext } from '../contexts/WalletContext';
import { saveVault, mockHash, mockEncrypt } from '../services/vaultService';
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

            // Also save to local storage for demo purposes (backward compatibility)
            // Save to local storage for backward compatibility
            saveVault({
                id: vaultId, // Now using string ID
                ownerAddress: address,
                encryptedData: result.cid, // Store CID instead
                vaultType: contentType,
                fileName: selectedFile?.name,
                mimeType: selectedFile?.type,
                heirKeyHash: '', // Deprecated - access is now controlled by blockchain addresses
                releaseTime: combinedDateTime.getTime(),
                createdAt: Date.now(),
                isReleased: false,
                description: contentType === 'file' ? `File Vault: ${selectedFile?.name}` : `Mnemonic Vault ${vaultId}`,
                // Password/key system removed - access is now controlled by blockchain addresses
            });

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
        <div className="max-w-4xl mx-auto py-12 px-4">
            {/* Stepper */}
            <div className="flex justify-between items-center mb-12 relative px-4">
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border -z-10 mx-8 hidden sm:block"></div>
                {STEPS.map((s, i) => {
                    const isActive = i + 1 === step;
                    const isCompleted = i + 1 < step;
                    const Icon = s.icon;
                    return (
                        <div key={s.id} className="flex flex-col items-center bg-background px-2 sm:px-4">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'border-primary text-primary bg-background shadow-[0_0_15px_#ffd20850]' : isCompleted ? 'border-primary bg-primary text-background' : 'border-border text-muted bg-surface'}`}>
                                <Icon size={20} className={isCompleted ? "text-black" : ""} />
                            </div>
                            <span className={`mt-2 text-xs font-bold uppercase tracking-wider ${isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted'}`}>{s.label}</span>
                        </div>
                    );
                })}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
                {/* Step 1: Content (Text or File) */}
                {step === 1 && (
                    <Card title="1. Select Content Type" className="animate-fade-in">
                        <div className="flex gap-4 mb-6">
                            <button 
                                onClick={() => setContentType('text')}
                                className={`flex-1 py-4 rounded-lg border-2 font-bold uppercase transition-all ${contentType === 'text' ? 'border-primary bg-primary/10 text-primary shadow-neo-sm' : 'border-border bg-surface hover:border-muted'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><FileText size={18}/> Secret Text</span>
                            </button>
                            <button 
                                onClick={() => setContentType('file')}
                                className={`flex-1 py-4 rounded-lg border-2 font-bold uppercase transition-all ${contentType === 'file' ? 'border-primary bg-primary/10 text-primary shadow-neo-sm' : 'border-border bg-surface hover:border-muted'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><Upload size={18}/> File Upload</span>
                            </button>
                        </div>

                        {contentType === 'text' ? (
                            <div className="mb-6 animate-fade-in">
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                                    Recovery Phrase / Private Note
                                </label>
                                <div className="relative">
                                    <textarea
                                        {...register('mnemonic', {
                                            required: 'Content is required',
                                            validate: (value) => {
                                                return value.length > 0 || "Content cannot be empty";
                                            }
                                        })}
                                        className={`w-full bg-background border-2 ${errors.mnemonic ? 'border-error' : 'border-border'} rounded-lg p-4 min-h-[160px] font-mono text-sm focus:border-primary focus:outline-none focus:shadow-neo transition-all ${!showMnemonic ? 'text-security-disc' : ''}`}
                                        placeholder="Enter your secret phrase, private key, or secure note here..."
                                        style={!showMnemonic ? { WebkitTextSecurity: 'disc' } as any : {}}
                                    />
                                    <button type="button" onClick={() => setShowMnemonic(!showMnemonic)} className="absolute top-4 right-4 text-muted hover:text-foreground">
                                        {showMnemonic ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span className="text-xs text-error font-bold">{errors.mnemonic?.message as string}</span>
                                    <span className="text-xs text-muted font-mono">{watchMnemonic?.length || 0} chars</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6 animate-fade-in">
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                                    Upload File (IPFS)
                                </label>
                                {!selectedFile ? (
                                    <div className="border-2 border-dashed border-border rounded-lg p-10 text-center hover:border-primary hover:bg-surface-hover transition-all cursor-pointer relative">
                                        <input 
                                            type="file" 
                                            onChange={handleFileChange} 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <Upload className="mx-auto h-12 w-12 text-muted mb-4" />
                                        <p className="text-lg font-bold">Drop your file here</p>
                                        <p className="text-sm text-muted">or click to browse</p>
                                        <p className="text-xs text-muted mt-4">Max size: 5MB (Demo)</p>
                                    </div>
                                ) : (
                                    <div className="bg-surface-hover rounded-lg p-4 border border-border flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-primary/20 rounded flex items-center justify-center text-primary">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold truncate max-w-[200px]">{selectedFile.name}</div>
                                                <div className="text-xs text-muted">{(selectedFile.size / 1024).toFixed(2)} KB</div>
                                            </div>
                                        </div>
                                        <button onClick={removeFile} className="p-2 hover:bg-background rounded-full text-muted hover:text-error transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                )}
                                <div className="mt-4 p-3 bg-info/10 border border-info/30 rounded text-xs text-info flex gap-2">
                                    <Shield size={16} />
                                    <span>Files will be encrypted before simulating IPFS upload.</span>
                                </div>
                            </div>
                        )}
                    </Card>
                )}

                {/* Step 2: Heir Addresses */}
                {step === 2 && (
                    <Card title="2. Add Heir Addresses" className="animate-fade-in">
                        <p className="text-sm text-muted mb-6">Add wallet addresses of heirs who should have access to this vault after the release date.</p>
                        
                        <div className="space-y-3 mb-4">
                            {heirAddresses.map((addr, index) => (
                                <div key={index} className="flex gap-2 items-start">
                                    <div className="flex-1">
                                        <Input
                                            label={index === 0 ? "Heir Wallet Address" : ""}
                                            value={addr}
                                            onChange={(e) => {
                                                const newAddresses = [...heirAddresses];
                                                newAddresses[index] = e.target.value;
                                                setHeirAddresses(newAddresses);
                                            }}
                                            placeholder="0x..."
                                            error={
                                                addr && !ethers.isAddress(addr) 
                                                    ? 'Invalid Ethereum address' 
                                                    : addr && addr.toLowerCase() === address?.toLowerCase()
                                                    ? 'Cannot add your own address'
                                                    : ''
                                            }
                                        />
                                    </div>
                                    {heirAddresses.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHeirAddresses(heirAddresses.filter((_, i) => i !== index));
                                            }}
                                            className="p-3 text-error hover:bg-error/10 rounded-lg transition-colors mt-6"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <p className="text-sm text-muted mb-6">
                            <strong>Note:</strong> Access is controlled by wallet addresses on the blockchain. 
                            Only the addresses you add here will be able to unlock this vault after the release time.
                        </p>
                        
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setHeirAddresses([...heirAddresses, ''])}
                            icon={<UserPlus size={18} />}
                            className="mb-6"
                        >
                            Add Another Heir
                        </Button>
                        
                        <div className="bg-info/10 border border-info/30 rounded-lg p-4 text-sm text-info">
                            <div className="flex gap-2 items-start">
                                <Shield size={16} className="mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-bold block mb-1">How it works:</span>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        <li>Heirs can use their wallet to decrypt and access the vault after the release date</li>
                                        <li>You can add multiple heirs to the same vault</li>
                                        <li>Heirs will need to use the FHEVM userDecrypt feature to access the encrypted key</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Step 3: Schedule */}
                {step === 3 && (
                    <Card title="4. Release Schedule" className="animate-fade-in">
                        <p className="text-sm text-muted mb-6">When can your heir access this vault?</p>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Release Date</label>
                                <input 
                                    type="date" 
                                    {...register('releaseDate', { required: true })} 
                                    min={new Date().toISOString().split('T')[0]} 
                                    className="w-full bg-background text-foreground border-2 border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-0 focus:border-primary focus:shadow-neo transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-200" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Release Time</label>
                                <input 
                                    type="time" 
                                    {...register('releaseTime', { required: true })} 
                                    className="w-full bg-background text-foreground border-2 border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-0 focus:border-primary focus:shadow-neo transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-200" 
                                />
                            </div>
                        </div>
                        <div className="bg-surface-hover rounded-lg p-4 border-2 border-border">
                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Release Date & Time Preview</label>
                            <div className="text-lg font-bold text-foreground">
                                {watch('releaseDate') && watch('releaseTime') ? (
                                    new Date(`${watch('releaseDate')}T${watch('releaseTime')}`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                ) : 'Please select date and time'}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Step 4: Review */}
                {step === 4 && (() => {
                    const previewVaultId = generateVaultId();
                    const validHeirsPreview = heirAddresses.filter(addr => 
                        addr.trim() !== '' && 
                        ethers.isAddress(addr)
                    );
                    return (
                    <Card title="Review & Create" className="animate-fade-in">
                         <p className="text-sm text-muted mb-6">Verify your vault details before creating</p>
                         <div className="space-y-4">
                             <div className="flex justify-between items-center p-3 bg-surface-hover rounded border border-border">
                                 <span className="text-sm text-muted">Vault ID</span>
                                 <span className="font-mono text-xs font-bold text-primary">{previewVaultId}</span>
                             </div>
                             <div className="flex justify-between items-center p-3 bg-surface-hover rounded border border-border">
                                 <span className="text-sm text-muted">Vault Type</span>
                                 <span className="font-bold uppercase text-primary">{contentType === 'text' ? 'Mnemonic / Text' : 'File Upload'}</span>
                             </div>
                             {contentType === 'text' && (
                                <div className="flex justify-between items-center p-3 bg-surface-hover rounded border border-border">
                                    <span className="text-sm text-muted">Word Count</span>
                                    <span className="font-bold text-success border border-success/30 bg-success/10 px-2 py-0.5 rounded text-xs">{wordCount} words</span>
                                </div>
                             )}
                             {contentType === 'file' && (
                                <div className="flex justify-between items-center p-3 bg-surface-hover rounded border border-border">
                                    <span className="text-sm text-muted">File Name</span>
                                    <span className="font-bold truncate max-w-[150px]">{selectedFile?.name}</span>
                                </div>
                             )}
                             <div className="flex justify-between items-center p-3 bg-surface-hover rounded border border-border">
                                 <span className="text-sm text-muted">Release Date</span>
                                 <span className="font-bold">{new Date(`${watch('releaseDate')}T${watch('releaseTime')}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                             </div>
                             <div className="flex justify-between items-center p-3 bg-surface-hover rounded border border-border">
                                 <span className="text-sm text-muted">Owner Address</span>
                                 <span className="font-mono text-xs">{address?.slice(0, 8)}...{address?.slice(-6)}</span>
                             </div>
                             <div className="flex justify-between items-center p-3 bg-surface-hover rounded border border-border">
                                 <span className="text-sm text-muted">Heir Addresses</span>
                                 <span className="font-bold text-primary">{heirAddresses.filter(addr => addr.trim() !== '' && ethers.isAddress(addr)).length} added</span>
                             </div>
                         </div>
                    </Card>
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

                {/* Buttons */}
                {!vaultCreated && (
                    <div className="flex justify-between mt-8">
                        {step > 1 ? (
                            <Button type="button" variant="secondary" onClick={prevStep} className="w-28">Back</Button>
                        ) : (
                            <Button type="button" variant="outline" onClick={() => navigate('/')} className="w-28">Cancel</Button>
                        )}
                        
                        {step < 4 ? (
                            <Button type="button" onClick={nextStep} className="w-full sm:w-auto sm:min-w-[120px] ml-auto">Continue</Button>
                        ) : (
                            <Button type="submit" isLoading={isLoading} className="w-full sm:w-auto sm:min-w-[160px] ml-auto">Create Vault</Button>
                        )}
                    </div>
                )}
            </form>
        </div>
    );
};

export default CreateVaultPage;