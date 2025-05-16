import { ENV, HEADERS } from "@/utils/constants";
import axios from "axios";

export async function GET() {
  try {
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

    const contractTxs = [];
    let height = latestHeight;

    while (contractTxs.length < 10 && height > 0) {
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
        // Decode base64 transaction if needed and inspect for contract types
        const decodedTx = Buffer.from(tx, "base64").toString("utf-8");

        // Heuristic: check if it includes a contract call
        if (decodedTx.includes("MsgExecuteContract")) {
          contractTxs.push({
            height,
            hash: res.data.result.block_id.hash,
            time: res.data.result.block.header.time,
            rawTx: tx,
          });
        }

        if (contractTxs.length === 10) break;
      }

      height--;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return Response.json({
      contractTxs,
      length: contractTxs.length,
    });
  } catch (err) {
    console.error("Error fetching contract transactions:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return new Response(
      JSON.stringify({
        error: "Failed to fetch contract transactions",
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      }),
      { status: 500 }
    );
  }
}
