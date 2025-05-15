import { ENV, HEADERS } from "@/utils/constants";
import axios from "axios";

export async function GET() {
  try {
    // Step 1: Get latest block height
    const statusRes = await axios.post(
      ENV.RPC_ENDPOINT,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "status",
        params: [],
      },
      { headers: HEADERS }
    );

    const latestHeight = parseInt(
      statusRes.data.result.sync_info.latest_block_height
    );

    // Step 2: Scan backwards for transactions
    const transactions = [];
    let height = latestHeight;

    while (transactions.length < 10 && height > 0) {
      const res = await axios.post(
        ENV.RPC_ENDPOINT,
        {
          jsonrpc: "2.0",
          id: height,
          method: "block",
          params: { height: String(height) },
        },
        { headers: HEADERS }
      );

      const txs = res.data.result.block.data.txs || [];

      for (const tx of txs) {
        transactions.push({
          height,
          hash: res.data.result.block_id.hash,
          time: res.data.result.block.header.time,
          rawTx: tx,
        });

        if (transactions.length === 10) break;
      }

      height--;
      await new Promise((resolve) => setTimeout(resolve, 250)); // rate limiting
    }

    return Response.json({ transactions });
  } catch (err) {
    console.error("Error fetching transactions:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return new Response(
      JSON.stringify({
        error: "Failed to fetch transactions",
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      }),
      { status: 500 }
    );
  }
}
