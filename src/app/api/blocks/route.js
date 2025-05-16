import { ENV, HEADERS } from "@/utils/constants";
import { Pool } from "pg";
import axios from "axios";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        height INTEGER PRIMARY KEY,
        hash TEXT,
        time TIMESTAMPTZ,
        txs JSONB
      );
    `);

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

    const dbRes = await client.query("SELECT MAX(height) AS max FROM blocks");
    let startHeight = dbRes.rows[0].max || ENV.STARTING_BLOCK_HEIGHT;

    const newBlocks = [];
    let currentHeight = startHeight + 1;

    while (currentHeight <= latestHeight) {
      const res = await axios.post(
        ENV.RPC_ENDPOINT,
        {
          jsonrpc: "2.0",
          id: currentHeight,
          method: "block",
          params: { height: String(currentHeight) },
        },
        { headers: HEADERS }
      );

      if (res.data?.error) {
        const msg = res.data?.error?.data;
        const match = msg?.match(/lowest height is (\d+)/);
        if (match) {
          currentHeight = parseInt(match[1]);
          console.log("currentHeight", currentHeight);

          continue; // retry from the new lower bound
        } else {
          return new Response(
            JSON.stringify({
              error: "Failed to fetch/store blocks",
              message: res.data.error.message,
              response: res.data.error.data,
              status: 400,
            }),
            { status: 500 }
          );
        }
      }

      const block = {
        height: currentHeight,
        hash: res.data.result?.block_id?.hash,
        time: res.data.result?.block?.header?.time,
        txs: res.data.result?.block?.data?.txs || [],
      };

      await client.query(
        `INSERT INTO blocks (height, hash, time, txs)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (height) DO NOTHING`,
        [block.height, block.hash, block.time, JSON.stringify(block.txs)]
      );

      newBlocks.push(block);
      currentHeight++;

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const latestBlocksRes = await client.query(`
      SELECT height, hash, time, txs
      FROM blocks
      ORDER BY height DESC
      LIMIT 10
    `);

    const blocks = latestBlocksRes.rows;

    return Response.json({ blocks, length: blocks.length });
  } catch (err) {
    console.log("errrrr", err);

    console.error("Error fetching/storing blocks:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return new Response(
      JSON.stringify({
        error: "Failed to fetch/store blocks",
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      }),
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
