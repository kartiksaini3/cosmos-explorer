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
    const blocks = [];

    for (let i = 0; i < 10; i++) {
      const height = latestHeight - i;

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

      blocks.push({
        height,
        hash: res.data.result.block_id.hash,
        time: res.data.result.block.header.time,
        txs: res.data.result.block.data.txs || [],
      });

      await new Promise((resolve) => setTimeout(resolve, 250)); // Rate limit delay
    }

    return Response.json({ blocks });
  } catch (err) {
    console.error("Error fetching blocks:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return new Response(
      JSON.stringify({
        error: "Failed to fetch blocks",
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      }),
      { status: 500 }
    );
  }
}
