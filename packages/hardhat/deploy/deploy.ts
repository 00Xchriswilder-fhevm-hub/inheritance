import hre from "hardhat";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Type assertion to access ethers from hre
const getEthers = () => (hre as any).ethers;

/** Update a .env file: set or replace a key's value (keeps other lines intact). */
function updateEnvFile(filePath: string, key: string, value: string) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");
  const lineMatch = new RegExp(`^(${key}=).*`, "m");
  if (lineMatch.test(content)) {
    content = content.replace(lineMatch, `$1${value}`);
  } else {
    content = content.trimEnd() + "\n" + `${key}=${value}` + "\n";
  }
  fs.writeFileSync(filePath, content);
  console.log(`  Updated ${path.basename(filePath)}: ${key}=${value}`);
}

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

    // When deploying to Sepolia: save address and update Vault + indexer .env
    if (hre.network.name === "sepolia") {
      const hardhatRoot = path.resolve(__dirname, "..");
      const deployOut = path.join(hardhatRoot, "last-deploy-sepolia.json");
      fs.writeFileSync(
        deployOut,
        JSON.stringify({ network: "sepolia", FHELegacyVault: vaultAddress, deployer: deployer.address }, null, 2)
      );
      console.log(`  Saved ${path.basename(deployOut)}`);

      const vaultEnv = path.join(hardhatRoot, "..", "Vault", ".env");
      const railwayEnv = path.join(hardhatRoot, "..", "Vault", "railway", ".env");
      updateEnvFile(vaultEnv, "VITE_FHE_VAULT_CONTRACT_ADDRESS", vaultAddress);
      updateEnvFile(railwayEnv, "CONTRACT_ADDRESS", vaultAddress);
    }

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
