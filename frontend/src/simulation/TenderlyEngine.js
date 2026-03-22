export const simulateTransaction = async (tx) => {
  // Use environment variables for API keys in a real app, hardcoding here for hackathon demo compatibility
  const TENDERLY_USER = import.meta.env.VITE_TENDERLY_USER || "demo_user";
  const TENDERLY_PROJECT = import.meta.env.VITE_TENDERLY_PROJECT || "wardex";
  const TENDERLY_API_KEY = import.meta.env.VITE_TENDERLY_API_KEY || "dummy_key";

  if (!import.meta.env.VITE_TENDERLY_API_KEY) {
      console.warn("Using mock Tenderly response because VITE_TENDERLY_API_KEY is not set.");
      // Fallback for hackathon demo if no key is provided
      await new Promise(r => setTimeout(r, 1000));
      return {
          success: true,
          gasUsed: 125000,
          output: "0x0000000000000000000000000000000000000000000000000000000000000001"
      };
  }

  try {
      const response = await fetch(
          `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`,
          {
              method: 'POST',
              headers: {
                  'X-Access-Key': TENDERLY_API_KEY,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  network_id: '84532', // Base Sepolia
                  from: tx.from,
                  to: tx.to,
                  input: tx.data || "0x",
                  value: tx.value || "0",
                  save: true
              })
          }
      );

      const result = await response.json();
      return {
          success: result.simulation.status,
          gasUsed: result.simulation.gas_used,
          output: result.simulation.return_value
      };
  } catch (error) {
      console.error("Tenderly Simulation Error:", error);
      return { success: false, error: error.message };
  }
};