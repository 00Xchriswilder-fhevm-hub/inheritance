const { expect } = require("chai");
const { ethers, fhevm } = require("hardhat");

/**
 * @title FHE Legacy Vault Test Suite
 * @notice Tests for FHELegacyVault contract demonstrating time-locked access with FHEVM
 * @dev This test suite shows:
 *      - ✅ Vault creation with encrypted keys
 *      - ✅ Access control with FHE permissions
 *      - ✅ Time-locked access for heirs
 *      - ✅ Granting and revoking access
 */

describe("FHELegacyVault", function () {
  let deployer, owner, heir1, heir2;
  let contract;
  let contractAddress;
  let releaseTimestamp;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    await fhevm.initializeCLIApi();
    [deployer, owner, heir1, heir2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("FHELegacyVault");
    const deployed = await Factory.deploy();
    await deployed.waitForDeployment();
    contract = deployed;
    contractAddress = await contract.getAddress();

    // Set release time to 1 hour from now
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    releaseTimestamp = BigInt(block.timestamp) + BigInt(3600); // 1 hour
  });

  describe("✅ Vault Creation", function () {
    it("should create a vault with encrypted key", async function () {
      const vaultId = "vault-1";
      const cid = "QmTest123";
      const clearKey = 1234567890; // Simulated AES key

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(clearKey)
        .encrypt();

      await expect(
        contract
          .connect(owner)
          .createVault(
            vaultId,
            cid,
            encrypted.handles[0],
            encrypted.inputProof,
            releaseTimestamp
          )
      ).to.emit(contract, "VaultCreated");

      expect(await contract.vaultExists(vaultId)).to.be.true;
    });

    it("should fail to create vault with empty ID", async function () {
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1234567890)
        .encrypt();

      await expect(
        contract
          .connect(owner)
          .createVault("", "cid", encrypted.handles[0], encrypted.inputProof, releaseTimestamp)
      ).to.be.revertedWith("Vault ID cannot be empty");
    });

    it("should fail to create duplicate vault", async function () {
      const vaultId = "vault-1";
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1234567890)
        .encrypt();

      await contract
        .connect(owner)
        .createVault(vaultId, "cid1", encrypted.handles[0], encrypted.inputProof, releaseTimestamp);

      const encrypted2 = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(9876543210)
        .encrypt();

      await expect(
        contract
          .connect(owner)
          .createVault(vaultId, "cid2", encrypted2.handles[0], encrypted2.inputProof, releaseTimestamp)
      ).to.be.revertedWith("Vault ID already exists");
    });
  });

  describe("✅ Access Control", function () {
    let vaultId;

    beforeEach(async function () {
      vaultId = "vault-access";
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1234567890)
        .encrypt();

      await contract
        .connect(owner)
        .createVault(vaultId, "QmTest", encrypted.handles[0], encrypted.inputProof, releaseTimestamp);
    });

    it("should grant access to heir", async function () {
      await expect(
        contract.connect(owner).grantAccess(vaultId, heir1.address)
      ).to.emit(contract, "AccessGranted");

      expect(await contract.authorizedHeirs(vaultId, heir1.address)).to.be.true;
    });

    it("should grant access to multiple heirs", async function () {
      await contract
        .connect(owner)
        .grantAccessToMultiple(vaultId, [heir1.address, heir2.address]);

      expect(await contract.authorizedHeirs(vaultId, heir1.address)).to.be.true;
      expect(await contract.authorizedHeirs(vaultId, heir2.address)).to.be.true;
    });

    it("should revoke access from heir", async function () {
      await contract.connect(owner).grantAccess(vaultId, heir1.address);

      await expect(
        contract.connect(owner).revokeAccess(vaultId, heir1.address)
      ).to.emit(contract, "AccessRevoked");

      expect(await contract.authorizedHeirs(vaultId, heir1.address)).to.be.false;
    });

    it("should fail to grant access after release time", async function () {
      // Fast forward past release time
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        contract.connect(owner).grantAccess(vaultId, heir1.address)
      ).to.be.revertedWith("Cannot grant access after release");
    });
  });

  describe("✅ Vault Metadata", function () {
    it("should return vault metadata", async function () {
      const vaultId = "vault-meta";
      const cid = "QmMetadata";
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1234567890)
        .encrypt();

      await contract
        .connect(owner)
        .createVault(vaultId, cid, encrypted.handles[0], encrypted.inputProof, releaseTimestamp);

      const metadata = await contract.getVaultMetadata(vaultId);
      expect(metadata.owner).to.eq(owner.address);
      expect(metadata.cid).to.eq(cid);
      expect(metadata.releaseTimestamp).to.eq(releaseTimestamp);
    });

    it("should return user vaults", async function () {
      const vaultId1 = "vault-1";
      const vaultId2 = "vault-2";

      const encrypted1 = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1111)
        .encrypt();

      await contract
        .connect(owner)
        .createVault(vaultId1, "cid1", encrypted1.handles[0], encrypted1.inputProof, releaseTimestamp);

      const encrypted2 = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(2222)
        .encrypt();

      await contract
        .connect(owner)
        .createVault(vaultId2, "cid2", encrypted2.handles[0], encrypted2.inputProof, releaseTimestamp);

      const vaults = await contract.getUserVaults(owner.address);
      expect(vaults.length).to.eq(2);
      expect(vaults).to.include(vaultId1);
      expect(vaults).to.include(vaultId2);
    });
  });

  // ❌ Common Pitfalls
  describe("❌ Error Cases", function () {
    it("should fail to create vault with empty ID", async function () {
      const emptyId = "";
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1111)
        .encrypt();

      await expect(
        contract
          .connect(owner)
          .createVault(emptyId, "cid1", encrypted.handles[0], encrypted.inputProof, releaseTimestamp)
      ).to.be.reverted;
    });

    it("should fail to create duplicate vault", async function () {
      const vaultId = "vault1";
      const encrypted1 = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1111)
        .encrypt();

      // Create first vault
      await contract
        .connect(owner)
        .createVault(vaultId, "cid1", encrypted1.handles[0], encrypted1.inputProof, releaseTimestamp);

      // Try to create duplicate (should fail)
      const encrypted2 = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(2222)
        .encrypt();

      await expect(
        contract
          .connect(owner)
          .createVault(vaultId, "cid2", encrypted2.handles[0], encrypted2.inputProof, releaseTimestamp)
      ).to.be.reverted;
    });

    it("should fail to grant access after release time", async function () {
      const vaultId = "vault1";
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1111)
        .encrypt();

      await contract
        .connect(owner)
        .createVault(vaultId, "cid1", encrypted.handles[0], encrypted.inputProof, releaseTimestamp);

      // Fast forward past release time
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // Should fail to grant access after release time
      await expect(
        contract.connect(owner).grantAccess(vaultId, heir1.address)
      ).to.be.reverted;
    });

    it("should fail when non-owner tries to grant access", async function () {
      const vaultId = "vault1";
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, owner.address)
        .add256(1111)
        .encrypt();

      await contract
        .connect(owner)
        .createVault(vaultId, "cid1", encrypted.handles[0], encrypted.inputProof, releaseTimestamp);

      // Non-owner tries to grant access (should fail)
      await expect(
        contract.connect(heir1).grantAccess(vaultId, heir2.address)
      ).to.be.reverted;
    });
  });
});










