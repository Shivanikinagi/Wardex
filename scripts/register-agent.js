const { ethers } = require('hardhat')

async function registerAgent() {
  const registryAddress = process.env.ERC8004_REGISTRY_ADDRESS
  const metadataURI = process.env.AGENT_METADATA_URI
  const deployerAddress = process.env.DEPLOYER_ADDRESS

  if (!registryAddress) {
    throw new Error('Missing ERC8004_REGISTRY_ADDRESS in environment')
  }
  if (!metadataURI) {
    throw new Error('Missing AGENT_METADATA_URI in environment')
  }
  if (!deployerAddress) {
    throw new Error('Missing DEPLOYER_ADDRESS in environment')
  }

  const registryAbi = [
    'function register(tuple(bytes32 name,address operator,string metadataURI) info) returns (bytes32)',
  ]

  const [signer] = await ethers.getSigners()
  const registry = new ethers.Contract(registryAddress, registryAbi, signer)

  const tx = await registry.register({
    name: ethers.encodeBytes32String('wardex'),
    operator: deployerAddress,
    metadataURI,
  })

  const receipt = await tx.wait()
  console.log('Agent registered tx:', tx.hash)
  console.log('Receipt status:', receipt.status)
  console.log('Update agent.json erc8004_identity with:', tx.hash)
}

registerAgent().catch((error) => {
  console.error('Registration failed:', error)
  process.exitCode = 1
})
