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
      CREATE TABLE IF NOT EXISTS transactions (
        hash TEXT PRIMARY KEY,
        height INTEGER,
        raw_tx TEXT,
        time TIMESTAMPTZ
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

    const dbRes = await client.query(
      "SELECT MAX(height) AS max FROM transactions"
    );
    let startHeight = dbRes.rows[0].max || +ENV.STARTING_BLOCK_HEIGHT;

    const newTxs = [];
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
          continue;
        } else {
          return new Response(
            JSON.stringify({
              error: "Failed to fetch/store transactions",
              message: res.data.error.message,
              response: res.data.error.data,
              status: 400,
            }),
            { status: 500 }
          );
        }
      }

      const blockTime = res.data.result.block.header.time;
      const height = currentHeight;
      const txs = res.data.result.block.data.txs || [];

      for (const tx of txs) {
        const hash = res.data.result.block_id.hash + "_" + newTxs.length; // pseudo hash to ensure uniqueness
        await client.query(
          `INSERT INTO transactions (hash, height, raw_tx, time)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (hash) DO NOTHING`,
          [hash, height, tx, blockTime]
        );

        newTxs.push({
          hash,
          height,
          rawTx: tx,
          time: blockTime,
        });

        if (newTxs.length === 10) break;
      }

      currentHeight++;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const latestTxsRes = await client.query(`
      SELECT hash, height, raw_tx AS "rawTx", time
      FROM transactions
      ORDER BY height DESC
      LIMIT 10
    `);

    const transactions = latestTxsRes.rows;

    return Response.json({ transactions, length: transactions.length });
  } catch (err) {
    console.error("Error fetching/storing transactions:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return new Response(
      JSON.stringify({
        error: "Failed to fetch/store transactions",
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
