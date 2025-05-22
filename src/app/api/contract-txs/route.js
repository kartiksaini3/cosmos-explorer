import { ENV, HEADERS } from "@/utils/constants";
import { Pool } from "pg";
import axios from "axios";
import { parseRawTx } from "@/utils/functions";

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
        contract_address TEXT,
        time TIMESTAMPTZ,
        raw_tx TEXT,
        parsed_tx TEXT
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
    console.log(
      "startHeight_latestHeight_latestHeight-startHeight : contract-txs",
      startHeight,
      latestHeight,
      latestHeight - startHeight
    );

    let currentHeight = startHeight + 1;
    let limit = 0;

    while (
      currentHeight <= latestHeight &&
      (ENV.IS_LIMIT_INSERT ? limit < ENV.INSERT_LIMIT_PER_CALL : true)
    ) {
      ENV.IS_LIMIT_INSERT && limit++;
      console.log(
        "remaining : contract-txs",
        currentHeight,
        latestHeight - currentHeight
      );
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
        const parsedTx = await parseRawTx(rawTx);
        console.log("parsedTx", parsedTx);

        await client.query(
          `INSERT INTO contract_transactions (height, hash, contract_address, time, raw_tx, parsed_tx)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
          [
            currentHeight,
            res.data.result?.block_id?.hash,
            parsedTx?.[0]?.contractAddress,
            res.data.result?.block?.header?.time,
            rawTx,
            JSON.stringify(parsedTx),
          ]
        );
      }

      currentHeight++;
      // await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const latestTxRes = await client.query(`
      SELECT hash, height, contract_address AS "contractAddress", raw_tx AS "rawTx",time, parsed_tx AS "parsedTx"
      FROM contract_transactions
      ORDER BY height DESC, id DESC
      LIMIT ${ENV.FETCH_LIMIT}
    `);

    const contractTxs = latestTxRes.rows?.filter(
      (tx) => JSON.parse(tx?.parsedTx)?.length
    );

    return Response.json({ contractTxs, count: contractTxs.length });
  } catch (err) {
    console.error("Error fetching/storing contract transactions:", err, {
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
