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
      CREATE TABLE IF NOT EXISTS contract_transactions (
        id SERIAL PRIMARY KEY,
        height INTEGER,
        hash TEXT,
        time TIMESTAMPTZ,
        raw_tx TEXT
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
      "SELECT MAX(height) AS max FROM contract_transactions"
    );
    let startHeight = dbRes.rows[0].max || ENV.STARTING_BLOCK_HEIGHT;

    const newTransactions = [];
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
              error: "Failed to fetch/store contract transactions",
              message: res.data.error.message,
              response: res.data.error.data,
              status: 400,
            }),
            { status: 500 }
          );
        }
      }

      const txs = res.data.result?.block?.data?.txs || [];

      for (const rawTx of txs) {
        const isContract = true;

        if (isContract) {
          await client.query(
            `INSERT INTO contract_transactions (height, hash, time, raw_tx)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [
              currentHeight,
              res.data.result?.block_id?.hash,
              res.data.result?.block?.header?.time,
              rawTx,
            ]
          );

          newTransactions.push({
            height: currentHeight,
            hash: res.data.result?.block_id?.hash,
            time: res.data.result?.block?.header?.time,
            rawTx,
          });
        }
      }

      currentHeight++;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const latestTxRes = await client.query(`
      SELECT hash, height, raw_tx AS "rawTx",time
      FROM contract_transactions
      ORDER BY height DESC, id DESC
      LIMIT 10
    `);

    const contractTxs = latestTxRes.rows;

    return Response.json({ contractTxs, length: contractTxs.length });
  } catch (err) {
    console.error("Error fetching/storing contract transactions:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return new Response(
      JSON.stringify({
        error: "Failed to fetch/store contract transactions",
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
