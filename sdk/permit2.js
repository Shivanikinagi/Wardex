/**
 * DarkAgent SDK — Permit2 Integration
 * ====================================
 * Integrates Uniswap's Permit2 for gasless token approvals.
 * Agents can approve + transfer tokens in a single transaction
 * using EIP-712 signatures instead of separate approve() calls.
 *
 * Permit2 Address (canonical across all chains):
 *   0x000000000022D473030F116dDEE9F6B43aC78BA3
 *
 * Two modes:
 *   1. SignatureTransfer — one-time permit with signature
 *   2. AllowanceTransfer — persistent allowance with signature-based setup
 *
 * ENS text record:
 *   key: "delegation"
 *   value: comma-separated addresses that can use Permit2 on agent's behalf
 */

const { ethers } = require("ethers");

// ═══════════════════════════════════════════════════════════════
//                     CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

// EIP-712 type hashes for Permit2
const PERMIT2_DOMAIN_SEPARATOR_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(
        "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
    )
);

// Permit2 ABI (minimal needed functions)
const PERMIT2_ABI = [
    // SignatureTransfer
    "function permitTransferFrom(tuple(tuple(address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, tuple(address to, uint256 requestedAmount) transferDetails, address owner, bytes signature) external",

    // AllowanceTransfer
    "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
    "function allowance(address owner, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce)",

    // Transfer from allowance
    "function transferFrom(address from, address to, uint160 amount, address token) external",

    // Permit (set allowance with signature)
    "function permit(address owner, tuple(tuple(address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature) external",

    // Batch operations
    "function transferFrom(tuple(address from, address to, uint160 amount, address token)[] transferDetails) external",
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

const DEFAULT_CONFIG = {
    rpcUrl: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
    chainId: 84532,
    permit2Address: PERMIT2_ADDRESS,
};

// ═══════════════════════════════════════════════════════════════
//                  EIP-712 SIGNATURE HELPERS
// ═══════════════════════════════════════════════════════════════

const PERMIT_TRANSFER_FROM_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(
        "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
    )
);

const TOKEN_PERMISSIONS_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("TokenPermissions(address token,uint256 amount)")
);

const PERMIT_SINGLE_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(
        "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"
    )
);

const PERMIT_DETAILS_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(
        "PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"
    )
);

/**
 * Build the Permit2 EIP-712 domain separator
 */
function buildDomainSeparator(chainId, permit2Address = PERMIT2_ADDRESS) {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "bytes32", "uint256", "address"],
            [
                PERMIT2_DOMAIN_SEPARATOR_TYPEHASH,
                ethers.keccak256(ethers.toUtf8Bytes("Permit2")),
                chainId,
                permit2Address,
            ]
        )
    );
}

// ═══════════════════════════════════════════════════════════════
//               SIGNATURE TRANSFER (one-time permits)
// ═══════════════════════════════════════════════════════════════

/**
 * Sign a Permit2 SignatureTransfer permit
 * Allows a one-time gasless token transfer using an EIP-712 signature
 *
 * @param {object} params
 * @param {string} params.tokenAddress - ERC20 token address
 * @param {string} params.amount - Amount in token units (e.g., "100" for 100 USDC)
 * @param {string} params.spender - Who can use this permit
 * @param {number} params.nonce - Unique nonce (must be unused)
 * @param {number} params.deadline - Unix timestamp deadline
 * @param {Wallet} params.signer - ethers Wallet (the token owner)
 * @param {object} params.config - Optional config overrides
 * @returns {object} Signed permit with signature
 */
async function signPermitTransfer({
    tokenAddress,
    amount,
    spender,
    nonce,
    deadline,
    signer,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Get token decimals
    const provider = signer.provider;
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await token.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    // Build domain separator
    const domainSeparator = buildDomainSeparator(
        cfg.chainId,
        cfg.permit2Address
    );

    // Build permit struct hash
    const tokenPermissionsHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "uint256"],
            [TOKEN_PERMISSIONS_TYPEHASH, tokenAddress, parsedAmount]
        )
    );

    const permitHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "bytes32", "address", "uint256", "uint256"],
            [
                PERMIT_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                spender,
                nonce,
                deadline,
            ]
        )
    );

    // Build EIP-712 digest
    const digest = ethers.keccak256(
        ethers.solidityPacked(
            ["string", "bytes32", "bytes32"],
            ["\x19\x01", domainSeparator, permitHash]
        )
    );

    // Sign
    const signature = await signer.signMessage(ethers.getBytes(digest));

    return {
        permit: {
            permitted: { token: tokenAddress, amount: parsedAmount.toString() },
            nonce,
            deadline,
        },
        signature,
        spender,
        owner: signer.address,
        tokenSymbol: await token.symbol(),
    };
}

/**
 * Execute a Permit2 SignatureTransfer
 * @param {object} params
 * @param {object} params.permit - Signed permit from signPermitTransfer
 * @param {string} params.recipient - Who receives the tokens
 * @param {string} params.privateKey - Spender's private key
 * @param {object} params.config - Optional config
 */
