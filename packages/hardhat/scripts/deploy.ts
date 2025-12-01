import hre from "hardhat";
import { ethers } from "ethers";

// Type assertion to access ethers from hre
const getEthers = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (hre as any).ethers;
};

async function main() {
  try {
    console.log("Deploying FHE Legacy Vault contract...");
    console.log("Network:", hre.network.name);
    
    const hreEthers = getEthers();
    
    // Get deployer account
    const signers = await hreEthers.getSigners();
    if (signers.length === 0) {
      throw new Error("No accounts found. Please set MNEMONIC or PRIVATE_KEY in your environment variables.");
    }
    const deployer = signers[0];
    console.log("Deploying with account:", deployer.address);
    const balance = await hreEthers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");
    
    // Deploy FHELegacyVault contract
    console.log("\nDeploying FHELegacyVault contract...");
    const FHELegacyVault = await hreEthers.getContractFactory("FHELegacyVault");
    const vault = await FHELegacyVault.deploy();
    console.log("Transaction hash:", vault.deploymentTransaction()?.hash);
    console.log("Waiting for deployment confirmation...");
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    
    console.log("\n=== Deployment Summary ===");
    console.log(`FHELegacyVault: ${vaultAddress}`);
    console.log(`Network: ${hre.network.name}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log("\n✅ Deployment successful!");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