async function executePermitTransfer({
    permit,
    signature,
    owner,
    recipient,
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const permit2 = new ethers.Contract(
        cfg.permit2Address,
        PERMIT2_ABI,
        signer
    );

    console.log("\n💳 ═══════════════════════════════════════════════");
    console.log("    PERMIT2 SIGNATURE TRANSFER");
    console.log("   ═══════════════════════════════════════════════");
    console.log(`   Token: ${permit.permitted.token}`);
    console.log(`   Amount: ${permit.permitted.amount}`);
    console.log(`   From: ${owner}`);
    console.log(`   To: ${recipient}`);

    const tx = await permit2.permitTransferFrom(
        permit,
        { to: recipient, requestedAmount: permit.permitted.amount },
        owner,
        signature
    );

    const receipt = await tx.wait();

    console.log(`   ✅ Transfer complete: ${tx.hash}`);
    return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
    };
}

// ═══════════════════════════════════════════════════════════════
//              ALLOWANCE TRANSFER (persistent permits)
// ═══════════════════════════════════════════════════════════════

/**
 * Approve tokens to Permit2 contract (one-time setup)
 * This is the standard ERC20 approve to Permit2, needed before any Permit2 operations
 */
async function approveToPermit2({
    tokenAddress,
    amount,
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const decimals = await token.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    console.log(`\n💳 Approving ${amount} tokens to Permit2...`);

    const tx = await token.approve(cfg.permit2Address, parsedAmount);
    const receipt = await tx.wait();

    console.log(`   ✅ Approved in block ${receipt.blockNumber}`);

    return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        token: tokenAddress,
        amount,
    };
}

/**
 * Check current Permit2 allowance
 */
async function checkPermit2Allowance({
    owner,
    tokenAddress,
    spender,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);

    const permit2 = new ethers.Contract(
        cfg.permit2Address,
        PERMIT2_ABI,
        provider
    );

    const [amount, expiration, nonce] = await permit2.allowance(
        owner,
        tokenAddress,
        spender
    );

    return {
        amount: amount.toString(),
        expiration: Number(expiration),
        nonce: Number(nonce),
        isExpired: Number(expiration) < Math.floor(Date.now() / 1000),
    };
}

/**
 * Sign an AllowanceTransfer permit (set spending allowance with signature)
 */
async function signAllowancePermit({
    tokenAddress,
    amount,
    spender,
    expiration,
    signer,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    const provider = signer.provider;
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await token.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    // Get current nonce
    const permit2 = new ethers.Contract(
        cfg.permit2Address,
        PERMIT2_ABI,
        provider
    );
    const [, , currentNonce] = await permit2.allowance(
        signer.address,
        tokenAddress,
        spender
    );

    const domainSeparator = buildDomainSeparator(
        cfg.chainId,
        cfg.permit2Address
    );

    const sigDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const detailsHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "uint160", "uint48", "uint48"],
            [
                PERMIT_DETAILS_TYPEHASH,
                tokenAddress,
                parsedAmount,
                expiration,
                currentNonce,
            ]
        )
    );

    const permitHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "bytes32", "address", "uint256"],
            [PERMIT_SINGLE_TYPEHASH, detailsHash, spender, sigDeadline]
        )
    );

    const digest = ethers.keccak256(
        ethers.solidityPacked(
            ["string", "bytes32", "bytes32"],
            ["\x19\x01", domainSeparator, permitHash]
        )
    );

    const signature = await signer.signMessage(ethers.getBytes(digest));

    return {
        permitSingle: {
            details: {
                token: tokenAddress,
                amount: parsedAmount.toString(),
                expiration,
                nonce: Number(currentNonce),
            },
            spender,
            sigDeadline,
        },
        signature,
        owner: signer.address,
    };
}

// ═══════════════════════════════════════════════════════════════
//                  DELEGATION FROM ENS
// ═══════════════════════════════════════════════════════════════

const ENS_RESOLVER_ABI = [
    "function text(bytes32 node, string key) external view returns (string)",
];
const PUBLIC_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

/**
 * Read delegation addresses from ENS `delegation` text record
 * @param {string} ensName - e.g., "trading-agent.dark26.eth"
 * @returns {string[]} Array of authorized delegate addresses
 */
async function getDelegatesFromENS(ensName, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(
        cfg.ensRpcUrl || "https://rpc.sepolia.org"
    );

    try {
        const namehash = ethers.namehash(ensName);
        const resolver = new ethers.Contract(
            PUBLIC_RESOLVER,
            ENS_RESOLVER_ABI,
            provider
        );

        const value = await resolver.text(namehash, "delegation");
        if (!value) return [];

        // Parse comma-separated addresses
        return value
            .split(",")
            .map((addr) => addr.trim())
            .filter((addr) => ethers.isAddress(addr));
    } catch {
        return [];
    }
}

/**
 * Check if an address is authorized as a delegate for an agent
 */
async function isAuthorizedDelegate(ensName, address, config = {}) {
    const delegates = await getDelegatesFromENS(ensName, config);
    return delegates.some(
        (d) => d.toLowerCase() === address.toLowerCase()
    );
}

// ═══════════════════════════════════════════════════════════════
//                     EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    signPermitTransfer,
    executePermitTransfer,
    approveToPermit2,
    checkPermit2Allowance,
    signAllowancePermit,
    getDelegatesFromENS,
    isAuthorizedDelegate,
    PERMIT2_ADDRESS,
    PERMIT2_ABI,
    ERC20_ABI,
};
